'use client';

import { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '../../context/AppContext';
import { supabase } from '../../lib/supabase';
import type { UnitStatus, CommPreference, PaymentMethod, PropertyType } from '../../types';

// ── Types ────────────────────────────────────────────────────────────────────

interface PortfolioData {
  summary: string;
  properties: ExtractedProperty[];
  units: ExtractedUnit[];
  tenants: ExtractedTenant[];
  payments: ExtractedPayment[];
}

interface ExtractedProperty {
  name: string;
  address: string;
  district: string;
  lc_area: string;
  property_type: PropertyType;
}

interface ExtractedUnit {
  property_name: string;
  code: string;
  description: string;
  bedrooms: number;
  default_rent_amount: number;
  status: UnitStatus;
}

interface ExtractedTenant {
  full_name: string;
  phone: string;
  national_id: string;
  address: string;
  unit_code: string;
  property_name: string;
  comm_preference: CommPreference;
}

interface ExtractedPayment {
  tenant_name: string;
  unit_code: string;
  property_name: string;
  amount: number;
  date: string;
  method: PaymentMethod;
  period_start: string;
  period_end: string;
}

type Step = 'drop' | 'reading' | 'preview' | 'importing' | 'done';

interface ImportProgress {
  properties: { done: number; total: number; status: 'pending' | 'running' | 'done' | 'error' };
  units: { done: number; total: number; status: 'pending' | 'running' | 'done' | 'error' };
  tenants: { done: number; total: number; status: 'pending' | 'running' | 'done' | 'error' };
  payments: { done: number; total: number; status: 'pending' | 'running' | 'done' | 'error' };
}

// ── Extract text from file ────────────────────────────────────────────────────

async function extractTextFromFile(file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';

  if (['xlsx', 'xls', 'ods'].includes(ext)) {
    const XLSX = await import('xlsx');
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const parts: string[] = [];
    wb.SheetNames.forEach(name => {
      const ws = wb.Sheets[name];
      const csv = XLSX.utils.sheet_to_csv(ws);
      if (csv.trim().replace(/,+/g, '').trim()) {
        parts.push(`=== Sheet: ${name} ===\n${csv}`);
      }
    });
    return parts.join('\n\n');
  }

  if (ext === 'pdf') {
    const pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    const pages: string[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      pages.push(content.items.map((item: unknown) => ('str' in (item as object) ? (item as { str: string }).str : '')).join(' '));
    }
    return pages.join('\n');
  }

  if (['docx', 'doc'].includes(ext)) {
    const mammoth = await import('mammoth');
    const buf = await file.arrayBuffer();
    const result = await (mammoth as unknown as { extractRawText: (o: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }> }).extractRawText({ arrayBuffer: buf });
    return result.value;
  }

  // Plain text / CSV / TSV
  return file.text();
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function PortfolioImportPage() {
  const router = useRouter();
  const { landlord, properties: existingProperties } = useApp();
  const [step, setStep] = useState<Step>('drop');
  const [dragging, setDragging] = useState(false);
  const [filename, setFilename] = useState('');
  const [portfolio, setPortfolio] = useState<PortfolioData | null>(null);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState<ImportProgress>({
    properties: { done: 0, total: 0, status: 'pending' },
    units: { done: 0, total: 0, status: 'pending' },
    tenants: { done: 0, total: 0, status: 'pending' },
    payments: { done: 0, total: 0, status: 'pending' },
  });
  const [finalCounts, setFinalCounts] = useState({ properties: 0, units: 0, tenants: 0, payments: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── File handling ──

  const handleFile = useCallback(async (file: File) => {
    setFilename(file.name);
    setError('');
    setStep('reading');

    try {
      const text = await extractTextFromFile(file);
      if (!text.trim()) throw new Error('File appears to be empty or unreadable.');

      const res = await fetch('/api/ai-import/portfolio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, filename: file.name }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'AI extraction failed.');

      setPortfolio(data as PortfolioData);
      setStep('preview');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
      setStep('drop');
    }
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const onFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  // ── Import execution ──

  const runImport = useCallback(async () => {
    if (!portfolio || !landlord.id || !supabase) return;
    setStep('importing');

    const landlordId = landlord.id;
    const { properties: props, units, tenants, payments } = portfolio;

    // Track counts
    let propCount = 0, unitCount = 0, tenantCount = 0, payCount = 0;

    // Maps for resolving IDs
    const propertyIdMap: Record<string, string> = {};
    const unitIdMap: Record<string, string> = {}; // key: `${property_name}|${code}`
    const tenantIdMap: Record<string, string> = {}; // key: full_name
    const leaseIdMap: Record<string, string> = {}; // key: `${tenant_id}|${unit_id}`

    // ── Step 1: Properties ────────────────────────────────────────────────────
    setProgress(p => ({ ...p, properties: { done: 0, total: props.length, status: 'running' } }));

    // Seed map with existing properties (avoid duplicates)
    existingProperties.forEach(ep => { propertyIdMap[ep.name.toLowerCase()] = ep.id; });

    for (const prop of props) {
      const key = prop.name.trim().toLowerCase();
      if (propertyIdMap[key]) {
        // Already exists — reuse
        propCount++;
      } else {
        try {
          const validTypes: PropertyType[] = ['Residential', 'Commercial', 'Mixed'];
          const { data, error } = await supabase
            .from('properties')
            .insert({
              landlord_id: landlordId,
              name: prop.name || 'Unnamed Property',
              address: prop.address || '',
              district: prop.district || 'Kampala',
              lc_area: prop.lc_area || '',
              property_type: validTypes.includes(prop.property_type) ? prop.property_type : 'Residential',
              property_rates_ref: '',
            })
            .select()
            .single();
          if (!error && data) {
            propertyIdMap[key] = data.id;
            propCount++;
          }
        } catch { /* skip */ }
      }
      setProgress(p => ({ ...p, properties: { ...p.properties, done: p.properties.done + 1 } }));
    }
    setProgress(p => ({ ...p, properties: { ...p.properties, status: 'done' } }));

    // ── Step 2: Units ─────────────────────────────────────────────────────────
    setProgress(p => ({ ...p, units: { done: 0, total: units.length, status: 'running' } }));

    for (const unit of units) {
      const propId = propertyIdMap[unit.property_name?.trim().toLowerCase() ?? ''];
      if (!propId) {
        setProgress(p => ({ ...p, units: { ...p.units, done: p.units.done + 1 } }));
        continue;
      }
      const validStatuses: UnitStatus[] = ['Available', 'Occupied', 'Under_maintenance'];
      const mapKey = `${unit.property_name?.toLowerCase()}|${unit.code?.toLowerCase()}`;
      try {
        const { data, error } = await supabase
          .from('units')
          .insert({
            property_id: propId,
            code: unit.code || 'Unit',
            description: unit.description || '',
            bedrooms: Number(unit.bedrooms) || 1,
            default_rent_amount: Number(unit.default_rent_amount) || 0,
            status: validStatuses.includes(unit.status) ? unit.status : 'Available',
          })
          .select()
          .single();
        if (!error && data) {
          unitIdMap[mapKey] = data.id;
          unitCount++;
        }
      } catch { /* skip duplicate */ }
      setProgress(p => ({ ...p, units: { ...p.units, done: p.units.done + 1 } }));
    }
    setProgress(p => ({ ...p, units: { ...p.units, status: 'done' } }));

    // ── Step 3: Tenants + auto-leases ────────────────────────────────────────
    setProgress(p => ({ ...p, tenants: { done: 0, total: tenants.length, status: 'running' } }));

    for (const tenant of tenants) {
      const validComm: CommPreference[] = ['WhatsApp', 'Email', 'SMS'];
      let tenantId: string | null = null;
      try {
        const { data, error } = await supabase
          .from('tenants')
          .insert({
            landlord_id: landlordId,
            full_name: tenant.full_name || 'Unknown Tenant',
            phone: tenant.phone || '',
            email: '',
            national_id: tenant.national_id || '',
            address: tenant.address || '',
            comm_preference: validComm.includes(tenant.comm_preference) ? tenant.comm_preference : 'WhatsApp',
          })
          .select()
          .single();
        if (!error && data) {
          tenantId = data.id;
          tenantIdMap[tenant.full_name?.toLowerCase() ?? ''] = data.id;
          tenantCount++;
        } else if (error?.message?.includes('duplicate') || error?.code === '23505') {
          // Look up existing tenant by phone
          const { data: existing } = await supabase
            .from('tenants')
            .select('id')
            .eq('landlord_id', landlordId)
            .eq('phone', tenant.phone || '')
            .single();
          if (existing) {
            tenantId = existing.id;
            tenantIdMap[tenant.full_name?.toLowerCase() ?? ''] = existing.id;
          }
        }
      } catch { /* skip */ }

      // Auto-create lease if tenant has a unit assignment
      if (tenantId && tenant.unit_code && tenant.property_name) {
        const unitKey = `${tenant.property_name.toLowerCase()}|${tenant.unit_code.toLowerCase()}`;
        const unitId = unitIdMap[unitKey];
        const propId = propertyIdMap[tenant.property_name.toLowerCase()];

        if (unitId && propId) {
          const leaseKey = `${tenantId}|${unitId}`;
          try {
            // Find matching unit for rent amount
            const matchedUnit = units.find(
              u => u.property_name?.toLowerCase() === tenant.property_name?.toLowerCase() &&
                   u.code?.toLowerCase() === tenant.unit_code?.toLowerCase()
            );
            const rentAmount = matchedUnit?.default_rent_amount || 0;

            const today = new Date();
            const startDate = new Date(today.getFullYear() - 1, today.getMonth(), 1).toISOString().split('T')[0];
            const endDate = new Date(today.getFullYear(), today.getMonth() + 11, 30).toISOString().split('T')[0];

            const { data: leaseData } = await supabase
              .from('leases')
              .insert({
                landlord_id: landlordId,
                property_id: propId,
                unit_id: unitId,
                tenant_id: tenantId,
                contract_type: 'Residential',
                rent_amount: rentAmount,
                payment_frequency: 'Monthly',
                currency: 'UGX',
                start_date: startDate,
                end_date: endDate,
                due_day: 5,
                grace_period_days: 5,
                deposit_amount: 0,
                utilities_responsibility: 'Tenant',
                notice_period_days: 30,
                status: 'Active',
              })
              .select()
              .single();

            if (leaseData) {
              leaseIdMap[leaseKey] = leaseData.id;
              // Update unit status to Occupied
              await supabase.from('units').update({ status: 'Occupied' }).eq('id', unitId);
            }
          } catch { /* skip lease creation errors */ }
        }
      }

      setProgress(p => ({ ...p, tenants: { ...p.tenants, done: p.tenants.done + 1 } }));
    }
    setProgress(p => ({ ...p, tenants: { ...p.tenants, status: 'done' } }));

    // ── Step 4: Payments ─────────────────────────────────────────────────────
    setProgress(p => ({ ...p, payments: { done: 0, total: payments.length, status: 'running' } }));

    for (const payment of payments) {
      const tenantId = tenantIdMap[payment.tenant_name?.toLowerCase() ?? ''];
      if (!tenantId) {
        setProgress(p => ({ ...p, payments: { ...p.payments, done: p.payments.done + 1 } }));
        continue;
      }
      const unitKey = `${payment.property_name?.toLowerCase()}|${payment.unit_code?.toLowerCase()}`;
      const unitId = unitIdMap[unitKey];
      const propId = propertyIdMap[payment.property_name?.toLowerCase() ?? ''];
      const leaseId = unitId && tenantId ? leaseIdMap[`${tenantId}|${unitId}`] : null;

      if (!unitId || !propId || !leaseId) {
        setProgress(p => ({ ...p, payments: { ...p.payments, done: p.payments.done + 1 } }));
        continue;
      }

      const validMethods: PaymentMethod[] = ['Cash', 'Mobile_Money', 'Bank'];
      try {
        const { error } = await supabase.from('payments').insert({
          landlord_id: landlordId,
          tenant_id: tenantId,
          property_id: propId,
          unit_id: unitId,
          lease_id: leaseId,
          date: payment.date || new Date().toISOString().split('T')[0],
          amount: Number(payment.amount) || 0,
          payment_method: validMethods.includes(payment.method) ? payment.method : 'Cash',
          period_start: payment.period_start || '',
          period_end: payment.period_end || '',
          withholding_tax_amount: 0,
          receipt_number: `IMP-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        });
        if (!error) payCount++;
      } catch { /* skip */ }

      setProgress(p => ({ ...p, payments: { ...p.payments, done: p.payments.done + 1 } }));
    }
    setProgress(p => ({ ...p, payments: { ...p.payments, status: 'done' } }));

    setFinalCounts({ properties: propCount, units: unitCount, tenants: tenantCount, payments: payCount });
    setStep('done');
  }, [portfolio, landlord.id, existingProperties]);

  // ── Render helpers ────────────────────────────────────────────────────────

  const StatusIcon = ({ status }: { status: ImportProgress[keyof ImportProgress]['status'] }) => {
    if (status === 'done') return <span className="text-green-500 text-lg">✓</span>;
    if (status === 'running') return <span className="animate-spin inline-block text-blue-500">⟳</span>;
    if (status === 'error') return <span className="text-red-500">✗</span>;
    return <span className="text-gray-300">○</span>;
  };

  const ProgressBar = ({ done, total }: { done: number; total: number }) => {
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    return (
      <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5 mt-1">
        <div
          className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center gap-4">
        <button
          onClick={() => router.push('/import')}
          className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
        >
          ← Back
        </button>
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">AI Portfolio Import</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">Drop any file — Claude extracts everything</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 px-3 py-1 rounded-full text-xs font-medium">
          <span>✨</span> Powered by Claude AI
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6">

        {/* ── Step: Drop ── */}
        {step === 'drop' && (
          <div className="w-full max-w-xl">
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${
                dragging
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              <input ref={fileInputRef} type="file" className="hidden" onChange={onFileSelect}
                accept=".xlsx,.xls,.csv,.tsv,.pdf,.docx,.doc,.txt,.ods" />
              <div className="text-5xl mb-4">📂</div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Drop your portfolio file</h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
                Excel · CSV · PDF · Word · Any format
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-6">
                Claude reads every sheet and extracts properties, units, tenants, and payment history automatically
              </p>
              <button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors">
                Choose File
              </button>
            </div>

            {error && (
              <div className="mt-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-700 dark:text-red-400">
                {error}
              </div>
            )}

            <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-6">
              Your data never leaves your account — extracted by Claude then saved directly to your RentFlow database
            </p>
          </div>
        )}

        {/* ── Step: Reading ── */}
        {step === 'reading' && (
          <div className="text-center">
            <div className="text-6xl mb-6 animate-pulse">🤖</div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Claude is reading your file...
            </h2>
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-8">
              Extracting properties, units, tenants, and payment history from <span className="font-medium">{filename}</span>
            </p>
            <div className="flex flex-col gap-2 text-sm text-gray-400 dark:text-gray-500 animate-pulse">
              <p>Detecting sheet structure...</p>
              <p>Mapping column headers...</p>
              <p>Identifying entity types...</p>
              <p>Validating relationships...</p>
            </div>
          </div>
        )}

        {/* ── Step: Preview ── */}
        {step === 'preview' && portfolio && (
          <div className="w-full max-w-2xl">
            <div className="text-center mb-6">
              <div className="text-4xl mb-2">✨</div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Found your portfolio</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">from {filename}</p>
            </div>

            {/* AI Summary */}
            <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border border-purple-100 dark:border-purple-800 rounded-xl p-4 mb-6">
              <div className="flex items-start gap-2">
                <span className="text-purple-500 mt-0.5">🤖</span>
                <p className="text-sm text-gray-700 dark:text-gray-300 italic">{portfolio.summary}</p>
              </div>
            </div>

            {/* Entity Count Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              {[
                { label: 'Properties', count: portfolio.properties.length, icon: '🏘️', color: 'blue' },
                { label: 'Units', count: portfolio.units.length, icon: '🚪', color: 'green' },
                { label: 'Tenants', count: portfolio.tenants.length, icon: '👤', color: 'orange' },
                { label: 'Payments', count: portfolio.payments.length, icon: '💰', color: 'purple' },
              ].map(({ label, count, icon, color }) => (
                <div key={label} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 text-center">
                  <div className="text-2xl mb-1">{icon}</div>
                  <div className={`text-2xl font-bold text-${color}-600 dark:text-${color}-400`}>{count}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
                </div>
              ))}
            </div>

            {/* Preview Tables */}
            {portfolio.properties.length > 0 && (
              <details className="mb-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <summary className="px-4 py-3 cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-750">
                  🏘️ {portfolio.properties.length} Properties
                </summary>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        {['Name', 'Address', 'District', 'Type'].map(h => (
                          <th key={h} className="px-3 py-2 text-left text-gray-500 dark:text-gray-400 font-medium">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {portfolio.properties.slice(0, 5).map((p, i) => (
                        <tr key={i} className="border-t border-gray-100 dark:border-gray-700">
                          <td className="px-3 py-2 font-medium text-gray-900 dark:text-white">{p.name}</td>
                          <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{p.address}</td>
                          <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{p.district}</td>
                          <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{p.property_type}</td>
                        </tr>
                      ))}
                      {portfolio.properties.length > 5 && (
                        <tr className="border-t border-gray-100 dark:border-gray-700">
                          <td colSpan={4} className="px-3 py-2 text-gray-400 dark:text-gray-500 text-center">
                            +{portfolio.properties.length - 5} more
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </details>
            )}

            {portfolio.tenants.length > 0 && (
              <details className="mb-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <summary className="px-4 py-3 cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-750">
                  👤 {portfolio.tenants.length} Tenants
                </summary>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        {['Name', 'Phone', 'Unit', 'Property'].map(h => (
                          <th key={h} className="px-3 py-2 text-left text-gray-500 dark:text-gray-400 font-medium">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {portfolio.tenants.slice(0, 5).map((t, i) => (
                        <tr key={i} className="border-t border-gray-100 dark:border-gray-700">
                          <td className="px-3 py-2 font-medium text-gray-900 dark:text-white">{t.full_name}</td>
                          <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{t.phone}</td>
                          <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{t.unit_code}</td>
                          <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{t.property_name}</td>
                        </tr>
                      ))}
                      {portfolio.tenants.length > 5 && (
                        <tr className="border-t border-gray-100 dark:border-gray-700">
                          <td colSpan={4} className="px-3 py-2 text-gray-400 dark:text-gray-500 text-center">
                            +{portfolio.tenants.length - 5} more
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </details>
            )}

            {/* Import CTA */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={runImport}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-semibold text-sm transition-colors"
              >
                Import All ({portfolio.properties.length + portfolio.units.length + portfolio.tenants.length + portfolio.payments.length} records)
              </button>
              <button
                onClick={() => { setStep('drop'); setPortfolio(null); }}
                className="px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Re-upload
              </button>
            </div>
          </div>
        )}

        {/* ── Step: Importing ── */}
        {step === 'importing' && (
          <div className="w-full max-w-sm">
            <div className="text-center mb-8">
              <div className="text-5xl mb-3">⚡</div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Importing your portfolio</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Please keep this page open</p>
            </div>

            <div className="space-y-4">
              {(
                [
                  { key: 'properties', label: 'Properties', icon: '🏘️' },
                  { key: 'units', label: 'Units', icon: '🚪' },
                  { key: 'tenants', label: 'Tenants + Leases', icon: '👤' },
                  { key: 'payments', label: 'Payment History', icon: '💰' },
                ] as const
              ).map(({ key, label, icon }) => {
                const p = progress[key];
                return (
                  <div key={key} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {icon} {label}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400">{p.done}/{p.total}</span>
                        <StatusIcon status={p.status} />
                      </div>
                    </div>
                    <ProgressBar done={p.done} total={p.total} />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Step: Done ── */}
        {step === 'done' && (
          <div className="text-center max-w-md">
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Portfolio imported!
            </h2>
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-8">
              Your entire rental portfolio is now live in RentFlow
            </p>

            <div className="grid grid-cols-2 gap-3 mb-8">
              {[
                { label: 'Properties', count: finalCounts.properties, icon: '🏘️' },
                { label: 'Units', count: finalCounts.units, icon: '🚪' },
                { label: 'Tenants', count: finalCounts.tenants, icon: '👤' },
                { label: 'Payments', count: finalCounts.payments, icon: '💰' },
              ].map(({ label, count, icon }) => (
                <div key={label} className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4">
                  <div className="text-2xl mb-1">{icon}</div>
                  <div className="text-xl font-bold text-green-700 dark:text-green-400">{count}</div>
                  <div className="text-xs text-green-600 dark:text-green-500">{label} added</div>
                </div>
              ))}
            </div>

            <button
              onClick={() => router.push('/dashboard')}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-semibold text-sm transition-colors"
            >
              Go to Dashboard →
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
