'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../../components/AuthProvider';
import { supabase } from '../../lib/supabase';
import type { AuditLog } from '../../types';

const ACTION_BADGE: Record<string, string> = {
  create: 'bg-green-100 text-green-700',
  update: 'bg-blue-100 text-blue-700',
  delete: 'bg-red-100 text-red-700',
};

const ENTITY_ICONS: Record<string, string> = {
  property: '🏠', tenant: '👤', lease: '📄', payment: '💰',
  expense: '💳', maintenance: '🔧', comm_template: '📋', default: '📝',
};

export default function AuditLogPage() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterAction, setFilterAction] = useState('');
  const [filterEntity, setFilterEntity] = useState('');

  useEffect(() => {
    if (!supabase || !user) { setLoading(false); return; }
    supabase.from('audit_logs').select('*')
      .eq('landlord_id', user.id)
      .order('created_at', { ascending: false })
      .limit(200)
      .then(({ data }) => { setLogs(data ?? []); setLoading(false); });
  }, [user]);

  const entityTypes = Array.from(new Set(logs.map(l => l.entity_type)));

  const filtered = logs.filter(l => {
    if (filterAction && l.action !== filterAction) return false;
    if (filterEntity && l.entity_type !== filterEntity) return false;
    return true;
  });

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' }) +
      ' ' + d.toLocaleTimeString('en-UG', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Audit Log</h1>
        <p className="text-sm text-gray-500 mt-1">Complete history of all data changes in your account</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {(['create', 'update', 'delete'] as const).map(a => (
          <div key={a} className={`rounded-xl p-4 ${ACTION_BADGE[a]}`}>
            <p className="text-2xl font-bold">{logs.filter(l => l.action === a).length}</p>
            <p className="text-sm font-medium capitalize">{a}s</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <select value={filterAction} onChange={e => setFilterAction(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500">
          <option value="">All Actions</option>
          <option value="create">Create</option>
          <option value="update">Update</option>
          <option value="delete">Delete</option>
        </select>
        <select value={filterEntity} onChange={e => setFilterEntity(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500">
          <option value="">All Types</option>
          {entityTypes.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
        </select>
        <span className="ml-auto text-sm text-gray-500 self-center">{filtered.length} records</span>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">Loading audit log...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
          <p className="text-gray-500 font-medium mb-1">No audit entries yet</p>
          <p className="text-sm text-gray-400">Changes to properties, tenants, leases, and payments will appear here</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
                <tr>
                  <th className="px-4 py-3 text-left">When</th>
                  <th className="px-4 py-3 text-left">Action</th>
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-left">Summary</th>
                  <th className="px-4 py-3 text-left">By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(log => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{formatDate(log.created_at)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${ACTION_BADGE[log.action]}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      <span>{ENTITY_ICONS[log.entity_type] ?? ENTITY_ICONS.default} {log.entity_type}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-700 max-w-xs truncate">{log.summary}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs truncate max-w-[160px]">{log.user_email}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
