'use client';

import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { formatDate, calculateTenantScore } from '../lib/utils';
import Toast from '../components/Toast';
import { TenantRowSkeleton } from '../components/Skeleton';
import { exportToCSV } from '../lib/csvExport';
import { CommPreference, CommunicationType } from '../types';
import { validateTenant } from '../lib/schemas';

const COMM_PREFS: CommPreference[] = ['WhatsApp', 'Email', 'SMS'];
const COMM_TYPES: CommunicationType[] = ['SMS', 'Email', 'Call', 'WhatsApp'];

const defaultForm = {
  full_name: '', phone: '', email: '', national_id: '', address: '', comm_preference: 'WhatsApp' as CommPreference,
};

export default function TenantsPage() {
  const { tenants, loading, addTenant, updateTenant, deleteTenant, communicationLogs, addCommunicationLog, payments, leases } = useApp();
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [search, setSearch] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [selectedTenant, setSelectedTenant] = useState<string | null>(null);
  const [commForm, setCommForm] = useState({ date: new Date().toISOString().split('T')[0], type: 'WhatsApp' as CommunicationType, note: '' });
  const [toast, setToast] = useState('');
  const [formErrors, setFormErrors] = useState<Partial<Record<'full_name' | 'phone' | 'email', string>>>({});
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  const filtered = tenants.filter(t =>
    t.full_name.toLowerCase().includes(search.toLowerCase()) ||
    t.phone.includes(search) ||
    t.email.toLowerCase().includes(search.toLowerCase())
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const openAdd = () => { setEditingId(null); setForm(defaultForm); setFormErrors({}); setShowModal(true); };
  const openEdit = (t: typeof tenants[0]) => {
    setEditingId(t.id);
    setForm({ full_name: t.full_name, phone: t.phone, email: t.email, national_id: t.national_id, address: t.address, comm_preference: t.comm_preference });
    setFormErrors({});
    setShowModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = validateTenant({ full_name: form.full_name, phone: form.phone, email: form.email });
    if (!result.valid) { setFormErrors(result.errors); return; }
    setFormErrors({});
    if (editingId) {
      updateTenant(editingId, form);
    } else {
      addTenant(form);
    }
    setShowModal(false); setEditingId(null); setForm(defaultForm);
    setToast(editingId ? 'Tenant updated successfully' : 'Tenant added successfully');
  };

  const handleDelete = (id: string) => {
    deleteTenant(id);
    setDeleteConfirmId(null);
    if (selectedTenant === id) setSelectedTenant(null);
  };

  const handleCommSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTenant || !commForm.note) return;
    addCommunicationLog({ tenant_id: selectedTenant, date: commForm.date, type: commForm.type, note: commForm.note });
    setCommForm({ date: new Date().toISOString().split('T')[0], type: 'WhatsApp', note: '' });
  };

  const handleExport = () => {
    exportToCSV(tenants.map(t => ({
      Name: t.full_name, Phone: t.phone, Email: t.email,
      National_ID: t.national_id, Address: t.address, Preference: t.comm_preference,
    })), 'tenants');
  };

  const tenantLogs = selectedTenant
    ? communicationLogs.filter(c => c.tenant_id === selectedTenant).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    : [];

  return (
    <div>
      {toast && <Toast message={toast} onDismiss={() => setToast('')} />}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Tenants</h1>
          <p className="text-sm text-gray-500 mt-1">Manage tenants and communication</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExport} className="bg-gray-100 text-gray-700 px-4 py-2.5 rounded-lg hover:bg-gray-200 transition font-medium text-sm hidden sm:block">Export CSV</button>
          <button onClick={openAdd} className="bg-blue-600 text-white px-4 sm:px-5 py-2.5 rounded-lg hover:bg-blue-700 transition font-medium text-sm sm:text-base">+ Add Tenant</button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <input type="text" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search by name, phone, or email..." className="w-full border rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className={selectedTenant ? 'lg:col-span-2' : 'lg:col-span-3'}>
          {loading ? (
            <div className="bg-white rounded-lg shadow overflow-x-auto">
              <table className="w-full text-sm">
                <tbody>
                  {[...Array(5)].map((_, i) => <TenantRowSkeleton key={i} />)}
                </tbody>
              </table>
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              {tenants.length === 0 ? (
                <>
                  <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-700 mb-1">No tenants yet</h3>
                  <p className="text-gray-500 text-sm mb-5">Add tenants to track their leases, payments, and communication history.</p>
                  <button onClick={openAdd} className="bg-blue-600 text-white px-6 py-2.5 rounded-lg hover:bg-blue-700 transition font-medium text-sm">+ Add First Tenant</button>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-700 mb-1">No tenants match your search</h3>
                  <p className="text-gray-500 text-sm">Try a different name, phone number, or email address.</p>
                </>
              )}
            </div>
          ) : (
            <>
              {/* Mobile cards */}
              <div className="md:hidden space-y-3">
                {paginated.map(t => (
                  <div
                    key={t.id}
                    className={`bg-white rounded-lg shadow p-4 cursor-pointer transition-colors ${selectedTenant === t.id ? 'ring-2 ring-blue-500' : ''}`}
                    onClick={() => setSelectedTenant(selectedTenant === t.id ? null : t.id)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-gray-800">{t.full_name}</p>
                        <p className="text-sm text-gray-600">{t.phone}</p>
                        <p className="text-xs text-gray-400 truncate">{t.email}</p>
                      </div>
                      <span className="px-2 py-0.5 bg-gray-100 rounded text-xs ml-3 shrink-0">{t.comm_preference}</span>
                    </div>
                    {t.national_id && <p className="text-xs text-gray-400 mb-3">ID: {t.national_id}</p>}
                    <div className="flex items-center gap-3" onClick={e => e.stopPropagation()}>
                      <button onClick={() => openEdit(t)} className="text-blue-600 text-sm font-medium">Edit</button>
                      {deleteConfirmId === t.id ? (
                        <>
                          <button onClick={() => handleDelete(t.id)} className="bg-red-600 text-white px-2 py-1 rounded text-xs">Yes, delete</button>
                          <button onClick={() => setDeleteConfirmId(null)} className="text-gray-600 text-xs">Cancel</button>
                        </>
                      ) : (
                        <button onClick={() => setDeleteConfirmId(t.id)} className="text-red-600 text-sm font-medium">Delete</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop table */}
              <div className="hidden md:block bg-white rounded-lg shadow overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Name</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Phone</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Email</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">National ID</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Pref</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Score</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map(t => (
                      <tr key={t.id} className={`border-b border-gray-50 hover:bg-gray-50 cursor-pointer ${selectedTenant === t.id ? 'bg-blue-50' : ''}`} onClick={() => setSelectedTenant(selectedTenant === t.id ? null : t.id)}>
                        <td className="py-3 px-4 font-medium">{t.full_name}</td>
                        <td className="py-3 px-4">{t.phone}</td>
                        <td className="py-3 px-4 text-gray-600">{t.email}</td>
                        <td className="py-3 px-4 text-xs text-gray-500">{t.national_id}</td>
                        <td className="py-3 px-4"><span className="px-2 py-0.5 bg-gray-100 rounded text-xs">{t.comm_preference}</span></td>
                        <td className="py-3 px-4">
                          {(() => {
                            const { score, grade, label } = calculateTenantScore(t.id, payments, leases);
                            if (score === 0) return <span className="text-xs text-gray-400">—</span>;
                            const cls = grade === 'A' ? 'bg-green-100 text-green-700' : grade === 'B' ? 'bg-blue-100 text-blue-700' : grade === 'C' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700';
                            return <span className={`px-2 py-0.5 rounded text-xs font-bold ${cls}`} title={label}>{grade} {score}</span>;
                          })()}
                        </td>
                        <td className="py-3 px-4 text-right" onClick={e => e.stopPropagation()}>
                          <button onClick={() => openEdit(t)} className="text-blue-600 hover:text-blue-800 text-sm mr-2">Edit</button>
                          {deleteConfirmId === t.id ? (
                            <>
                              <button onClick={() => handleDelete(t.id)} className="bg-red-600 text-white px-2 py-1 rounded text-xs mr-1">Yes</button>
                              <button onClick={() => setDeleteConfirmId(null)} className="text-gray-600 text-xs">No</button>
                            </>
                          ) : (
                            <button onClick={() => setDeleteConfirmId(t.id)} className="text-red-600 hover:text-red-800 text-sm">Delete</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {!loading && filtered.length > PAGE_SIZE && (
            <div className="flex items-center justify-between mt-4 px-1">
              <p className="text-sm text-gray-500">Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}</p>
              <div className="flex gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1.5 text-sm rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-50 transition">Previous</button>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1.5 text-sm rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-50 transition">Next</button>
              </div>
            </div>
          )}
        </div>

        {selectedTenant && (
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-800">Communication Log</h3>
                  <p className="text-sm text-gray-500">{tenants.find(t => t.id === selectedTenant)?.full_name}</p>
                </div>
                {(() => {
                  const { score, grade, label } = calculateTenantScore(selectedTenant, payments, leases);
                  if (score === 0) return null;
                  const cls = grade === 'A' ? 'bg-green-100 text-green-700 border-green-200' : grade === 'B' ? 'bg-blue-100 text-blue-700 border-blue-200' : grade === 'C' ? 'bg-yellow-100 text-yellow-700 border-yellow-200' : 'bg-red-100 text-red-700 border-red-200';
                  return (
                    <div className={`text-center px-3 py-1 rounded-lg border ${cls}`}>
                      <p className="text-lg font-bold">{grade}</p>
                      <p className="text-xs">{score}/100</p>
                      <p className="text-xs opacity-75">{label}</p>
                    </div>
                  );
                })()}
              </div>
            </div>
            <form onSubmit={handleCommSubmit} className="p-4 border-b space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <input type="date" value={commForm.date} onChange={e => setCommForm({ ...commForm, date: e.target.value })} className="border rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500" />
                <select value={commForm.type} onChange={e => setCommForm({ ...commForm, type: e.target.value as CommunicationType })} className="border rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500">
                  {COMM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <textarea value={commForm.note} onChange={e => setCommForm({ ...commForm, note: e.target.value })} placeholder="Add note..." rows={2} className="w-full border rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500" />
              <button type="submit" className="w-full bg-blue-600 text-white py-1.5 rounded text-sm hover:bg-blue-700">Add Log</button>
            </form>
            <div className="p-4 max-h-80 overflow-y-auto">
              {tenantLogs.length === 0 ? (
                <p className="text-gray-500 text-sm text-center">No communication logs yet.</p>
              ) : (
                <div className="space-y-3">
                  {tenantLogs.map(log => (
                    <div key={log.id} className="border-b border-gray-50 pb-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          log.type === 'Call' ? 'bg-green-100 text-green-700' :
                          log.type === 'SMS' ? 'bg-blue-100 text-blue-700' :
                          log.type === 'Email' ? 'bg-purple-100 text-purple-700' :
                          'bg-emerald-100 text-emerald-700'
                        }`}>{log.type}</span>
                        <span className="text-xs text-gray-400">{formatDate(log.date)}</span>
                      </div>
                      <p className="text-sm text-gray-700">{log.note}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-bold text-gray-800">{editingId ? 'Edit Tenant' : 'Add Tenant'}</h2>
              <button onClick={() => { setShowModal(false); setEditingId(null); }} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                <input type="text" value={form.full_name} onChange={e => { setForm({ ...form, full_name: e.target.value }); setFormErrors(prev => ({ ...prev, full_name: undefined })); }} className={`w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent ${formErrors.full_name ? 'border-red-400' : ''}`} placeholder="John Doe" />
                {formErrors.full_name && <p className="text-red-500 text-xs mt-1">{formErrors.full_name}</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
                  <input type="tel" value={form.phone} onChange={e => { setForm({ ...form, phone: e.target.value }); setFormErrors(prev => ({ ...prev, phone: undefined })); }} className={`w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent ${formErrors.phone ? 'border-red-400' : ''}`} placeholder="0701234567" />
                  {formErrors.phone && <p className="text-red-500 text-xs mt-1">{formErrors.phone}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input type="text" value={form.email} onChange={e => { setForm({ ...form, email: e.target.value }); setFormErrors(prev => ({ ...prev, email: undefined })); }} className={`w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent ${formErrors.email ? 'border-red-400' : ''}`} placeholder="email@example.com" />
                  {formErrors.email && <p className="text-red-500 text-xs mt-1">{formErrors.email}</p>}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">National ID</label>
                  <input type="text" value={form.national_id} onChange={e => setForm({ ...form, national_id: e.target.value })} className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="CM12345678ABCD" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Comm Preference</label>
                  <select value={form.comm_preference} onChange={e => setForm({ ...form, comm_preference: e.target.value as CommPreference })} className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                    {COMM_PREFS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <input type="text" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="Current address" />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button type="button" onClick={() => { setShowModal(false); setEditingId(null); }} className="px-5 py-2.5 text-gray-600 hover:bg-gray-100 rounded-lg font-medium">Cancel</button>
                <button type="submit" className="bg-blue-600 text-white px-6 py-2.5 rounded-lg hover:bg-blue-700 font-medium">{editingId ? 'Update' : 'Add Tenant'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
