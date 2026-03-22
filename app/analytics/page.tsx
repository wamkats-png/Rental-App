'use client';

import { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { formatUGX } from '../lib/utils';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function monthLabel(year: number, month: number) {
  return `${MONTHS[month]} ${String(year).slice(2)}`;
}

export default function AnalyticsPage() {
  const { units, leases, payments, properties, tenants } = useApp();

  // ── Occupancy Analytics ──────────────────────────────────────────────────
  const occupancyData = useMemo(() => {
    const now = new Date();
    const data = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = d.getFullYear();
      const month = d.getMonth();
      const monthStart = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const monthEnd = new Date(year, month + 1, 0).toISOString().split('T')[0];

      const activeLeases = leases.filter(l =>
        l.start_date <= monthEnd && (l.end_date >= monthStart || !l.end_date) &&
        ['Active', 'Pending_tenant_signature', 'Pending_landlord_signature'].includes(l.status)
      );
      const occupied = new Set(activeLeases.map(l => l.unit_id)).size;
      const total = units.length;
      const rate = total > 0 ? Math.round((occupied / total) * 100) : 0;

      data.push({ month: monthLabel(year, month), occupied, total, rate });
    }
    return data;
  }, [leases, units]);

  // ── Revenue by Month (last 12) ───────────────────────────────────────────
  const revenueData = useMemo(() => {
    const now = new Date();
    const data = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = d.getFullYear();
      const month = d.getMonth();
      const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;
      const total = payments
        .filter(p => p.date.startsWith(monthStr))
        .reduce((s, p) => s + p.amount, 0);
      data.push({ month: monthLabel(year, month), revenue: total });
    }
    return data;
  }, [payments]);

  // ── 12-Month Revenue Forecast ────────────────────────────────────────────
  const forecastData = useMemo(() => {
    const now = new Date();
    const activeLeases = leases.filter(l => l.status === 'Active');
    const data = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const year = d.getFullYear();
      const month = d.getMonth();
      const monthEnd = new Date(year, month + 1, 0).toISOString().split('T')[0];
      const monthStart = `${year}-${String(month + 1).padStart(2, '0')}-01`;

      let forecast = 0;
      for (const lease of activeLeases) {
        if (lease.start_date > monthEnd || (lease.end_date && lease.end_date < monthStart)) continue;
        let amt = lease.rent_amount;
        // Apply escalation if review date is in this month
        if (lease.escalation_rate && lease.next_review_date && lease.next_review_date <= monthEnd && lease.next_review_date >= monthStart) {
          amt = amt * (1 + lease.escalation_rate / 100);
        }
        forecast += amt;
      }
      data.push({ month: monthLabel(year, month), forecast: Math.round(forecast) });
    }
    return data;
  }, [leases]);

  // ── Property Comparison ──────────────────────────────────────────────────
  const propertyComparison = useMemo(() => {
    return properties.map(prop => {
      const propUnits = units.filter(u => u.property_id === prop.id);
      const occupied = propUnits.filter(u => u.status === 'Occupied').length;
      const revenue = payments
        .filter(p => p.property_id === prop.id)
        .reduce((s, p) => s + p.amount, 0);
      return {
        name: prop.name.length > 16 ? prop.name.slice(0, 14) + '…' : prop.name,
        units: propUnits.length,
        occupied,
        occupancy: propUnits.length > 0 ? Math.round((occupied / propUnits.length) * 100) : 0,
        revenue,
      };
    });
  }, [properties, units, payments]);

  // ── Summary Stats ─────────────────────────────────────────────────────────
  const currentOccupancy = units.length > 0
    ? Math.round((units.filter(u => u.status === 'Occupied').length / units.length) * 100)
    : 0;

  const totalRevenueLTM = payments.reduce((s, p) => s + p.amount, 0);
  const avgMonthlyRevenue = Math.round(totalRevenueLTM / 12);
  const forecastNextMonth = forecastData[0]?.forecast ?? 0;

  const STAT_CARDS = [
    { label: 'Current Occupancy', value: `${currentOccupancy}%`, sub: `${units.filter(u => u.status === 'Occupied').length}/${units.length} units`, color: 'bg-blue-50 text-blue-700' },
    { label: 'Avg Monthly Revenue', value: formatUGX(avgMonthlyRevenue), sub: 'Last 12 months', color: 'bg-green-50 text-green-700' },
    { label: 'Next Month Forecast', value: formatUGX(forecastNextMonth), sub: 'Based on active leases', color: 'bg-purple-50 text-purple-700' },
    { label: 'Total Tenants', value: String(tenants.length), sub: `${leases.filter(l => l.status === 'Active').length} active leases`, color: 'bg-orange-50 text-orange-700' },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Analytics</h1>
        <p className="text-sm text-gray-500 mt-1">Occupancy rates, revenue trends, and 12-month forecasting</p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {STAT_CARDS.map(c => (
          <div key={c.label} className={`rounded-xl p-4 ${c.color}`}>
            <p className="text-2xl font-bold">{c.value}</p>
            <p className="text-sm font-medium mt-0.5">{c.label}</p>
            <p className="text-xs opacity-75 mt-0.5">{c.sub}</p>
          </div>
        ))}
      </div>

      {/* Occupancy Rate chart */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-6">
        <h2 className="text-base font-semibold text-gray-800 mb-4">Occupancy Rate — Last 12 Months</h2>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={occupancyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v) => [`${v}%`, 'Occupancy Rate']} />
            <Area type="monotone" dataKey="rate" stroke="#2563eb" fill="#dbeafe" strokeWidth={2} name="Occupancy %" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Revenue by Month + Forecast side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h2 className="text-base font-semibold text-gray-800 mb-4">Revenue — Last 12 Months</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
              <YAxis tickFormatter={v => `${Math.round(v / 1000)}k`} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v) => [formatUGX(Number(v)), 'Revenue']} />
              <Bar dataKey="revenue" fill="#16a34a" radius={[3,3,0,0]} name="Revenue" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h2 className="text-base font-semibold text-gray-800 mb-4">Revenue Forecast — Next 12 Months</h2>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={forecastData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
              <YAxis tickFormatter={v => `${Math.round(v / 1000)}k`} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v) => [formatUGX(Number(v)), 'Forecast']} />
              <Line type="monotone" dataKey="forecast" stroke="#7c3aed" strokeWidth={2} dot={false} name="Forecast" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Property comparison table */}
      {propertyComparison.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h2 className="text-base font-semibold text-gray-800 mb-4">Property Comparison</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
                <tr>
                  <th className="px-3 py-3 text-left">Property</th>
                  <th className="px-3 py-3 text-right">Units</th>
                  <th className="px-3 py-3 text-right">Occupied</th>
                  <th className="px-3 py-3 text-right">Occupancy</th>
                  <th className="px-3 py-3 text-right">Total Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {propertyComparison.map(p => (
                  <tr key={p.name}>
                    <td className="px-3 py-2 font-medium text-gray-800">{p.name}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{p.units}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{p.occupied}</td>
                    <td className="px-3 py-2 text-right">
                      <span className={`font-semibold ${p.occupancy >= 80 ? 'text-green-600' : p.occupancy >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {p.occupancy}%
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-gray-800">{formatUGX(p.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {units.length === 0 && (
        <div className="bg-white rounded-xl shadow p-12 text-center">
          <p className="text-gray-500 text-lg mb-2">No data yet</p>
          <p className="text-sm text-gray-400">Add properties, units, and leases to see analytics.</p>
        </div>
      )}
    </div>
  );
}
