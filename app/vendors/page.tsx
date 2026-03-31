'use client';

import { useState } from 'react';
import { useApp } from '../context/AppContext';
import Toast from '../components/Toast';
import { VendorCategory } from '../types';

const CATEGORIES: VendorCategory[] = [
  'Plumbing', 'Electrical', 'Structural', 'Carpentry', 'Painting', 'Cleaning', 'General', 'Other',
];

const CATEGORY_ICON: Record<VendorCategory, string> = {
  Plumbing: '🔧',
  Electrical: '⚡',
  Structural: '🏗️',
  Carpentry: '🪚',
  Painting: '🎨',
  Cleaning: '🧹',
  General: '🔨',
  Other: '📦',
};

const defaultForm = {
  name: '',
  phone: '',
  email: '',
  category: 'General' as VendorCategory,
  notes: '',
  is_active: true,
};

export default function VendorsPage() {
  const { vendors, loading, addVendor, updateVendor, deleteVendor } = useApp();

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [filterCategory, setFilterCategory] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const filtered = filterCategory ? vendors.filter(v => v.category === filterCategory) : vendors;

  const openAdd = () => {
    setEditingId(null);
    setForm(defaultForm);
    setShowModal(true);
  };

  const openEdit = (v: typeof vendors[0]) => {
    setEditingId(v.id);
    setForm({
      name: v.name,
      phone: v.phone,
      email: v.email,
      category: v.category as VendorCategory,
      notes: v.notes,
      is_active: v.is_active,
    });
    setShowModal(true);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || !form.name) return;
    setSubmitting(true);
    try {
      if (editingId) {
        updateVendor(editingId, form);
        setToast('Vendor updated');
      } else {
        addVendor(form);
        setToast('Vendor added');
      }
      setShowModal(false);
      setEditingId(null);
      setForm(defaultForm);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (id: string) => {
    deleteVendor(id);
    setDeleteConfirmId(null);
    setToast('Vendor removed');
  };

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Vendors</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Maintenance service providers and contractors</p>
        </div>
        <button onClick={openAdd} className="bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 transition font-medium">
          + Add Vendor
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Vendors</p>
          <p className="text-2xl font-bold text-blue-600">{vendors.length}</p>
        </div>
        {(['Plumbing', 'Electrical', 'General'] as VendorCategory[]).map(cat => (
          <div key={cat} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">{cat}</p>
            <p className="text-2xl font-bold text-gray-700 dark:text-gray-300">
              {vendors.filter(v => v.category === cat).length}
            </p>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6 flex flex-wrap gap-2 items-center">
        <span className="text-sm font-medium text-gray-600 dark:text-gray-400 mr-1">Category:</span>
        <button
          onClick={() => setFilterCategory('')}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${!filterCategory ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
        >
          All ({vendors.length})
        </button>
        {CATEGORIES.map(cat => {
          const count = vendors.filter(v => v.category === cat).length;
          if (count === 0) return null;
          return (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${filterCategory === cat ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
            >
              {CATEGORY_ICON[cat]} {cat} ({count})
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center text-gray-500 dark:text-gray-400">Loading vendors…</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
          <div className="w-16 h-16 bg-orange-50 dark:bg-orange-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-1">No vendors yet</h3>
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-5">Add contractors and service providers to quickly assign them to maintenance requests.</p>
          <button onClick={openAdd} className="bg-blue-600 text-white px-6 py-2.5 rounded-lg hover:bg-blue-700 transition font-medium text-sm">+ Add Vendor</button>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Vendor</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Category</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Phone</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Email</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Notes</th>
                <th className="py-3 px-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {filtered.map(vendor => (
                <tr key={vendor.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="py-3 px-4">
                    <div className="font-medium text-gray-800 dark:text-white">{vendor.name}</div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                      {CATEGORY_ICON[vendor.category as VendorCategory]} {vendor.category}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-gray-600 dark:text-gray-300">{vendor.phone || '—'}</td>
                  <td className="py-3 px-4 text-gray-600 dark:text-gray-300">{vendor.email || '—'}</td>
                  <td className="py-3 px-4 text-gray-500 dark:text-gray-400 max-w-xs truncate">{vendor.notes || '—'}</td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={() => openEdit(vendor)} className="text-blue-600 hover:text-blue-800 text-sm font-medium">Edit</button>
                      {deleteConfirmId === vendor.id ? (
                        <>
                          <button onClick={() => handleDelete(vendor.id)} className="bg-red-600 text-white px-2 py-1 rounded text-xs">Confirm</button>
                          <button onClick={() => setDeleteConfirmId(null)} className="text-gray-500 text-xs">Cancel</button>
                        </>
                      ) : (
                        <button onClick={() => setDeleteConfirmId(vendor.id)} className="text-red-500 hover:text-red-700 text-sm font-medium">Remove</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md my-8">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-white">
                {editingId ? 'Edit Vendor' : 'Add Vendor'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-2xl leading-none">&times;</button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name <span className="text-red-500">*</span></label>
                <input name="name" value={form.name} onChange={handleChange} required placeholder="e.g. Kampala Plumbers Ltd"
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
                  <select name="category" value={form.category} onChange={handleChange}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white">
                    {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_ICON[c]} {c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone</label>
                  <input name="phone" value={form.phone} onChange={handleChange} placeholder="+256 700 000000" type="tel"
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                <input name="email" value={form.email} onChange={handleChange} placeholder="vendor@example.com" type="email"
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
                <textarea name="notes" value={form.notes} onChange={handleChange} rows={3}
                  placeholder="Rates, specialties, availability, payment terms…"
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white resize-none" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition">
                  Cancel
                </button>
                <button type="submit" disabled={submitting}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50">
                  {submitting ? 'Saving…' : editingId ? 'Save Changes' : 'Add Vendor'}
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
