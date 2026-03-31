'use client';

import { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { daysUntil } from '../lib/utils';

interface Notification {
  id: string;
  type: 'overdue' | 'expiry' | 'maintenance';
  title: string;
  description: string;
}

export default function NotificationCenter() {
  const { leases, tenants, units, properties, maintenance } = useApp();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const now = new Date();

  const notifications: Notification[] = [];

  // Overdue rent: active leases where rent hasn't been paid this month
  leases.filter(l => l.status === 'Active').forEach(l => {
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const cappedDueDay = Math.min(l.due_day, daysInMonth);
    const dueDate = new Date(now.getFullYear(), now.getMonth(), cappedDueDay);
    const gracePeriodEnd = new Date(dueDate);
    gracePeriodEnd.setDate(gracePeriodEnd.getDate() + (l.grace_period_days || 0));
    if (now > gracePeriodEnd) {
      const tenant = tenants.find(t => t.id === l.tenant_id);
      const unit = units.find(u => u.id === l.unit_id);
      const property = properties.find(p => p.id === l.property_id);
      notifications.push({
        id: `overdue-${l.id}`,
        type: 'overdue',
        title: 'Rent overdue',
        description: `${tenant?.full_name ?? 'Unknown'} — ${property?.name ?? ''} / ${unit?.code ?? ''}`,
      });
    }
  });

  // Expiring leases: active leases expiring within 30 days
  leases.filter(l => l.status === 'Active' && l.end_date).forEach(l => {
    const days = daysUntil(l.end_date!);
    if (days >= 0 && days <= 30) {
      const tenant = tenants.find(t => t.id === l.tenant_id);
      notifications.push({
        id: `expiry-${l.id}`,
        type: 'expiry',
        title: `Lease expiring in ${days} day${days !== 1 ? 's' : ''}`,
        description: `${tenant?.full_name ?? 'Unknown'} — renew before ${l.end_date}`,
      });
    }
  });

  // Open maintenance requests
  maintenance.filter(m => m.status === 'Open' || m.status === 'In Progress').forEach(m => {
    const unit = units.find(u => u.id === m.unit_id);
    const property = properties.find(p => p.id === m.property_id);
    notifications.push({
      id: `maint-${m.id}`,
      type: 'maintenance',
      title: `${m.status === 'In Progress' ? 'In progress' : 'Open'}: ${m.category}`,
      description: `${property?.name ?? ''} / ${unit?.code ?? ''} — ${m.description.slice(0, 50)}${m.description.length > 50 ? '…' : ''}`,
    });
  });

  const count = notifications.length;

  const iconColor = (type: Notification['type']) => {
    if (type === 'overdue') return 'text-red-500 bg-red-50';
    if (type === 'expiry') return 'text-yellow-500 bg-yellow-50';
    return 'text-blue-500 bg-blue-50';
  };

  const icon = (type: Notification['type']) => {
    if (type === 'overdue') return (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    );
    if (type === 'expiry') return (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    );
    return (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    );
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(prev => !prev)}
        className="relative p-2 rounded-lg hover:bg-blue-800 transition-colors"
        aria-label="Notifications"
      >
        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold leading-none">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 w-80 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden">
          <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700">Notifications</h3>
            {count > 0 && <span className="text-xs text-gray-500">{count} item{count !== 1 ? 's' : ''}</span>}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <svg className="w-10 h-10 text-gray-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-gray-500">All clear — no alerts</p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-50">
                {notifications.map(n => (
                  <li key={n.id} className="px-4 py-3 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start gap-3">
                      <span className={`mt-0.5 p-1.5 rounded-lg flex-shrink-0 ${iconColor(n.type)}`}>
                        {icon(n.type)}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-gray-700">{n.title}</p>
                        <p className="text-xs text-gray-500 truncate">{n.description}</p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
