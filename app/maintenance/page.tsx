'use client';

import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { formatUGX, formatDate } from '../lib/utils';
import { exportToCSV } from '../lib/csvExport';
import { MaintenanceCategory, MaintenancePayer } from '../types';

const CATEGORIES: MaintenanceCategory[] = ['Plumbing', 'Electrical', 'Structural', 'Other'];
const PAYERS: MaintenancePayer[] = ['Landlord', 'Tenant'];

const defaultForm = {
  landlord_id: '', property_id: '', unit_id: '', date: new Date().toISOString().split('T')[0],
  description: '', category: 'Other' as MaintenanceCategory, vendor: '', cost: 0, payer: 'Landlord' as MaintenancePayer,
};

export default function MaintenancePage() {
  const { properties, units, maintenance, landlord, addMaintenance, updateMaintenance, deleteMaintenance } = useApp();
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [filterCategory, setFilterCategory] = useState('');
  const [filterProperty, setFilterProperty] = useState('');
  const [filterPayer, setFilterPayer] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const unitsForProperty = units.filter(u => u.property_id === form.property_id);

  let filtered = maintenance;
  if (filterCategory) filtered = filtered.filter(m => m.category === filterCategory);
  if (filterProperty) filtered = filtered.filter(m => m.property_id === filterProperty);
  if (filterPayer) filtered = filtered.filter(m => m.payer === filterPayer);
  const sorted = [...filtered].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const totalCost = sorted.reduce((s, m) => s + m.cost, 0);
  const landlordCost = sorted.filter(m => m.payer === 'Landlord').reduce((s, m) => s + m.cost, 0);
  const tenantCost = sorted.filter(m => m.payer === 'Tenant').reduce((s, m) => s + m.cost, 0);

  const openAdd = () => { setEditingId(null); setForm({ ...defaultForm, landlord_id: landlord.id }); setShowModal(true); };
  const openEdit = (m: typeof maintenance[0]) => {
    setEditingId(m.id);
    setForm({ landlord_id: m.landlord_id, property_id: m.property_id, unit_id: m.unit_id, date: m.date, description: m.description, category: m.category, vendor: m.vendor, cost: m.cost, payer: m.payer });
    setShowModal(true);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: name === 'cost' ? Number(value) : value,
      ...(name === 'property_id' ? { unit_id: '' } : {}),
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
  };

  const handleExport = () => {
    exportToCSV(sorted.map(m => ({
      Date: m.date, Property: properties.find(p => p.id === m.property_id)?.name || '',
      Unit: units.find(u => u.id === m.unit_id)?.code || '', Description: m.description,
      Category: m.category, Vendor: m.vendor, Cost: m.cost, Payer: m.payer,
    })), 'maintenance');
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Maintenance</h1>
          <p className="text-sm text-gray-500 mt-1">Track property maintenance and repairs</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExport} className="bg-gray-100 text-gray-700 px-4 py-2.5 rounded-lg hover:bg-gray-200 transition font-medium text-sm">Export CSV</button>
          <button onClick={openAdd} className="bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 transition font-medium">+ Add Record</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
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
      </div>

      <div className="bg-white rounded-lg shadow p-4 mb-6 flex flex-wrap gap-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Category</label>
          <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
            <option value="">All</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Property</label>
          <select value={filterProperty} onChange={e => setFilterProperty(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
            <option value="">All</option>
            {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Payer</label>
          <select value={filterPayer} onChange={e => setFilterPayer(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
            <option value="">All</option>
            {PAYERS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <p className="text-gray-500 text-lg">{maintenance.length === 0 ? 'No maintenance records yet.' : 'No records match filters.'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map(m => (
            <div key={m.id} className="bg-white rounded-lg shadow p-5 hover:shadow-md transition">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      m.category === 'Plumbing' ? 'bg-blue-100 text-blue-700' :
                      m.category === 'Electrical' ? 'bg-yellow-100 text-yellow-700' :
                      m.category === 'Structural' ? 'bg-red-100 text-red-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>{m.category}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${m.payer === 'Landlord' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>{m.payer} pays</span>
                    <span className="text-xs text-gray-400">{formatDate(m.date)}</span>
                  </div>
                  <p className="text-gray-800 mb-1">{m.description}</p>
                  <div className="flex gap-4 text-sm text-gray-500">
                    <span>{properties.find(p => p.id === m.property_id)?.name || 'Unknown'}</span>
                    {m.unit_id && <span>Unit: {units.find(u => u.id === m.unit_id)?.code}</span>}
                    {m.vendor && <span>Vendor: {m.vendor}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-3">
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
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
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
    </div>
  );
}
