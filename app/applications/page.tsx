'use client';

import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { formatDate } from '../lib/utils';
import Toast from '../components/Toast';

type AppStatus = 'Pending' | 'Approved' | 'Rejected';

const STATUS_STYLE: Record<AppStatus, string> = {
  Pending:  'bg-yellow-100 text-yellow-800',
  Approved: 'bg-green-100 text-green-800',
  Rejected: 'bg-red-100 text-red-800',
};

const defaultForm = {
  unit_id: '',
  applicant_name: '',
  applicant_phone: '',
  applicant_email: '',
  applicant_national_id: '',
  applicant_address: '',
  employment: '',
  references: '',
  desired_move_in: '',
  status: 'Pending' as AppStatus,
};

export default function ApplicationsPage() {
  const {
    properties, units, tenants,
    applications, loading,
    addApplication, updateApplication, deleteApplication,
    addTenant,
  } = useApp();

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [propertyFilter, setPropertyFilter] = useState('');
  const [filterStatus, setFilterStatus] = useState<AppStatus | 'All'>('All');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [convertConfirmId, setConvertConfirmId] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Units for selected property in form
  const formPropertyUnits = units.filter(u => u.property_id === propertyFilter);

  const filtered = applications.filter(a => {
    const matchStatus = filterStatus === 'All' || a.status === filterStatus;
    const unit = units.find(u => u.id === a.unit_id);
    const matchProperty = !propertyFilter || unit?.property_id === propertyFilter;
    return matchStatus && matchProperty;
  });

  const pendingCount = applications.filter(a => a.status === 'Pending').length;

  const openAdd = () => {
    setEditingId(null);
    setForm(defaultForm);
    setShowModal(true);
  };

  const openEdit = (app: typeof applications[0]) => {
    const unit = units.find(u => u.id === app.unit_id);
    setPropertyFilter(unit?.property_id ?? '');
    setEditingId(app.id);
    setForm({
      unit_id: app.unit_id,
      applicant_name: app.applicant_name,
      applicant_phone: app.applicant_phone,
      applicant_email: app.applicant_email,
      applicant_national_id: app.applicant_national_id,
      applicant_address: app.applicant_address,
      employment: app.employment,
      references: app.references,
      desired_move_in: app.desired_move_in,
      status: app.status,
    });
    setShowModal(true);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || !form.unit_id || !form.applicant_name) return;
    setSubmitting(true);
    try {
      if (editingId) {
        updateApplication(editingId, form);
        setToast('Application updated');
      } else {
        addApplication(form);
        setToast('Application submitted');
      }
      setShowModal(false);
      setEditingId(null);
      setForm(defaultForm);
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = (id: string, status: AppStatus) => {
    updateApplication(id, { status });
    setToast(`Status updated to ${status}`);
  };

  const handleDelete = (id: string) => {
    deleteApplication(id);
    setDeleteConfirmId(null);
    setToast('Application deleted');
  };

  const handleConvertToTenant = async (appId: string) => {
    const app = applications.find(a => a.id === appId);
    if (!app) return;
    await addTenant({
      full_name: app.applicant_name,
      phone: app.applicant_phone,
      email: app.applicant_email,
      national_id: app.applicant_national_id,
      address: app.applicant_address,
      comm_preference: 'WhatsApp',
    });
    updateApplication(appId, { status: 'Approved' });
    setConvertConfirmId(null);
    setToast(`${app.applicant_name} added as a tenant`);
  };

  const getUnitLabel = (unitId: string) => {
    const unit = units.find(u => u.id === unitId);
    const prop = unit ? properties.find(p => p.id === unit.property_id) : null;
    if (!unit) return 'Unknown unit';
    return `${prop?.name ?? 'Unknown'} — Unit ${unit.code}`;
  };

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Applications</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Manage tenant rental applications
            {pendingCount > 0 && (
              <span className="ml-2 bg-yellow-100 text-yellow-800 text-xs px-2 py-0.5 rounded-full font-medium">
                {pendingCount} pending
              </span>
            )}
          </p>
        </div>
        <button
          onClick={openAdd}
          className="bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 transition font-medium"
        >
          + New Application
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6 flex flex-wrap gap-3 items-center">
        <select
          value={propertyFilter}
          onChange={e => setPropertyFilter(e.target.value)}
          className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white"
        >
          <option value="">All Properties</option>
          {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <div className="flex gap-2 flex-wrap">
          {(['All', 'Pending', 'Approved', 'Rejected'] as const).map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${filterStatus === s ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
            >
              {s}{s === 'All' ? ` (${applications.length})` : ''}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center text-gray-500">Loading applications…</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
          <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-1">No applications yet</h3>
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-5">Record prospective tenant applications to track them before converting to active leases.</p>
          <button onClick={openAdd} className="bg-blue-600 text-white px-6 py-2.5 rounded-lg hover:bg-blue-700 transition font-medium text-sm">+ New Application</button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(app => (
            <div key={app.id} className="bg-white dark:bg-gray-800 rounded-lg shadow p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1 flex-wrap">
                    <h3 className="text-base font-semibold text-gray-800 dark:text-white">{app.applicant_name}</h3>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLE[app.status]}`}>{app.status}</span>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">{getUnitLabel(app.unit_id)}</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                    {app.applicant_phone && (
                      <div><p className="text-gray-400 text-xs uppercase tracking-wide">Phone</p><p className="font-medium dark:text-gray-200">{app.applicant_phone}</p></div>
                    )}
                    {app.applicant_email && (
                      <div><p className="text-gray-400 text-xs uppercase tracking-wide">Email</p><p className="font-medium dark:text-gray-200 truncate">{app.applicant_email}</p></div>
                    )}
                    {app.desired_move_in && (
                      <div><p className="text-gray-400 text-xs uppercase tracking-wide">Move-in</p><p className="font-medium dark:text-gray-200">{formatDate(app.desired_move_in)}</p></div>
                    )}
                    {app.employment && (
                      <div><p className="text-gray-400 text-xs uppercase tracking-wide">Employment</p><p className="font-medium dark:text-gray-200">{app.employment}</p></div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
                  <select
                    value={app.status}
                    onChange={e => handleStatusChange(app.id, e.target.value as AppStatus)}
                    className="text-xs border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-700 dark:text-white"
                  >
                    <option value="Pending">Pending</option>
                    <option value="Approved">Approved</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                  <button onClick={() => openEdit(app)} className="text-blue-600 hover:text-blue-800 text-sm font-medium px-2">Edit</button>
                  {app.status === 'Approved' && (
                    <>
                      {convertConfirmId === app.id ? (
                        <>
                          <button
                            onClick={() => handleConvertToTenant(app.id)}
                            className="bg-green-600 text-white px-3 py-1 rounded text-sm font-medium"
                          >
                            Confirm
                          </button>
                          <button onClick={() => setConvertConfirmId(null)} className="text-gray-500 text-sm">Cancel</button>
                        </>
                      ) : (
                        <button
                          onClick={() => setConvertConfirmId(app.id)}
                          className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-green-700 transition"
                        >
                          Convert to Tenant
                        </button>
                      )}
                    </>
                  )}
                  {deleteConfirmId === app.id ? (
                    <>
                      <button onClick={() => handleDelete(app.id)} className="bg-red-600 text-white px-3 py-1 rounded text-sm">Confirm</button>
                      <button onClick={() => setDeleteConfirmId(null)} className="text-gray-500 text-sm">Cancel</button>
                    </>
                  ) : (
                    <button onClick={() => setDeleteConfirmId(app.id)} className="text-red-500 hover:text-red-700 text-sm font-medium px-2">Delete</button>
                  )}
                </div>
              </div>
              {app.references && (
                <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">References</p>
                  <p className="text-sm text-gray-600 dark:text-gray-300">{app.references}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg my-8">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-white">
                {editingId ? 'Edit Application' : 'New Application'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-2xl leading-none">&times;</button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Property</label>
                  <select
                    value={propertyFilter}
                    onChange={e => { setPropertyFilter(e.target.value); setForm(prev => ({ ...prev, unit_id: '' })); }}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white"
                    required
                  >
                    <option value="">Select property…</option>
                    {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Unit <span className="text-red-500">*</span></label>
                  <select
                    name="unit_id"
                    value={form.unit_id}
                    onChange={handleChange}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white"
                    required
                  >
                    <option value="">Select unit…</option>
                    {formPropertyUnits.map(u => (
                      <option key={u.id} value={u.id}>{u.code}{u.description ? ` — ${u.description}` : ''}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Applicant Name <span className="text-red-500">*</span></label>
                  <input name="applicant_name" value={form.applicant_name} onChange={handleChange} required placeholder="Full name"
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone</label>
                  <input name="applicant_phone" value={form.applicant_phone} onChange={handleChange} placeholder="+256 700 000000" type="tel"
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                  <input name="applicant_email" value={form.applicant_email} onChange={handleChange} placeholder="email@example.com" type="email"
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">National ID</label>
                  <input name="applicant_national_id" value={form.applicant_national_id} onChange={handleChange} placeholder="CM12345678ABCDE"
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Desired Move-in</label>
                  <input name="desired_move_in" value={form.desired_move_in} onChange={handleChange} type="date"
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white" />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Address</label>
                  <input name="applicant_address" value={form.applicant_address} onChange={handleChange} placeholder="Current address"
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white" />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Employment / Occupation</label>
                  <input name="employment" value={form.employment} onChange={handleChange} placeholder="e.g. Teacher at Makerere University"
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white" />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">References</label>
                  <textarea name="references" value={form.references} onChange={handleChange} rows={2} placeholder="Guarantor name, contact, relationship…"
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white resize-none" />
                </div>
                {editingId && (
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
                    <select name="status" value={form.status} onChange={handleChange}
                      className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white">
                      <option value="Pending">Pending</option>
                      <option value="Approved">Approved</option>
                      <option value="Rejected">Rejected</option>
                    </select>
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition">
                  Cancel
                </button>
                <button type="submit" disabled={submitting}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50">
                  {submitting ? 'Saving…' : editingId ? 'Save Changes' : 'Submit Application'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Toast message={toast} onDismiss={() => setToast('')} />
    </>
  );
}
