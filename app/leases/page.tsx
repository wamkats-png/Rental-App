'use client';

import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { formatUGX, formatDate, daysUntil } from '../lib/utils';
import Toast from '../components/Toast';
import { ContractType, PaymentFrequency, UtilitiesResponsibility, LeaseStatus } from '../types';

const CONTRACT_TYPES: ContractType[] = ['Residential', 'Commercial', 'Other'];
const PAYMENT_FREQUENCIES: PaymentFrequency[] = ['Monthly', 'Quarterly', 'Yearly'];
const UTILITIES_OPTIONS: UtilitiesResponsibility[] = ['Landlord', 'Tenant', 'Shared'];
const LEASE_STATUSES: LeaseStatus[] = ['Draft', 'Pending_tenant_signature', 'Pending_landlord_signature', 'Active', 'Terminated'];

function statusLabel(s: LeaseStatus) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function statusColor(s: LeaseStatus) {
  switch (s) {
    case 'Active': return 'bg-green-100 text-green-800';
    case 'Draft': return 'bg-gray-100 text-gray-700';
    case 'Terminated': return 'bg-red-100 text-red-800';
    default: return 'bg-yellow-100 text-yellow-800';
  }
}

const ESCALATION_FREQUENCIES = ['Yearly', '2 Years'] as const;

function computeNextReview(startDate: string, freq: string): string {
  if (!startDate) return '';
  const d = new Date(startDate);
  d.setFullYear(d.getFullYear() + (freq === '2 Years' ? 2 : 1));
  return d.toISOString().split('T')[0];
}

const defaultForm = {
  property_id: '', unit_id: '', tenant_id: '', contract_type: 'Residential' as ContractType,
  rent_amount: 0, payment_frequency: 'Monthly' as PaymentFrequency, currency: 'UGX',
  start_date: '', end_date: '', due_day: 1, grace_period_days: 5, deposit_amount: 0,
  utilities_responsibility: 'Tenant' as UtilitiesResponsibility, notice_period_days: 30,
  status: 'Draft' as LeaseStatus,
  late_fee_type: 'percentage' as 'percentage' | 'flat',
  late_fee_rate: 0,
  escalation_rate: 0,
  escalation_frequency: 'Yearly' as 'Yearly' | '2 Years',
  next_review_date: '',
};

