'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from './context/AppContext';
import { formatUGX, daysUntil, formatDate } from './lib/utils';

export default function Dashboard() {
  const router = useRouter();
  const { landlord, properties, units, tenants, leases, payments, maintenance, loading } = useApp();

  // Redirect new users to onboarding
  useEffect(() => {
    if (!loading && properties.length === 0 && !landlord.name) {
      router.push('/welcome');
    }
  }, [loading, properties, landlord, router]);

  const totalProperties = properties.length;
  const totalUnits = units.length;
  const occupiedUnits = units.filter(u => u.status === 'Occupied').length;
  const activeLeases = leases.filter(l => l.status === 'Active');

  const now = new Date();
  const thisMonth = payments.filter(p => {
    const d = new Date(p.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const collectedThisMonth = thisMonth.reduce((sum, p) => sum + p.amount, 0);
  const occupancyRate = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0;

  const overduePayments = activeLeases.filter(l => {
    const today = now.getDate();
    const gracePeriodEnd = l.due_day + l.grace_period_days;
    const hasPaymentThisMonth = payments.some(p => {
      const pDate = new Date(p.date);
      return p.lease_id === l.id &&
             pDate.getMonth() === now.getMonth() &&
             pDate.getFullYear() === now.getFullYear();
    });
    return today > gracePeriodEnd && !hasPaymentThisMonth;
  }).length;

  const expiringLeases = activeLeases.filter(l => l.end_date && daysUntil(l.end_date) <= 30 && daysUntil(l.end_date) > 0);

  const last6Months = Array.from({ length: 6 }, (_, i) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const monthPayments = payments.filter(p => {
      const d = new Date(p.date);
      return d.getMonth() === date.getMonth() && d.getFullYear() === date.getFullYear();
    });
    const total = monthPayments.reduce((sum, p) => sum + p.amount, 0);
    return {
      month: date.toLocaleDateString('en-US', { month: 'short' }),
      amount: total
    };
  });
  const maxRevenue = Math.max(...last6Months.map(m => m.amount), 1);

  const recentActivity = [
    ...payments.slice(-3).reverse().map(p => ({
      id: p.id,
      type: 'payment',
      text: `Payment of ${formatUGX(p.amount)} from ${tenants.find(t => t.id === p.tenant_id)?.full_name || 'Unknown'}`,
      date: p.date
    })),
    ...maintenance.slice(-2).reverse().map(m => ({
      id: m.id,
      type: 'maintenance',
      text: `Maintenance: ${m.description.slice(0, 40)}${m.description.length > 40 ? '...' : ''}`,
      date: m.date
    })),
    ...tenants.slice(-1).map(t => ({
      id: t.id,
      type: 'tenant',
      text: `New tenant: ${t.full_name}`,
      date: t.created_at
    }))
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-500 mb-1">Monthly Revenue</p>
          <p className="text-2xl font-bold text-gray-800">{formatUGX(collectedThisMonth)}</p>
          <div className="h-1 bg-green-500 rounded mt-3" />
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-500 mb-1">Occupancy Rate</p>
          <p className="text-2xl font-bold text-gray-800">{occupancyRate}%</p>
          <div className="h-1 bg-blue-500 rounded mt-3" style={{ width: `${occupancyRate}%` }} />
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-500 mb-1">Overdue Payments</p>
          <p className="text-2xl font-bold text-red-600">{overduePayments}</p>
          <div className="h-1 bg-red-500 rounded mt-3" />
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-500 mb-1">Expiring Soon</p>
          <p className="text-2xl font-bold text-yellow-600">{expiringLeases.length}</p>
          <div className="h-1 bg-yellow-500 rounded mt-3" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Revenue - Last 6 Months</h2>
          <div className="flex items-end justify-between h-48 gap-2">
            {last6Months.map((m, i) => (
              <div key={i} className="flex-1 flex flex-col items-center justify-end">
                <div
                  className="w-full bg-blue-500 rounded-t transition-all hover:bg-blue-600"
                  style={{ height: `${(m.amount / maxRevenue) * 100}%`, minHeight: m.amount > 0 ? '8px' : '0' }}
                  title={formatUGX(m.amount)}
                />
                <p className="text-xs text-gray-600 mt-2">{m.month}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Recent Activity</h2>
          <div className="space-y-3">
            {recentActivity.length === 0 && (
              <p className="text-gray-500 text-sm">No recent activity</p>
            )}
            {recentActivity.map((activity) => (
              <div key={`${activity.type}-${activity.id}`} className="flex items-start gap-3 pb-3 border-b border-gray-100 last:border-0">
                <div className={`w-2 h-2 rounded-full mt-2 ${
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

      {expiringLeases.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Leases Expiring Within 30 Days</h2>
          <div className="space-y-2">
            {expiringLeases.map(l => {
              const tenant = tenants.find(t => t.id === l.tenant_id);
              const unit = units.find(u => u.id === l.unit_id);
              const property = properties.find(p => p.id === l.property_id);
              return (
                <div key={l.id} className="flex justify-between items-center p-3 bg-yellow-50 rounded">
                  <div>
                    <span className="font-medium">{tenant?.full_name || 'Unknown'}</span>
                    <span className="text-gray-600 text-sm ml-2">{property?.name} - {unit?.code}</span>
                  </div>
                  <span className="text-sm text-yellow-700 font-semibold">{daysUntil(l.end_date)} days</span>
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

      {totalProperties === 0 && (
        <div className="bg-white rounded-lg shadow p-12 text-center mt-6">
          <p className="text-gray-500 text-lg">No properties yet. Add your first property to get started.</p>
        </div>
      )}
    </div>
  );
}
