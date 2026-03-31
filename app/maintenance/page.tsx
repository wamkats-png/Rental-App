'use client';

import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { formatUGX, formatDate } from '../lib/utils';
import { exportToCSV } from '../lib/csvExport';
import Toast from '../components/Toast';
import { MaintenanceRowSkeleton } from '../components/Skeleton';
import { MaintenanceCategory, MaintenancePayer, MaintenanceStatus, MaintenancePriority } from '../types';

const CATEGORIES: MaintenanceCategory[] = ['Plumbing', 'Electrical', 'Structural', 'Other'];
const PAYERS: MaintenancePayer[] = ['Landlord', 'Tenant'];
const STATUSES: MaintenanceStatus[] = ['Open', 'In Progress', 'Resolved'];
const PRIORITIES: MaintenancePriority[] = ['Low', 'Medium', 'High'];

const STATUS_STYLE: Record<MaintenanceStatus, string> = {
  'Open':        'bg-red-100 text-red-700',
  'In Progress': 'bg-yellow-100 text-yellow-700',
  'Resolved':    'bg-green-100 text-green-700',
};
const PRIORITY_STYLE: Record<MaintenancePriority, string> = {
  Low:    'bg-gray-100 text-gray-600',
  Medium: 'bg-orange-100 text-orange-700',
  High:   'bg-red-100 text-red-700',
};

const STATUS_NEXT: Record<MaintenanceStatus, MaintenanceStatus> = {
  'Open': 'In Progress',
  'In Progress': 'Resolved',
  'Resolved': 'Open',
};

const defaultForm = {
  landlord_id: '', property_id: '', unit_id: '',
  date: new Date().toISOString().split('T')[0],
  description: '', category: 'Other' as MaintenanceCategory,
  vendor: '', cost: 0, payer: 'Landlord' as MaintenancePayer,
  status: 'Open' as MaintenanceStatus, priority: 'Medium' as MaintenancePriority,
  resolved_date: '',
};

