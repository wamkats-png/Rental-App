'use client';

import { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { formatUGX, formatDate } from '../lib/utils';
import { exportToCSV } from '../lib/csvExport';
import type { Expense, ExpenseCategory } from '../types';

const CATEGORIES: ExpenseCategory[] = [
  'Insurance', 'Council Rates', 'Agent Fees', 'Ground Rent',
  'Utilities', 'Legal & Professional', 'Bank Charges', 'Other',
];

const defaultForm = {
  date: new Date().toISOString().split('T')[0],
  category: 'Other' as ExpenseCategory,
  description: '',
  amount: 0,
  receipt_ref: '',
  property_id: '',
};

export default function ExpensesPage() {
  const { expenses, properties, addExpense, updateExpense, deleteExpense, landlord } = useApp();

  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);
  const [filterProperty, setFilterProperty] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return expenses.filter(e => {
      if (filterProperty !== 'all' && e.property_id !== filterProperty) return false;
      if (filterCategory !== 'all' && e.category !== filterCategory) return false;
      return true;
    });
  }, [expenses, filterProperty, filterCategory]);

  const totalFiltered = filtered.reduce((s, e) => s + e.amount, 0);

  const now = new Date();
  const thisMonthExpenses = expenses.filter(e => {
    const d = new Date(e.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const thisMonthTotal = thisMonthExpenses.reduce((s, e) => s + e.amount, 0);

  const openAdd = () => {
    setForm(defaultForm);
    setEditId(null);
    setShowModal(true);
  };

  const openEdit = (e: Expense) => {
    setForm({
      date: e.date,
      category: e.category,
      description: e.description ?? '',
      amount: e.amount,
      receipt_ref: e.receipt_ref ?? '',
      property_id: e.property_id ?? '',
    });
    setEditId(e.id);
    setShowModal(true);
  };

  const handleChange = (field: string, value: string | number) => {
    setForm(prev => ({ ...prev, [field]: field === 'amount' ? Number(value) : value }));
  };

  const handleSave = async () => {
    if (!form.date || form.amount <= 0) return;
    setSaving(true);
    try {
      const payload = {
        landlord_id: landlord.id,
        date: form.date,
        category: form.category,
        description: form.description || undefined,
        amount: form.amount,
        receipt_ref: form.receipt_ref || undefined,
        property_id: form.property_id || undefined,
      };
      if (editId) {
        await updateExpense(editId, payload);
      } else {
        await addExpense(payload);
      }
      setShowModal(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await deleteExpense(id);
    setConfirmDelete(null);
  };

  const handleExport = () => {
    const data = filtered.map(e => ({
      Date: e.date,
      Category: e.category,
      Description: e.description ?? '',
      Amount: e.amount,
      Property: properties.find(p => p.id === e.property_id)?.name ?? '',
      Receipt_Ref: e.receipt_ref ?? '',
    }));
    exportToCSV(data, `expenses-${new Date().toISOString().split('T')[0]}`);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Expenses</h1>
          <p className="text-sm text-gray-500 mt-1">Track property-related expenses for tax deductions</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExport} className="bg-gray-100 text-gray-700 px-4 py-2.5 rounded-lg hover:bg-gray-200 transition font-medium text-sm">
            Export CSV
          </button>
          <button onClick={openAdd} className="bg-blue-600 text-white px-4 py-2.5 rounded-lg hover:bg-blue-700 transition font-medium text-sm">
            + Add Expense
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500 mb-1">This Month</p>
          <p className="text-xl font-bold text-orange-600">{formatUGX(thisMonthTotal)}</p>
          <div className="h-1 bg-orange-500 rounded mt-3" />
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500 mb-1">Filtered Total</p>
          <p className="text-xl font-bold text-gray-800">{formatUGX(totalFiltered)}</p>
          <div className="h-1 bg-blue-500 rounded mt-3" />
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500 mb-1">Total Records</p>
          <p className="text-xl font-bold text-gray-800">{filtered.length}</p>
          <div className="h-1 bg-slate-500 rounded mt-3" />
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-4 flex flex-wrap gap-3">
        <select
          value={filterProperty}
          onChange={e => setFilterProperty(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Properties</option>
          {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select
          value={filterCategory}
          onChange={e => setFilterCategory(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <p className="text-lg mb-2">No expenses recorded</p>
            <p className="text-sm">Add your first expense to track property costs for tax deductions.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
                <tr>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Category</th>
                  <th className="px-4 py-3 text-left">Description</th>
                  <th className="px-4 py-3 text-left">Property</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-left">Receipt Ref</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(e => (
                  <tr key={e.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-600">{formatDate(e.date)}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded text-xs font-medium">{e.category}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{e.description || <span className="text-gray-400">—</span>}</td>
                    <td className="px-4 py-3 text-gray-600">{properties.find(p => p.id === e.property_id)?.name || <span className="text-gray-400">—</span>}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-800">{formatUGX(e.amount)}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{e.receipt_ref || <span className="text-gray-400">—</span>}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => openEdit(e)} className="text-blue-600 hover:text-blue-800 text-xs font-medium">Edit</button>
                        <button onClick={() => setConfirmDelete(e.id)} className="text-red-500 hover:text-red-700 text-xs font-medium">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 border-t">
                <tr>
                  <td colSpan={4} className="px-4 py-3 text-sm font-semibold text-gray-700">Total</td>
                  <td className="px-4 py-3 text-right font-bold text-gray-800">{formatUGX(totalFiltered)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b">
              <h2 className="text-lg font-semibold text-gray-800">{editId ? 'Edit Expense' : 'Add Expense'}</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={e => handleChange('date', e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                <select
                  value={form.category}
                  onChange={e => handleChange('category', e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                >
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount (UGX) *</label>
                <input
                  type="number"
                  min={0}
                  value={form.amount || ''}
                  onChange={e => handleChange('amount', e.target.value)}
                  placeholder="e.g. 250000"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Property</label>
                <select
                  value={form.property_id}
                  onChange={e => handleChange('property_id', e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">No specific property</option>
                  {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={e => handleChange('description', e.target.value)}
                  placeholder="e.g. Annual building insurance renewal"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Receipt Reference</label>
                <input
                  type="text"
                  value={form.receipt_ref}
                  onChange={e => handleChange('receipt_ref', e.target.value)}
                  placeholder="e.g. INV-2024-0042"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="p-6 border-t flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
              <button
                onClick={handleSave}
                disabled={saving || !form.date || form.amount <= 0}
                className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : editId ? 'Update' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Delete Expense?</h3>
            <p className="text-sm text-gray-600 mb-6">This action cannot be undone.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmDelete(null)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
              <button onClick={() => handleDelete(confirmDelete)} className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
