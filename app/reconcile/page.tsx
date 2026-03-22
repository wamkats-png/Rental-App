'use client';

import { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { formatUGX, formatDate } from '../lib/utils';

interface BankRow {
  date: string;
  description: string;
  amount: number;
  reference: string;
  raw: string;
}

interface MatchResult {
  bank: BankRow;
  matchedPaymentId: string | null;
  matchedAmount: number | null;
  status: 'matched' | 'unmatched' | 'amount_mismatch';
}

function parseBankCSV(text: string): BankRow[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  // Normalize header: date,description,amount,reference (case-insensitive)
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));
  return lines.slice(1).filter(l => l.trim()).map(line => {
    const vals = line.split(',');
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = (vals[i] ?? '').trim().replace(/^"|"$/g, ''); });
    return {
      date: row.date ?? '',
      description: row.description ?? '',
      amount: parseFloat((row.amount ?? '0').replace(/[^0-9.-]/g, '')) || 0,
      reference: row.reference ?? row.ref ?? row.receipt ?? '',
      raw: line,
    };
  });
}

const STATUS_BADGE: Record<MatchResult['status'], { label: string; cls: string }> = {
  matched:        { label: 'Matched',        cls: 'bg-green-100 text-green-700' },
  unmatched:      { label: 'Unmatched',      cls: 'bg-red-100 text-red-700' },
  amount_mismatch:{ label: 'Amount Mismatch',cls: 'bg-yellow-100 text-yellow-700' },
};

export default function ReconcilePage() {
  const { payments, tenants } = useApp();
  const [rows, setRows] = useState<MatchResult[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | MatchResult['status']>('all');
  const fileRef = useRef<HTMLInputElement>(null);

  const tenantMap = Object.fromEntries(tenants.map(t => [t.id, t.full_name]));

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = e => {
      const text = e.target?.result as string;
      const bankRows = parseBankCSV(text);

      const results: MatchResult[] = bankRows.map(bank => {
        // Match by receipt_number (exact) first, then by amount + date proximity
        const byReceipt = bank.reference
          ? payments.find(p => p.receipt_number?.toLowerCase() === bank.reference.toLowerCase())
          : null;

        if (byReceipt) {
          const status = Math.abs(byReceipt.amount - bank.amount) < 1 ? 'matched' : 'amount_mismatch';
          return { bank, matchedPaymentId: byReceipt.id, matchedAmount: byReceipt.amount, status };
        }

        // Try match by amount and date (within 2 days)
        const bankDate = new Date(bank.date).getTime();
        const byAmountDate = payments.find(p => {
          if (Math.abs(p.amount - bank.amount) >= 1) return false;
          const diff = Math.abs(new Date(p.date).getTime() - bankDate);
          return diff <= 2 * 86400000;
        });

        if (byAmountDate) {
          return { bank, matchedPaymentId: byAmountDate.id, matchedAmount: byAmountDate.amount, status: 'matched' as const };
        }

        return { bank, matchedPaymentId: null, matchedAmount: null, status: 'unmatched' as const };
      });

      setRows(results);
    };
    reader.readAsText(file);
  };

  const filtered = statusFilter === 'all' ? rows : rows.filter(r => r.status === statusFilter);
  const counts = {
    matched: rows.filter(r => r.status === 'matched').length,
    unmatched: rows.filter(r => r.status === 'unmatched').length,
    amount_mismatch: rows.filter(r => r.status === 'amount_mismatch').length,
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Bank Reconciliation</h1>
        <p className="text-sm text-gray-500 mt-1">Upload a bank statement CSV and match entries against recorded payments</p>
      </div>

      {/* Format guide */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <p className="text-sm font-semibold text-blue-800 mb-1">Expected CSV columns</p>
        <code className="text-xs text-blue-700">date, description, amount, reference</code>
        <p className="text-xs text-blue-600 mt-1">
          The <strong>reference</strong> column should match the receipt number. Matching also falls back to amount + date proximity (±2 days).
        </p>
      </div>

      {/* Upload */}
      {rows.length === 0 ? (
        <div
          className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center hover:border-blue-400 transition-colors cursor-pointer"
          onClick={() => fileRef.current?.click()}
          onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
          onDragOver={e => e.preventDefault()}
        >
          <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-gray-600 font-medium mb-1">Drop your bank statement CSV here</p>
          <p className="text-sm text-gray-400">or click to browse</p>
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-4">
            {((['matched', 'amount_mismatch', 'unmatched'] as const)).map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(prev => prev === s ? 'all' : s)}
                className={`rounded-lg p-4 text-left border-2 transition ${statusFilter === s ? 'border-blue-500' : 'border-transparent'} ${
                  s === 'matched' ? 'bg-green-50' : s === 'unmatched' ? 'bg-red-50' : 'bg-yellow-50'
                }`}
              >
                <p className="text-2xl font-bold">{counts[s]}</p>
                <p className="text-sm text-gray-600">{STATUS_BADGE[s].label}</p>
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">{filtered.length} of {rows.length} rows</p>
            <button
              onClick={() => { setRows([]); if (fileRef.current) fileRef.current.value = ''; }}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Upload different file
            </button>
          </div>

          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
                  <tr>
                    <th className="px-3 py-3 text-left">Status</th>
                    <th className="px-3 py-3 text-left">Bank Date</th>
                    <th className="px-3 py-3 text-left">Description</th>
                    <th className="px-3 py-3 text-right">Bank Amount</th>
                    <th className="px-3 py-3 text-left">Reference</th>
                    <th className="px-3 py-3 text-right">Matched Amount</th>
                    <th className="px-3 py-3 text-left">Tenant</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map((r, i) => {
                    const payment = r.matchedPaymentId ? payments.find(p => p.id === r.matchedPaymentId) : null;
                    const badge = STATUS_BADGE[r.status];
                    return (
                      <tr key={i} className={r.status === 'unmatched' ? 'bg-red-50' : r.status === 'amount_mismatch' ? 'bg-yellow-50' : ''}>
                        <td className="px-3 py-2">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${badge.cls}`}>{badge.label}</span>
                        </td>
                        <td className="px-3 py-2 text-gray-700">{r.bank.date}</td>
                        <td className="px-3 py-2 text-gray-700 max-w-xs truncate">{r.bank.description}</td>
                        <td className="px-3 py-2 text-right font-medium text-gray-800">{formatUGX(r.bank.amount)}</td>
                        <td className="px-3 py-2 text-gray-500 font-mono text-xs">{r.bank.reference || '—'}</td>
                        <td className="px-3 py-2 text-right text-gray-700">{r.matchedAmount != null ? formatUGX(r.matchedAmount) : '—'}</td>
                        <td className="px-3 py-2 text-gray-700">{payment ? (tenantMap[payment.tenant_id] ?? '—') : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