export default function MaintenancePage() {
  const { properties, units, maintenance, loading, landlord, addMaintenance, updateMaintenance, deleteMaintenance } = useApp();
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [filterCategory, setFilterCategory] = useState('');
  const [filterProperty, setFilterProperty] = useState('');
  const [filterPayer, setFilterPayer] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [toast, setToast] = useState('');

  const unitsForProperty = units.filter(u => u.property_id === form.property_id);

  let filtered = maintenance;
  if (filterCategory) filtered = filtered.filter(m => m.category === filterCategory);
  if (filterProperty) filtered = filtered.filter(m => m.property_id === filterProperty);
  if (filterPayer) filtered = filtered.filter(m => m.payer === filterPayer);
  if (filterStatus) filtered = filtered.filter(m => (m.status ?? 'Open') === filterStatus);
  if (filterPriority) filtered = filtered.filter(m => (m.priority ?? 'Medium') === filterPriority);
  const sorted = [...filtered].sort((a, b) => {
    // Sort: High priority Open first, then by date
    const priorityOrder = { High: 0, Medium: 1, Low: 2 };
    const statusOrder = { Open: 0, 'In Progress': 1, Resolved: 2 };
    const ap = priorityOrder[a.priority ?? 'Medium'];
    const bp = priorityOrder[b.priority ?? 'Medium'];
    if (ap !== bp) return ap - bp;
    const as_ = statusOrder[a.status ?? 'Open'];
    const bs_ = statusOrder[b.status ?? 'Open'];
    if (as_ !== bs_) return as_ - bs_;
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  const totalCost = sorted.reduce((s, m) => s + m.cost, 0);
  const landlordCost = sorted.filter(m => m.payer === 'Landlord').reduce((s, m) => s + m.cost, 0);
  const tenantCost = sorted.filter(m => m.payer === 'Tenant').reduce((s, m) => s + m.cost, 0);
  const openCount = maintenance.filter(m => !m.status || m.status === 'Open').length;

  const openAdd = () => {
    setEditingId(null);
    setForm({ ...defaultForm, landlord_id: landlord.id });
    setShowModal(true);
  };
  const openEdit = (m: typeof maintenance[0]) => {
    setEditingId(m.id);
    setForm({
      landlord_id: m.landlord_id, property_id: m.property_id, unit_id: m.unit_id,
      date: m.date, description: m.description, category: m.category,
      vendor: m.vendor, cost: m.cost, payer: m.payer,
      status: m.status ?? 'Open', priority: m.priority ?? 'Medium',
      resolved_date: m.resolved_date ?? '',
    });
    setShowModal(true);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: name === 'cost' ? Number(value) : value,
      ...(name === 'property_id' ? { unit_id: '' } : {}),
      ...(name === 'status' && value === 'Resolved' && !prev.resolved_date ? { resolved_date: new Date().toISOString().split('T')[0] } : {}),
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.property_id || !form.description) return;
    if (editingId) {
      updateMaintenance(editingId, form);
    } else {
      addMaintenance(form);
    }
    setShowModal(false); setEditingId(null); setForm(defaultForm);
    setToast(editingId ? 'Record updated' : 'Maintenance record added');
  };

  const cycleStatus = (id: string, current: MaintenanceStatus) => {
    const next = STATUS_NEXT[current];
    updateMaintenance(id, {
      status: next,
      ...(next === 'Resolved' ? { resolved_date: new Date().toISOString().split('T')[0] } : {}),
    });
  };

  const handleExport = () => {
    exportToCSV(sorted.map(m => ({
      Date: m.date, Property: properties.find(p => p.id === m.property_id)?.name || '',
      Unit: units.find(u => u.id === m.unit_id)?.code || '', Description: m.description,
      Category: m.category, Vendor: m.vendor, Cost: m.cost, Payer: m.payer,
      Status: m.status ?? 'Open', Priority: m.priority ?? 'Medium',
      Resolved_Date: m.resolved_date ?? '',
    })), 'maintenance');
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Maintenance</h1>
          <p className="text-sm text-gray-500 mt-1">Track property maintenance, repairs, and issue status</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExport} className="bg-gray-100 text-gray-700 px-4 py-2.5 rounded-lg hover:bg-gray-200 transition font-medium text-sm">Export CSV</button>
          <button onClick={openAdd} className="bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 transition font-medium">+ Add Record</button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Total Cost</p>
          <p className="text-2xl font-bold text-gray-800">{formatUGX(totalCost)}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Landlord Costs</p>
          <p className="text-2xl font-bold text-red-600">{formatUGX(landlordCost)}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Tenant Costs</p>
          <p className="text-2xl font-bold text-blue-600">{formatUGX(tenantCost)}</p>
        </div>
        <div className={`rounded-lg shadow p-4 ${openCount > 0 ? 'bg-red-50' : 'bg-green-50'}`}>
          <p className="text-sm text-gray-500">Open Issues</p>
          <p className={`text-2xl font-bold ${openCount > 0 ? 'text-red-600' : 'text-green-600'}`}>{openCount}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6 flex flex-wrap gap-4">
        {[
          { label: 'Property', value: filterProperty, setter: setFilterProperty, options: properties.map(p => ({ v: p.id, l: p.name })) },
          { label: 'Category', value: filterCategory, setter: setFilterCategory, options: CATEGORIES.map(c => ({ v: c, l: c })) },
          { label: 'Status', value: filterStatus, setter: setFilterStatus, options: STATUSES.map(s => ({ v: s, l: s })) },
          { label: 'Priority', value: filterPriority, setter: setFilterPriority, options: PRIORITIES.map(p => ({ v: p, l: p })) },
          { label: 'Payer', value: filterPayer, setter: setFilterPayer, options: PAYERS.map(p => ({ v: p, l: p })) },
        ].map(({ label, value, setter, options }) => (
          <div key={label}>
            <label className="block text-xs text-gray-500 mb-1">{label}</label>
            <select value={value} onChange={e => setter(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
              <option value="">All</option>
              {options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
            </select>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="w-full text-sm">
            <tbody>
              {[...Array(4)].map((_, i) => <MaintenanceRowSkeleton key={i} />)}
            </tbody>
          </table>
        </div>
      ) : sorted.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          {maintenance.length === 0 ? (
            <>
              <div className="w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-700 mb-1">No maintenance requests yet</h3>
              <p className="text-gray-500 text-sm mb-5">Log repairs and maintenance jobs to track costs, status, and vendor assignments.</p>
              <button onClick={() => setShowModal(true)} className="bg-blue-600 text-white px-6 py-2.5 rounded-lg hover:bg-blue-700 transition font-medium text-sm">+ Log First Request</button>
            </>
          ) : (
            <>
              <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 4a1 1 0 011-1h16a1 1 0 010 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h16a1 1 0 010 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h10a1 1 0 010 2H4a1 1 0 01-1-1z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-700 mb-1">No records match filters</h3>
              <p className="text-gray-500 text-sm">Try changing the status, priority, or category filter.</p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map(m => {
            const status: MaintenanceStatus = m.status ?? 'Open';
            const priority: MaintenancePriority = m.priority ?? 'Medium';
            return (
              <div key={m.id} className="bg-white rounded-lg shadow p-5 hover:shadow-md transition">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <button
                        onClick={() => cycleStatus(m.id, status)}
                        className={`px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer hover:opacity-80 transition ${STATUS_STYLE[status]}`}
                        title="Click to advance status"
                      >
                        {status}
                      </button>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_STYLE[priority]}`}>{priority}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        m.category === 'Plumbing' ? 'bg-blue-100 text-blue-700' :
                        m.category === 'Electrical' ? 'bg-yellow-100 text-yellow-700' :
                        m.category === 'Structural' ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>{m.category}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${m.payer === 'Landlord' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>{m.payer} pays</span>
                      <span className="text-xs text-gray-400">{formatDate(m.date)}</span>
                      {m.resolved_date && <span className="text-xs text-green-600">Resolved {formatDate(m.resolved_date)}</span>}
                    </div>
                    <p className="text-gray-800 font-medium mb-1">{m.description}</p>
                    <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                      <span>{properties.find(p => p.id === m.property_id)?.name || 'Unknown'}</span>
                      {m.unit_id && <span>Unit: {units.find(u => u.id === m.unit_id)?.code}</span>}
                      {m.vendor && <span>Vendor: {m.vendor}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 ml-4 shrink-0">
                    <span className="text-lg font-bold text-gray-800">{formatUGX(m.cost)}</span>
                    <button onClick={() => openEdit(m)} className="text-blue-600 hover:text-blue-800 text-sm font-medium">Edit</button>
                    {deleteConfirmId === m.id ? (
                      <>
                        <button onClick={() => { deleteMaintenance(m.id); setDeleteConfirmId(null); }} className="bg-red-600 text-white px-2 py-1 rounded text-xs">Yes</button>
                        <button onClick={() => setDeleteConfirmId(null)} className="text-gray-600 text-xs">No</button>
                      </>
                    ) : (
                      <button onClick={() => setDeleteConfirmId(m.id)} className="text-red-600 hover:text-red-800 text-sm font-medium">Delete</button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg my-8">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-bold text-gray-800">{editingId ? 'Edit Record' : 'Add Maintenance Record'}</h2>
              <button onClick={() => { setShowModal(false); setEditingId(null); }} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Property *</label>
                  <select name="property_id" value={form.property_id} onChange={handleChange} required className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500">
                    <option value="">Select</option>
                    {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                  <select name="unit_id" value={form.unit_id} onChange={handleChange} disabled={!form.property_id} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50">
                    <option value="">All / General</option>
                    {unitsForProperty.map(u => <option key={u.id} value={u.id}>{u.code}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
                <textarea name="description" value={form.description} onChange={handleChange} required rows={3} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" placeholder="Describe the maintenance work..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <input type="date" name="date" value={form.date} onChange={handleChange} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select name="category" value={form.category} onChange={handleChange} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500">
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select name="status" value={form.status} onChange={handleChange} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500">
                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                  <select name="priority" value={form.priority} onChange={handleChange} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500">
                    {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              {form.status === 'Resolved' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Resolved Date</label>
                  <input type="date" name="resolved_date" value={form.resolved_date} onChange={handleChange} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" />
                </div>
              )}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Vendor</label>
                  <input type="text" name="vendor" value={form.vendor} onChange={handleChange} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" placeholder="Vendor name" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cost (UGX)</label>
                  <input type="number" name="cost" value={form.cost || ''} onChange={handleChange} min={0} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Payer</label>
                  <select name="payer" value={form.payer} onChange={handleChange} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500">
                    {PAYERS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button type="button" onClick={() => { setShowModal(false); setEditingId(null); }} className="px-5 py-2.5 text-gray-600 hover:bg-gray-100 rounded-lg font-medium">Cancel</button>
                <button type="submit" className="bg-blue-600 text-white px-6 py-2.5 rounded-lg hover:bg-blue-700 font-medium">{editingId ? 'Update' : 'Add Record'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {toast && <Toast message={toast} onDismiss={() => setToast('')} />}
    </div>
  );
}
