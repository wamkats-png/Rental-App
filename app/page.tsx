'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useApp } from './context/AppContext';
import { formatUGX, daysUntil, formatDate } from './lib/utils';
import { DashboardStatSkeleton } from './components/Skeleton';

const RevenueChart = dynamic(() => import('./components/RevenueChart'), { ssr: false });

export default function Dashboard() {
  const router = useRouter();
  const { landlord, properties, units, tenants, leases, payments, maintenance, expenses, loading } = useApp();

  // Redirect brand-new users to onboarding.
  // Only fires when loading is complete AND the landlord record has never been
  // set up (id is empty = no row in DB and no local name set yet).
  // Using landlord.id avoids false redirects when a user has a name but zero
  // properties, and also prevents a redirect loop after the welcome wizard
  // sets the name optimistically before the DB write completes.
  useEffect(() => {
    if (!loading && !landlord.id && !landlord.name) {
      router.replace('/welcome');
    }
  }, [loading, landlord, router]);

  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('all');

  const filterByProperty = <T extends { property_id: string }>(items: T[]) =>
    selectedPropertyId === 'all' ? items : items.filter(i => i.property_id === selectedPropertyId);

  // Track dismissed expiry alerts (persists across navigation within the session)
  const [dismissedIds, setDismissedIds] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const saved = sessionStorage.getItem('dismissed-expiry-alerts');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const dismissAlert = (id: string) => {
    const next = [...dismissedIds, id];
    setDismissedIds(next);
    try { sessionStorage.setItem('dismissed-expiry-alerts', JSON.stringify(next)); } catch {}
  };

  const filteredProperties = filterByProperty(properties.map(p => ({ ...p, property_id: p.id })));
  const filteredPropertyIds = filteredProperties.map(p => p.id);

  const totalProperties = filteredProperties.length;
  const filteredUnits = selectedPropertyId === 'all'
    ? units
    : units.filter(u => filteredPropertyIds.includes(u.property_id));
  const totalUnits = filteredUnits.length;
  const occupiedUnits = filteredUnits.filter(u => u.status === 'Occupied').length;
  const activeLeases = filterByProperty(leases.filter(l => l.status === 'Active'));

  const now = new Date();
  const thisMonth = filterByProperty(payments).filter(p => {
    const d = new Date(p.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const collectedThisMonth = thisMonth.reduce((sum, p) => sum + p.amount, 0);

  const thisMonthExpenses = filterByProperty(
    expenses.filter(e => e.property_id).map(e => ({ ...e, property_id: e.property_id! }))
  );
  const allExpensesThisMonth = [
    ...thisMonthExpenses,
    ...expenses.filter(e => !e.property_id),
  ].filter(e => {
    const d = new Date(e.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const totalExpensesThisMonth = allExpensesThisMonth.reduce((sum, e) => sum + e.amount, 0);
  const occupancyRate = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0;

  const filteredPayments = filterByProperty(payments);

  const overduePayments = activeLeases.filter(l => {
    // Cap due_day to actual days in the current month (e.g. Feb has 28/29 days)
    const daysInCurrentMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const cappedDueDay = Math.min(l.due_day, daysInCurrentMonth);
    const dueDate = new Date(now.getFullYear(), now.getMonth(), cappedDueDay);
    // Add grace period days using proper date arithmetic (avoids month-boundary overflow)
    const gracePeriodEnd = new Date(dueDate);
    gracePeriodEnd.setDate(gracePeriodEnd.getDate() + (l.grace_period_days || 0));
    const hasPaymentThisMonth = filteredPayments.some(p => {
      const pDate = new Date(p.date);
      return p.lease_id === l.id &&
             pDate.getMonth() === now.getMonth() &&
             pDate.getFullYear() === now.getFullYear();
    });
    return now > gracePeriodEnd && !hasPaymentThisMonth;
  }).length;

  const expiringLeases = activeLeases.filter(l => l.end_date && daysUntil(l.end_date) <= 30 && daysUntil(l.end_date) > 0);
  const visibleExpiring = expiringLeases.filter(l => !dismissedIds.includes(l.id));

  const reviewsDue = activeLeases.filter(l =>
    l.next_review_date && daysUntil(l.next_review_date) <= 30 && daysUntil(l.next_review_date) > 0
  );
  const visibleReviews = reviewsDue.filter(l => !dismissedIds.includes(`review-${l.id}`));

  const dismissReview = (id: string) => {
    const key = `review-${id}`;
    const next = [...dismissedIds, key];
    setDismissedIds(next);
    try { sessionStorage.setItem('dismissed-expiry-alerts', JSON.stringify(next)); } catch {}
  };

  const last6Months = Array.from({ length: 6 }, (_, i) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const monthPayments = filteredPayments.filter(p => {
      const d = new Date(p.date);
      return d.getMonth() === date.getMonth() && d.getFullYear() === date.getFullYear();
    });
    const total = monthPayments.reduce((sum, p) => sum + p.amount, 0);
    return {
      month: date.toLocaleDateString('en-US', { month: 'short' }),
      amount: total,
    };
  });

  const recentActivity = [
    ...filteredPayments.slice(-3).reverse().map(p => ({
      id: p.id,
      type: 'payment',
      text: `Payment of ${formatUGX(p.amount)} from ${tenants.find(t => t.id === p.tenant_id)?.full_name || 'Unknown'}`,
      date: p.date,
    })),
    ...maintenance.slice(-2).reverse().map(m => ({
      id: m.id,
      type: 'maintenance',
      text: `Maintenance: ${m.description.slice(0, 40)}${m.description.length > 40 ? '...' : ''}`,
      date: m.date,
    })),
    ...tenants.slice(-1).map(t => ({
      id: t.id,
      type: 'tenant',
      text: `New tenant: ${t.full_name}`,
      date: t.created_at,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5);

  function expiryColor(days: number) {
    if (days <= 7) return { card: 'bg-red-50 border border-red-200', text: 'text-red-700', badge: 'bg-red-100 text-red-700' };
    if (days <= 14) return { card: 'bg-orange-50 border border-orange-200', text: 'text-orange-700', badge: 'bg-orange-100 text-orange-700' };
    return { card: 'bg-yellow-50 border border-yellow-200', text: 'text-yellow-700', badge: 'bg-yellow-100 text-yellow-700' };
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
        {properties.length > 1 && (
          <select
            value={selectedPropertyId}
            onChange={e => setSelectedPropertyId(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="all">All Properties</option>
            {properties.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {loading ? (
          <>
            <DashboardStatSkeleton />
            <DashboardStatSkeleton />
            <DashboardStatSkeleton />
            <DashboardStatSkeleton />
          </>
        ) : (
          <>
            <div className="bg-white rounded-lg shadow p-4 md:p-6">
              <p className="text-xs md:text-sm text-gray-500 mb-1">Monthly Revenue</p>
              <p className="text-xl md:text-2xl font-bold text-gray-800">{formatUGX(collectedThisMonth)}</p>
              <div className="h-1 bg-green-500 rounded mt-3" />
            </div>
            <div className="bg-white rounded-lg shadow p-4 md:p-6">
              <p className="text-xs md:text-sm text-gray-500 mb-1">Occupancy</p>
              <p className="text-xl md:text-2xl font-bold text-gray-800">{occupancyRate}%</p>
              <div className="h-1 bg-blue-500 rounded mt-3" style={{ width: `${occupancyRate}%` }} />
            </div>
            <div className="bg-white rounded-lg shadow p-4 md:p-6">
              <p className="text-xs md:text-sm text-gray-500 mb-1">Overdue</p>
              <p className="text-xl md:text-2xl font-bold text-red-600">{overduePayments}</p>
              <div className="h-1 bg-red-500 rounded mt-3" />
            </div>
            <div className="bg-white rounded-lg shadow p-4 md:p-6">
              <p className="text-xs md:text-sm text-gray-500 mb-1">Monthly Expenses</p>
              <p className="text-xl md:text-2xl font-bold text-orange-600">{formatUGX(totalExpensesThisMonth)}</p>
              <div className="h-1 bg-orange-500 rounded mt-3" />
            </div>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Revenue — Last 6 Months</h2>
          <RevenueChart data={last6Months} />
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Recent Activity</h2>
          <div className="space-y-3">
            {recentActivity.length === 0 && (
              <p className="text-gray-500 text-sm">No recent activity</p>
            )}
            {recentActivity.map((activity) => (
              <div key={`${activity.type}-${activity.id}`} className="flex items-start gap-3 pb-3 border-b border-gray-100 last:border-0">
                <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${
                  activity.type === 'payment' ? 'bg-green-500' :
                  activity.type === 'maintenance' ? 'bg-orange-500' :
                  'bg-blue-500'
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800">{activity.text}</p>
                  <p className="text-xs text-gray-500">{formatDate(activity.date)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {visibleExpiring.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            Leases Expiring Soon
            <span className="ml-2 text-sm font-normal text-gray-500">({visibleExpiring.length} lease{visibleExpiring.length !== 1 ? 's' : ''})</span>
          </h2>
          <div className="space-y-2">
            {visibleExpiring.map(l => {
              const tenant = tenants.find(t => t.id === l.tenant_id);
              const unit = units.find(u => u.id === l.unit_id);
              const property = properties.find(p => p.id === l.property_id);
              const days = daysUntil(l.end_date);
              const colors = expiryColor(days);
              return (
                <div key={l.id} className={`flex items-center justify-between p-3 rounded-lg ${colors.card}`}>
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-gray-800">{tenant?.full_name || 'Unknown'}</span>
                    <span className="text-gray-500 text-sm ml-2 hidden sm:inline">{property?.name} — {unit?.code}</span>
                  </div>
                  <div className="flex items-center gap-3 ml-3 shrink-0">
                    <span className={`text-sm font-semibold px-2 py-0.5 rounded ${colors.badge}`}>{days}d left</span>
                    <button
                      onClick={() => dismissAlert(l.id)}
                      className="text-gray-400 hover:text-gray-600 text-lg leading-none"
                      title="Dismiss"
                    >&times;</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {visibleReviews.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            Rent Reviews Due
            <span className="ml-2 text-sm font-normal text-gray-500">({visibleReviews.length} lease{visibleReviews.length !== 1 ? 's' : ''})</span>
          </h2>
          <div className="space-y-2">
            {visibleReviews.map(l => {
              const tenant = tenants.find(t => t.id === l.tenant_id);
              const unit = units.find(u => u.id === l.unit_id);
              const property = properties.find(p => p.id === l.property_id);
              const days = daysUntil(l.next_review_date!);
              return (
                <div key={l.id} className="flex items-center justify-between p-3 rounded-lg bg-orange-50 border border-orange-200">
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-gray-800">{tenant?.full_name || 'Unknown'}</span>
                    <span className="text-gray-500 text-sm ml-2 hidden sm:inline">{property?.name} — {unit?.code}</span>
                    <span className="text-gray-500 text-sm ml-2">({l.escalation_rate ?? 0}% escalation)</span>
                  </div>
                  <div className="flex items-center gap-3 ml-3 shrink-0">
                    <span className="text-sm font-semibold px-2 py-0.5 rounded bg-orange-100 text-orange-700">{days}d away</span>
                    <button onClick={() => dismissReview(l.id)} className="text-gray-400 hover:text-gray-600 text-lg leading-none" title="Dismiss">&times;</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-500 mb-1">Properties</p>
          <p className="text-2xl font-bold text-gray-800">{totalProperties}</p>
          <div className="h-1 bg-blue-500 rounded mt-3" />
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-500 mb-1">Total Units</p>
          <p className="text-2xl font-bold text-gray-800">{totalUnits}</p>
          <div className="h-1 bg-slate-500 rounded mt-3" />
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-500 mb-1">Active Leases</p>
          <p className="text-2xl font-bold text-gray-800">{activeLeases.length}</p>
          <div className="h-1 bg-emerald-500 rounded mt-3" />
        </div>
      </div>

      {!loading && totalProperties === 0 && (
        <div className="bg-white rounded-lg shadow p-12 text-center mt-6">
          <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-700 mb-1">Welcome to RentFlow Uganda</h3>
          <p className="text-gray-500 text-sm mb-5">Start by adding your first property — then add units, tenants, and leases to unlock full analytics.</p>
          <a href="/properties" className="inline-block bg-blue-600 text-white px-6 py-2.5 rounded-lg hover:bg-blue-700 transition font-medium text-sm">+ Add First Property</a>
        </div>
      )}
    </div>
  );
}