export default function LeasesPage() {
  const { properties, units, tenants, leases, addLease, updateLease, deleteLease, updateUnit } = useApp();
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [filterStatus, setFilterStatus] = useState<LeaseStatus | 'All'>('All');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState('');

  const filtered = filterStatus === 'All' ? leases : leases.filter(l => l.status === filterStatus);
  const unitsForProperty = units.filter(u => u.property_id === form.property_id);

  const openAdd = () => { setEditingId(null); setForm(defaultForm); setShowModal(true); };
  const handleDuplicate = (l: typeof leases[0]) => {
    setEditingId(null);
    setForm({
      property_id: l.property_id, unit_id: l.unit_id, tenant_id: l.tenant_id,
      contract_type: l.contract_type, rent_amount: l.rent_amount, payment_frequency: l.payment_frequency,
      currency: l.currency, start_date: '', end_date: '', due_day: l.due_day,
      grace_period_days: l.grace_period_days, deposit_amount: l.deposit_amount,
      utilities_responsibility: l.utilities_responsibility, notice_period_days: l.notice_period_days,
      status: 'Draft' as const,
      late_fee_type: l.late_fee_type ?? 'percentage',
      late_fee_rate: l.late_fee_rate ?? 0,
      escalation_rate: l.escalation_rate ?? 0,
      escalation_frequency: l.escalation_frequency ?? 'Yearly',
      next_review_date: '',
    });
    setShowModal(true);
    setToast('Lease duplicated — update dates before saving');
  };
  const openEdit = (l: typeof leases[0]) => {
    setEditingId(l.id);
    setForm({
      property_id: l.property_id, unit_id: l.unit_id, tenant_id: l.tenant_id,
      contract_type: l.contract_type, rent_amount: l.rent_amount, payment_frequency: l.payment_frequency,
      currency: l.currency, start_date: l.start_date, end_date: l.end_date, due_day: l.due_day,
      grace_period_days: l.grace_period_days, deposit_amount: l.deposit_amount,
      utilities_responsibility: l.utilities_responsibility, notice_period_days: l.notice_period_days,
      status: l.status,
      late_fee_type: l.late_fee_type ?? 'percentage',
      late_fee_rate: l.late_fee_rate ?? 0,
      escalation_rate: l.escalation_rate ?? 0,
      escalation_frequency: l.escalation_frequency ?? 'Yearly',
      next_review_date: l.next_review_date ?? '',
    });
    setShowModal(true);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm(prev => {
      const updated = {
        ...prev,
        [name]: ['rent_amount', 'deposit_amount', 'due_day', 'grace_period_days', 'notice_period_days', 'late_fee_rate', 'escalation_rate'].includes(name) ? Number(value) : value,
        ...(name === 'property_id' ? { unit_id: '' } : {}),
      };
      // Auto-compute next_review_date when start_date or escalation_frequency changes
      if ((name === 'start_date' || name === 'escalation_frequency') && updated.escalation_rate > 0) {
        updated.next_review_date = computeNextReview(
          name === 'start_date' ? value : prev.start_date,
          name === 'escalation_frequency' ? value : prev.escalation_frequency
        );
      }
      return updated;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!form.property_id || !form.unit_id || !form.tenant_id || !form.start_date || !form.end_date) return;
    if (new Date(form.end_date) <= new Date(form.start_date)) {
      alert('End date must be after start date.');
      return;
    }

    setSubmitting(true);
    try {
      if (editingId) {
        const old = leases.find(l => l.id === editingId);
        updateLease(editingId, form);
        if (old?.status !== 'Active' && form.status === 'Active') updateUnit(form.unit_id, { status: 'Occupied' });
        if (old?.status !== 'Terminated' && form.status === 'Terminated') updateUnit(form.unit_id, { status: 'Available' });
      } else {
        addLease(form);
        if (form.status === 'Active') updateUnit(form.unit_id, { status: 'Occupied' });
      }
      setShowModal(false); setEditingId(null); setForm(defaultForm);
      setToast(editingId ? 'Lease updated successfully' : 'Lease created successfully');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = (lease: typeof leases[0], newStatus: LeaseStatus) => {
    updateLease(lease.id, { status: newStatus });
    if (lease.status !== 'Active' && newStatus === 'Active') updateUnit(lease.unit_id, { status: 'Occupied' });
    if (lease.status !== 'Terminated' && newStatus === 'Terminated') updateUnit(lease.unit_id, { status: 'Available' });
  };

  const handleDelete = (id: string) => {
    const lease = leases.find(l => l.id === id);
    if (lease?.status === 'Active') updateUnit(lease.unit_id, { status: 'Available' });
    deleteLease(id);
    setDeleteConfirmId(null);
  };

  const getName = (id: string, list: { id: string; full_name?: string; name?: string; code?: string }[]) => {
    const item = list.find(x => x.id === id);
    return item?.full_name || item?.name || item?.code || 'Unknown';
  };

  const activeCount = leases.filter(l => l.status === 'Active').length;
  const draftCount = leases.filter(l => l.status === 'Draft').length;

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Leases</h1>
          <p className="text-sm text-gray-500 mt-1">Manage lease agreements</p>
        </div>
        <button onClick={openAdd} className="bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 transition font-medium">+ Add Lease</button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Active</p>
          <p className="text-2xl font-bold text-green-600">{activeCount}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Drafts</p>
          <p className="text-2xl font-bold text-gray-600">{draftCount}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Pending</p>
          <p className="text-2xl font-bold text-yellow-600">{leases.filter(l => l.status.startsWith('Pending')).length}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Terminated</p>
          <p className="text-2xl font-bold text-red-600">{leases.filter(l => l.status === 'Terminated').length}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex flex-wrap gap-2">
          <span className="text-sm font-medium text-gray-600 mr-2 self-center">Filter:</span>
          {(['All', ...LEASE_STATUSES] as const).map(s => (
            <button key={s} onClick={() => setFilterStatus(s)} className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${filterStatus === s ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {s === 'All' ? `All (${leases.length})` : statusLabel(s)}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <p className="text-gray-500 text-lg">{leases.length === 0 ? 'No leases yet.' : 'No leases match filter.'}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(lease => {
            const expiryDays = lease.end_date ? daysUntil(lease.end_date) : null;
            const expiringSoon = lease.status === 'Active' && expiryDays !== null && expiryDays > 0 && expiryDays <= 30;
            const expired = lease.status === 'Active' && expiryDays !== null && expiryDays <= 0;

            return (
              <div key={lease.id} className={`bg-white rounded-lg shadow ${expired ? 'border-l-4 border-red-500' : expiringSoon ? 'border-l-4 border-yellow-500' : ''}`}>
                <div className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-lg font-semibold text-gray-800">{getName(lease.tenant_id, tenants)}</h3>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColor(lease.status)}`}>{statusLabel(lease.status)}</span>
                      </div>
                      <p className="text-sm text-gray-500">{getName(lease.property_id, properties)} &mdash; Unit {getName(lease.unit_id, units)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <select value={lease.status} onChange={e => handleStatusChange(lease, e.target.value as LeaseStatus)} className="text-xs border rounded-lg px-2 py-1.5 bg-white">
                        {LEASE_STATUSES.map(s => <option key={s} value={s}>{statusLabel(s)}</option>)}
                      </select>
                      <button onClick={() => openEdit(lease)} className="text-blue-600 hover:text-blue-800 text-sm font-medium px-2">Edit</button>
                      <button onClick={() => handleDuplicate(lease)} className="text-green-600 hover:text-green-800 text-sm font-medium px-2">Duplicate</button>
                      {deleteConfirmId === lease.id ? (
                        <>
                          <button onClick={() => handleDelete(lease.id)} className="bg-red-600 text-white px-3 py-1 rounded text-sm">Confirm</button>
                          <button onClick={() => setDeleteConfirmId(null)} className="text-gray-600 text-sm">Cancel</button>
                        </>
                      ) : (
                        <button onClick={() => setDeleteConfirmId(lease.id)} className="text-red-600 hover:text-red-800 text-sm font-medium px-2">Delete</button>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 text-sm">
                    <div><p className="text-gray-400 text-xs uppercase">Rent</p><p className="font-medium">{formatUGX(lease.rent_amount)}</p></div>
                    <div><p className="text-gray-400 text-xs uppercase">Frequency</p><p className="font-medium">{lease.payment_frequency}</p></div>
                    <div><p className="text-gray-400 text-xs uppercase">Start</p><p className="font-medium">{formatDate(lease.start_date)}</p></div>
                    <div><p className="text-gray-400 text-xs uppercase">End</p><p className="font-medium">{formatDate(lease.end_date)}</p></div>
                    <div><p className="text-gray-400 text-xs uppercase">Due Day</p><p className="font-medium">{lease.due_day} of month</p></div>
                    <div><p className="text-gray-400 text-xs uppercase">Deposit</p><p className="font-medium">{formatUGX(lease.deposit_amount)}</p></div>
                    {lease.status === 'Active' && expiryDays !== null && (
                      <div><p className="text-gray-400 text-xs uppercase">Expiry</p><p className={`font-medium ${expired ? 'text-red-600' : expiringSoon ? 'text-yellow-600' : 'text-green-600'}`}>{expired ? `Expired ${Math.abs(expiryDays)}d ago` : `${expiryDays}d left`}</p></div>
                    )}
                    {(lease.late_fee_rate ?? 0) > 0 && (
                      <div><p className="text-gray-400 text-xs uppercase">Late Fee</p><p className="font-medium text-orange-600">{lease.late_fee_type === 'flat' ? formatUGX(lease.late_fee_rate ?? 0) : `${lease.late_fee_rate ?? 0}%`}</p></div>
                    )}
                    {(lease.escalation_rate ?? 0) > 0 && (
                      <div><p className="text-gray-400 text-xs uppercase">Escalation</p><p className="font-medium text-purple-600">{lease.escalation_rate}% / {lease.escalation_frequency ?? 'Yearly'}</p></div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl my-8">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-bold text-gray-800">{editingId ? 'Edit Lease' : 'Add Lease'}</h2>
              <button onClick={() => { setShowModal(false); setEditingId(null); }} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
            </div>
            <form onSubmit={handleSubmit} className="p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Property *</label>
                  <select name="property_id" value={form.property_id} onChange={handleChange} required className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500">
                    <option value="">Select property</option>
                    {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unit *</label>
                  <select name="unit_id" value={form.unit_id} onChange={handleChange} required disabled={!form.property_id} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50">
                    <option value="">{form.property_id ? 'Select unit' : 'Select property first'}</option>
                    {unitsForProperty.map(u => <option key={u.id} value={u.id}>{u.code} - {u.description} ({u.status.replace('_', ' ')})</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tenant *</label>
                  <select name="tenant_id" value={form.tenant_id} onChange={handleChange} required className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500">
                    <option value="">Select tenant</option>
                    {tenants.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contract Type</label>
                  <select name="contract_type" value={form.contract_type} onChange={handleChange} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500">
                    {CONTRACT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Rent Amount *</label>
                  <input type="number" name="rent_amount" value={form.rent_amount || ''} onChange={handleChange} required min={0} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" placeholder="e.g. 1500000" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
                  <select name="payment_frequency" value={form.payment_frequency} onChange={handleChange} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500">
                    {PAYMENT_FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                  <input type="text" name="currency" value={form.currency} onChange={handleChange} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date *</label>
                  <input type="date" name="start_date" value={form.start_date} onChange={handleChange} required className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date *</label>
                  <input type="date" name="end_date" value={form.end_date} onChange={handleChange} required className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Due Day (1-28)</label>
                  <input type="number" name="due_day" value={form.due_day} onChange={handleChange} min={1} max={28} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Grace Period (days)</label>
                  <input type="number" name="grace_period_days" value={form.grace_period_days} onChange={handleChange} min={0} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Deposit Amount</label>
                  <input type="number" name="deposit_amount" value={form.deposit_amount || ''} onChange={handleChange} min={0} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Utilities</label>
                  <select name="utilities_responsibility" value={form.utilities_responsibility} onChange={handleChange} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500">
                    {UTILITIES_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notice Period (days)</label>
                  <input type="number" name="notice_period_days" value={form.notice_period_days} onChange={handleChange} min={0} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select name="status" value={form.status} onChange={handleChange} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500">
                    {LEASE_STATUSES.map(s => <option key={s} value={s}>{statusLabel(s)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Late Fee Type</label>
                  <select name="late_fee_type" value={form.late_fee_type} onChange={handleChange} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500">
                    <option value="percentage">Percentage of rent (%)</option>
                    <option value="flat">Flat amount (UGX)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Late Fee Rate {form.late_fee_type === 'percentage' ? '(%)' : '(UGX)'}
                  </label>
                  <input type="number" name="late_fee_rate" value={form.late_fee_rate || ''} onChange={handleChange} min={0} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" placeholder={form.late_fee_type === 'percentage' ? 'e.g. 5' : 'e.g. 50000'} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Rent Escalation Rate (%)</label>
                  <input type="number" name="escalation_rate" value={form.escalation_rate || ''} onChange={handleChange} min={0} max={100} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" placeholder="e.g. 10 for 10% annual increase" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Escalation Frequency</label>
                  <select name="escalation_frequency" value={form.escalation_frequency} onChange={handleChange} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500">
                    {ESCALATION_FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                {form.escalation_rate > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Next Review Date</label>
                    <input type="date" name="next_review_date" value={form.next_review_date} onChange={handleChange} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" />
                    <p className="text-xs text-gray-500 mt-1">Auto-set from start date + frequency</p>
                  </div>
                )}
              </div>
              {form.status === 'Active' && <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">Setting status to <strong>Active</strong> will mark the unit as <strong>Occupied</strong>.</div>}
              <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
                <button type="button" onClick={() => { setShowModal(false); setEditingId(null); }} className="px-5 py-2.5 text-gray-600 hover:bg-gray-100 rounded-lg font-medium">Cancel</button>
                <button type="submit" disabled={submitting} className="bg-blue-600 text-white px-6 py-2.5 rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed">
                  {submitting ? 'Saving...' : (editingId ? 'Update' : 'Create Lease')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    {toast && <Toast message={toast} onDismiss={() => setToast('')} />}
    </>
  );
}
