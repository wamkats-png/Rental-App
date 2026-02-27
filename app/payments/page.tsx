'use client';

import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { formatUGX, formatDate } from '../lib/utils';
import { exportToCSV } from '../lib/csvExport';
import { PaymentMethod } from '../types';

const PAYMENT_METHODS: PaymentMethod[] = ['Cash', 'Mobile_Money', 'Bank'];

function generateReceiptNumber() {
  const now = new Date();
  const date = now.toISOString().split('T')[0].replace(/-/g, '');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `RF-${date}-${rand}`;
}

export default function PaymentsPage() {
  const { properties, units, tenants, leases, payments, addPayment, deletePayment } = useApp();
  const [showModal, setShowModal] = useState(false);
  const [showReceipt, setShowReceipt] = useState<string | null>(null);
  const [filterMonth, setFilterMonth] = useState('');
  const [filterTenant, setFilterTenant] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const activeLeases = leases.filter(l => l.status === 'Active');
  const today = new Date().toISOString().split('T')[0];

  const [form, setForm] = useState({
    lease_id: '', date: today, amount: 0, payment_method: 'Mobile_Money' as PaymentMethod,
    period_start: '', period_end: '', withholding_tax_amount: 0, receipt_number: generateReceiptNumber(),
  });

  const selectedLease = activeLeases.find(l => l.id === form.lease_id);

  const handleLeaseChange = (leaseId: string) => {
    const lease = activeLeases.find(l => l.id === leaseId);
    const amt = lease?.rent_amount || 0;
    const wht = Math.round(amt * 0.06);
    setForm(prev => ({ ...prev, lease_id: leaseId, amount: amt, withholding_tax_amount: wht }));
  };

  const handleAmountChange = (amount: number) => {
    setForm(prev => ({ ...prev, amount, withholding_tax_amount: Math.round(amount * 0.06) }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.lease_id || !form.date || form.amount <= 0) return;
    const lease = activeLeases.find(l => l.id === form.lease_id);
    if (!lease) return;
    addPayment({
      landlord_id: lease.landlord_id, tenant_id: lease.tenant_id, property_id: lease.property_id,
      unit_id: lease.unit_id, lease_id: lease.id, date: form.date, amount: form.amount,
      payment_method: form.payment_method, period_start: form.period_start, period_end: form.period_end,
      withholding_tax_amount: form.withholding_tax_amount, receipt_number: form.receipt_number,
    });
    setForm({ lease_id: '', date: today, amount: 0, payment_method: 'Mobile_Money', period_start: '', period_end: '', withholding_tax_amount: 0, receipt_number: generateReceiptNumber() });
    setShowModal(false);
  };

  let filteredPayments = payments;
  if (filterMonth) {
    filteredPayments = filteredPayments.filter(p => p.date.startsWith(filterMonth));
  }
  if (filterTenant) {
    filteredPayments = filteredPayments.filter(p => p.tenant_id === filterTenant);
  }
  const sortedPayments = [...filteredPayments].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const totalFiltered = sortedPayments.reduce((s, p) => s + p.amount, 0);
  const totalWHT = sortedPayments.reduce((s, p) => s + p.withholding_tax_amount, 0);

  const handleExport = () => {
    exportToCSV(sortedPayments.map(p => ({
      Date: p.date, Tenant: tenants.find(t => t.id === p.tenant_id)?.full_name || '',
      Property: properties.find(pr => pr.id === p.property_id)?.name || '',
      Unit: units.find(u => u.id === p.unit_id)?.code || '',
      Amount: p.amount, Method: p.payment_method, WHT: p.withholding_tax_amount,
      Receipt: p.receipt_number, Period: `${p.period_start} to ${p.period_end}`,
    })), 'payments');
  };

  const receiptPayment = showReceipt ? payments.find(p => p.id === showReceipt) : null;

  const months = Array.from(new Set(payments.map(p => p.date.slice(0, 7)))).sort().reverse();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Payments</h1>
          <p className="text-sm text-gray-500 mt-1">Record and track rent payments</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExport} className="bg-gray-100 text-gray-700 px-4 py-2.5 rounded-lg hover:bg-gray-200 transition font-medium text-sm">Export CSV</button>
          <button onClick={() => setShowModal(true)} className="bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 transition font-medium">+ Record Payment</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Total Collected</p>
          <p className="text-2xl font-bold text-green-600">{formatUGX(totalFiltered)}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Withholding Tax</p>
          <p className="text-2xl font-bold text-orange-600">{formatUGX(totalWHT)}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Transactions</p>
          <p className="text-2xl font-bold text-blue-600">{sortedPayments.length}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4 mb-6 flex flex-wrap gap-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Month</label>
          <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
            <option value="">All months</option>
            {months.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Tenant</label>
          <select value={filterTenant} onChange={e => setFilterTenant(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
            <option value="">All tenants</option>
            {tenants.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
          </select>
        </div>
      </div>

      {sortedPayments.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <p className="text-gray-500 text-lg">{payments.length === 0 ? 'No payments recorded yet.' : 'No payments match filters.'}</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left py-3 px-4 font-medium text-gray-600">Date</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">Tenant</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">Property / Unit</th>
                <th className="text-right py-3 px-4 font-medium text-gray-600">Amount</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">Method</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">Receipt</th>
                <th className="text-right py-3 px-4 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedPayments.map(p => (
                <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-3 px-4">{formatDate(p.date)}</td>
                  <td className="py-3 px-4 font-medium">{tenants.find(t => t.id === p.tenant_id)?.full_name || 'Unknown'}</td>
                  <td className="py-3 px-4 text-gray-600">{properties.find(pr => pr.id === p.property_id)?.name} / {units.find(u => u.id === p.unit_id)?.code}</td>
                  <td className="py-3 px-4 text-right font-medium text-green-700">{formatUGX(p.amount)}</td>
                  <td className="py-3 px-4"><span className="px-2 py-0.5 bg-gray-100 rounded text-xs">{p.payment_method.replace('_', ' ')}</span></td>
                  <td className="py-3 px-4 text-xs text-gray-500">{p.receipt_number}</td>
                  <td className="py-3 px-4 text-right">
                    <button onClick={() => setShowReceipt(p.id)} className="text-blue-600 hover:text-blue-800 text-sm mr-2">Receipt</button>
                    {deleteConfirmId === p.id ? (
                      <>
                        <button onClick={() => { deletePayment(p.id); setDeleteConfirmId(null); }} className="bg-red-600 text-white px-2 py-1 rounded text-xs mr-1">Yes</button>
                        <button onClick={() => setDeleteConfirmId(null)} className="text-gray-600 text-xs">No</button>
                      </>
                    ) : (
                      <button onClick={() => setDeleteConfirmId(p.id)} className="text-red-600 hover:text-red-800 text-sm">Delete</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Record Payment Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-bold text-gray-800">Record Payment</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Lease (Active) *</label>
                <select value={form.lease_id} onChange={e => handleLeaseChange(e.target.value)} required className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500">
                  <option value="">Select lease</option>
                  {activeLeases.map(l => {
                    const t = tenants.find(x => x.id === l.tenant_id);
                    const p = properties.find(x => x.id === l.property_id);
                    const u = units.find(x => x.id === l.unit_id);
                    return <option key={l.id} value={l.id}>{t?.full_name} - {p?.name} / {u?.code} ({formatUGX(l.rent_amount)})</option>;
                  })}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
                  <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} required className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount *</label>
                  <input type="number" value={form.amount || ''} onChange={e => handleAmountChange(Number(e.target.value))} required min={1} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                <select value={form.payment_method} onChange={e => setForm({ ...form, payment_method: e.target.value as PaymentMethod })} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500">
                  {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Period Start</label>
                  <input type="date" value={form.period_start} onChange={e => setForm({ ...form, period_start: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Period End</label>
                  <input type="date" value={form.period_end} onChange={e => setForm({ ...form, period_end: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Withholding Tax (6%)</label>
                  <input type="number" value={form.withholding_tax_amount} onChange={e => setForm({ ...form, withholding_tax_amount: Number(e.target.value) })} className="w-full border rounded-lg px-3 py-2 text-sm bg-gray-50" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Receipt Number</label>
                  <input type="text" value={form.receipt_number} readOnly className="w-full border rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-500" />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button type="button" onClick={() => setShowModal(false)} className="px-5 py-2.5 text-gray-600 hover:bg-gray-100 rounded-lg font-medium">Cancel</button>
                <button type="submit" className="bg-blue-600 text-white px-6 py-2.5 rounded-lg hover:bg-blue-700 font-medium">Record Payment</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {showReceipt && receiptPayment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="p-6" id="receipt-content">
              <div className="text-center border-b pb-4 mb-4">
                <h2 className="text-xl font-bold text-gray-800">RentFlow Uganda</h2>
                <p className="text-sm text-gray-500">Payment Receipt</p>
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Receipt No:</span><span className="font-medium">{receiptPayment.receipt_number}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Date:</span><span className="font-medium">{formatDate(receiptPayment.date)}</span></div>
                <hr />
                <div className="flex justify-between"><span className="text-gray-500">Tenant:</span><span className="font-medium">{tenants.find(t => t.id === receiptPayment.tenant_id)?.full_name}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Property:</span><span className="font-medium">{properties.find(p => p.id === receiptPayment.property_id)?.name}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Unit:</span><span className="font-medium">{units.find(u => u.id === receiptPayment.unit_id)?.code}</span></div>
                <hr />
                <div className="flex justify-between text-lg"><span className="text-gray-500">Amount Paid:</span><span className="font-bold text-green-700">{formatUGX(receiptPayment.amount)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Method:</span><span className="font-medium">{receiptPayment.payment_method.replace('_', ' ')}</span></div>
                {receiptPayment.period_start && receiptPayment.period_end && (
                  <div className="flex justify-between"><span className="text-gray-500">Period:</span><span className="font-medium">{formatDate(receiptPayment.period_start)} - {formatDate(receiptPayment.period_end)}</span></div>
                )}
                <div className="flex justify-between"><span className="text-gray-500">WHT Deducted:</span><span className="font-medium text-orange-600">{formatUGX(receiptPayment.withholding_tax_amount)}</span></div>
              </div>
              <div className="mt-6 pt-4 border-t text-center text-xs text-gray-400">
                <p>Thank you for your payment</p>
                <p>RentFlow Uganda - Property Management System</p>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-4 border-t">
              <button onClick={() => setShowReceipt(null)} className="px-5 py-2.5 text-gray-600 hover:bg-gray-100 rounded-lg font-medium">Close</button>
              <button onClick={() => window.print()} className="bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 font-medium">Print</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
