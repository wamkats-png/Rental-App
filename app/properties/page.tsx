'use client';

import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { formatUGX } from '../lib/utils';
import { PropertyType, UnitStatus } from '../types';
import Toast from '../components/Toast';
import { PropertyCardSkeleton } from '../components/Skeleton';

const PROPERTY_TYPES: PropertyType[] = ['Residential', 'Commercial', 'Mixed'];
const UNIT_STATUSES: UnitStatus[] = ['Available', 'Occupied', 'Under_maintenance'];

export default function PropertiesPage() {
  const { properties, units, leases, applications, loading, addProperty, updateProperty, deleteProperty, addUnit, updateUnit, deleteUnit } = useApp();

  const [showPropertyForm, setShowPropertyForm] = useState(false);
  const [editingPropertyId, setEditingPropertyId] = useState<string | null>(null);
  const [propertyForm, setPropertyForm] = useState({ name: '', address: '', district: '', lc_area: '', property_type: 'Residential' as PropertyType, property_rates_ref: '' });

  const [showUnitForm, setShowUnitForm] = useState<string | null>(null);
  const [editingUnitId, setEditingUnitId] = useState<string | null>(null);
  const [unitForm, setUnitForm] = useState({ property_id: '', code: '', description: '', bedrooms: 1, default_rent_amount: 0, status: 'Available' as UnitStatus });

  const [expandedProperty, setExpandedProperty] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleteUnitConfirm, setDeleteUnitConfirm] = useState<string | null>(null);
  const [toast, setToast] = useState('');

  const pendingApps = applications.filter(a => a.status === 'Pending').length;

  const openAddProperty = () => {
    setEditingPropertyId(null);
    setPropertyForm({ name: '', address: '', district: '', lc_area: '', property_type: 'Residential', property_rates_ref: '' });
    setShowPropertyForm(true);
  };

  const openEditProperty = (p: typeof properties[0]) => {
    setEditingPropertyId(p.id);
    setPropertyForm({ name: p.name, address: p.address, district: p.district, lc_area: p.lc_area, property_type: p.property_type, property_rates_ref: p.property_rates_ref });
    setShowPropertyForm(true);
  };

  const handlePropertySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!propertyForm.name) return;
    if (editingPropertyId) {
      updateProperty(editingPropertyId, propertyForm);
    } else {
      addProperty(propertyForm);
    }
    setShowPropertyForm(false);
    setEditingPropertyId(null);
    setToast(editingPropertyId ? 'Property updated' : 'Property added');
  };

  const handleDeleteProperty = (id: string) => {
    const propertyUnitIds = units.filter(u => u.property_id === id).map(u => u.id);
    const hasActiveLeases = leases.some(
      l => propertyUnitIds.includes(l.unit_id) && l.status === 'Active'
    );
    if (hasActiveLeases) {
      alert('Cannot delete this property — it has active leases. Terminate all leases first.');
      setDeleteConfirm(null);
      return;
    }
    propertyUnitIds.forEach(uid => deleteUnit(uid));
    deleteProperty(id);
    setDeleteConfirm(null);
  };

  const openAddUnit = (propertyId: string) => {
    setEditingUnitId(null);
    setUnitForm({ property_id: propertyId, code: '', description: '', bedrooms: 1, default_rent_amount: 0, status: 'Available' });
    setShowUnitForm(propertyId);
  };

  const openEditUnit = (u: typeof units[0]) => {
    setEditingUnitId(u.id);
    setUnitForm({ property_id: u.property_id, code: u.code, description: u.description, bedrooms: u.bedrooms, default_rent_amount: u.default_rent_amount, status: u.status });
    setShowUnitForm(u.property_id);
  };

  const handleDeleteUnit = (id: string) => {
    const hasActiveLease = leases.some(l => l.unit_id === id && l.status === 'Active');
    if (hasActiveLease) {
      alert('Cannot delete this unit — it has an active lease. Terminate the lease first.');
      setDeleteUnitConfirm(null);
      return;
    }
    deleteUnit(id);
    setDeleteUnitConfirm(null);
    setToast('Unit deleted');
  };

  const handleUnitSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!unitForm.code) return;
    if (editingUnitId) {
      updateUnit(editingUnitId, unitForm);
    } else {
      addUnit(unitForm);
    }
    setShowUnitForm(null);
    setEditingUnitId(null);
    setToast(editingUnitId ? 'Unit updated' : 'Unit added');
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Properties</h1>
          <p className="text-sm text-gray-500 mt-1">Manage your properties and units</p>
          {pendingApps > 0 && (
            <p className="text-sm text-red-600 mt-1">{pendingApps} pending application(s)</p>
          )}
        </div>
        <button onClick={openAddProperty} className="bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 transition font-medium">+ Add Property</button>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => <PropertyCardSkeleton key={i} />)}
        </div>
      ) : properties.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-700 mb-1">No properties yet</h3>
          <p className="text-gray-500 text-sm mb-5">Add your first property to start tracking units, tenants, and rental income.</p>
          <button onClick={openAddProperty} className="bg-blue-600 text-white px-6 py-2.5 rounded-lg hover:bg-blue-700 transition font-medium text-sm">+ Add First Property</button>
        </div>
      ) : (
        <div className="space-y-4">
          {properties.map(property => {
            const propertyUnits = units.filter(u => u.property_id === property.id);
            const occupied = propertyUnits.filter(u => u.status === 'Occupied').length;
            const isExpanded = expandedProperty === property.id;

            return (
              <div key={property.id} className="bg-white rounded-lg shadow">
                <div className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 cursor-pointer" onClick={() => setExpandedProperty(isExpanded ? null : property.id)}>
                      <div className="flex items-center gap-3">
                        <h2 className="text-lg font-semibold text-gray-800">{property.name}</h2>
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">{property.property_type}</span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{property.address}</p>
                      <div className="flex gap-4 mt-2 text-sm text-gray-500">
                        <span>District: {property.district || 'N/A'}</span>
                        <span>LC Area: {property.lc_area || 'N/A'}</span>
                        <span>Units: {propertyUnits.length} ({occupied} occupied)</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => openEditProperty(property)} className="text-blue-600 hover:text-blue-800 px-3 py-1.5 rounded text-sm font-medium">Edit</button>
                      {deleteConfirm === property.id ? (
                        <div className="flex gap-1">
                          <button onClick={() => handleDeleteProperty(property.id)} className="bg-red-600 text-white px-3 py-1.5 rounded text-sm font-medium">Confirm</button>
                          <button onClick={() => setDeleteConfirm(null)} className="text-gray-600 px-3 py-1.5 rounded text-sm">Cancel</button>
                        </div>
                      ) : (
                        <button onClick={() => setDeleteConfirm(property.id)} className="text-red-600 hover:text-red-800 px-3 py-1.5 rounded text-sm font-medium">Delete</button>
                      )}
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-gray-100 p-5">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-gray-700">Units</h3>
                      <button onClick={() => openAddUnit(property.id)} className="bg-green-600 text-white px-3 py-1.5 rounded text-sm hover:bg-green-700 transition">+ Add Unit</button>
                    </div>

                    {propertyUnits.length === 0 ? (
                      <p className="text-gray-500 text-sm">No units added yet.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-200">
                              <th className="text-left py-2 px-3 text-gray-600 font-medium">Code</th>
                              <th className="text-left py-2 px-3 text-gray-600 font-medium">Description</th>
                              <th className="text-left py-2 px-3 text-gray-600 font-medium">Bedrooms</th>
                              <th className="text-left py-2 px-3 text-gray-600 font-medium">Rent</th>
                              <th className="text-left py-2 px-3 text-gray-600 font-medium">Status</th>
                              <th className="text-right py-2 px-3 text-gray-600 font-medium">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {propertyUnits.map(unit => (
                              <tr key={unit.id} className="border-b border-gray-50 hover:bg-gray-50">
                                <td className="py-2 px-3 font-medium">{unit.code}</td>
                                <td className="py-2 px-3 text-gray-600">{unit.description}</td>
                                <td className="py-2 px-3">{unit.bedrooms}</td>
                                <td className="py-2 px-3">{formatUGX(unit.default_rent_amount)}</td>
                                <td className="py-2 px-3">
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                    unit.status === 'Available' ? 'bg-green-100 text-green-700' :
                                    unit.status === 'Occupied' ? 'bg-blue-100 text-blue-700' :
                                    'bg-yellow-100 text-yellow-700'
                                  }`}>{unit.status.replace('_', ' ')}</span>
                                </td>
                                <td className="py-2 px-3 text-right">
                                  <button onClick={() => openEditUnit(unit)} className="text-blue-600 hover:text-blue-800 text-sm mr-2">Edit</button>
                                  {deleteUnitConfirm === unit.id ? (
                                    <span className="inline-flex gap-1">
                                      <button onClick={() => handleDeleteUnit(unit.id)} className="bg-red-600 text-white px-2 py-0.5 rounded text-xs font-medium">Confirm</button>
                                      <button onClick={() => setDeleteUnitConfirm(null)} className="text-gray-600 px-2 py-0.5 rounded text-xs">Cancel</button>
                                    </span>
                                  ) : (
                                    <button onClick={() => setDeleteUnitConfirm(unit.id)} className="text-red-600 hover:text-red-800 text-sm">Delete</button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Property Modal */}
      {showPropertyForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-bold text-gray-800">{editingPropertyId ? 'Edit Property' : 'Add Property'}</h2>
              <button onClick={() => setShowPropertyForm(false)} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
            </div>
            <form onSubmit={handlePropertySubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Property Name *</label>
                <input type="text" value={propertyForm.name} onChange={e => setPropertyForm({ ...propertyForm, name: e.target.value })} required className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="e.g. Sunset Apartments" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address *</label>
                <input type="text" value={propertyForm.address} onChange={e => setPropertyForm({ ...propertyForm, address: e.target.value })} required className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="e.g. Plot 12, Kampala Road" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">District</label>
                  <input type="text" value={propertyForm.district} onChange={e => setPropertyForm({ ...propertyForm, district: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="e.g. Kampala" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">LC Area</label>
                  <input type="text" value={propertyForm.lc_area} onChange={e => setPropertyForm({ ...propertyForm, lc_area: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="e.g. Nakawa" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Property Type</label>
                  <select value={propertyForm.property_type} onChange={e => setPropertyForm({ ...propertyForm, property_type: e.target.value as PropertyType })} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                    {PROPERTY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Property Rates Ref</label>
                  <input type="text" value={propertyForm.property_rates_ref} onChange={e => setPropertyForm({ ...propertyForm, property_rates_ref: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="Reference number" />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button type="button" onClick={() => setShowPropertyForm(false)} className="px-5 py-2.5 text-gray-600 hover:bg-gray-100 rounded-lg font-medium">Cancel</button>
                <button type="submit" className="bg-blue-600 text-white px-6 py-2.5 rounded-lg hover:bg-blue-700 font-medium">{editingPropertyId ? 'Update' : 'Add Property'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Unit Modal */}
      {showUnitForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-bold text-gray-800">{editingUnitId ? 'Edit Unit' : 'Add Unit'}</h2>
              <button onClick={() => { setShowUnitForm(null); setEditingUnitId(null); }} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
            </div>
            <form onSubmit={handleUnitSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unit Code *</label>
                  <input type="text" value={unitForm.code} onChange={e => setUnitForm({ ...unitForm, code: e.target.value })} required className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="e.g. A1" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bedrooms</label>
                  <input type="number" value={unitForm.bedrooms} onChange={e => setUnitForm({ ...unitForm, bedrooms: Number(e.target.value) })} min={0} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input type="text" value={unitForm.description} onChange={e => setUnitForm({ ...unitForm, description: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="e.g. 2-bedroom apartment, ground floor" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Default Rent (UGX)</label>
                  <input type="number" value={unitForm.default_rent_amount || ''} onChange={e => setUnitForm({ ...unitForm, default_rent_amount: Number(e.target.value) })} min={0} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="e.g. 1500000" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select value={unitForm.status} onChange={e => setUnitForm({ ...unitForm, status: e.target.value as UnitStatus })} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                    {UNIT_STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button type="button" onClick={() => { setShowUnitForm(null); setEditingUnitId(null); }} className="px-5 py-2.5 text-gray-600 hover:bg-gray-100 rounded-lg font-medium">Cancel</button>
                <button type="submit" className="bg-blue-600 text-white px-6 py-2.5 rounded-lg hover:bg-blue-700 font-medium">{editingUnitId ? 'Update' : 'Add Unit'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {toast && <Toast message={toast} onDismiss={() => setToast('')} />}
    </div>
  );
}
