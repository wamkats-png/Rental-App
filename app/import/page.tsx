'use client';

import { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import {
  parseCSV, mapUnitRow, mapPropertyRow,
  UNIT_SAMPLE_HEADERS, UNIT_SAMPLE_ROWS,
  PROPERTY_SAMPLE_HEADERS, PROPERTY_SAMPLE_ROWS,
  buildSampleCSV, downloadSample,
  type ParsedRow,
} from '../lib/csvImport';
import type { UnitStatus, PropertyType } from '../types';

type Tab = 'units' | 'properties';
type ImportMode = 'standard' | 'ai';

interface ImportRow {
  row: ParsedRow;
  errors: string[];
  mapped: Record<string, string>;
}

interface AiPortfolioResult {
  summary: string;
  properties: Array<{ name: string; address: string; district: string; lc_area: string; property_type: PropertyType }>;
  units: Array<{ property_name: string; code: string; description: string; bedrooms: number; default_rent_amount: number; status: UnitStatus }>;
}

const REQUIRED_FIELDS: Record<Tab, string[]> = {
  units: ['code', 'property_name'],
  properties: ['name', 'address', 'district'],
};

const FIELD_LABELS: Record<string, string> = {
  code: 'Unit Code', property_name: 'Property', description: 'Description',
  bedrooms: 'Bedrooms', default_rent_amount: 'Monthly Rent (UGX)', status: 'Status',
  name: 'Property Name', address: 'Address', district: 'District',
  lc_area: 'LC Area', property_type: 'Property Type', property_rates_ref: 'Rates Ref',
};

const UNIT_STATUSES: UnitStatus[] = ['Available', 'Occupied', 'Under_maintenance'];
const PROPERTY_TYPES: PropertyType[] = ['Residential', 'Commercial', 'Mixed'];

export default function ImportPage() {
  const { landlord, properties, addUnit, addProperty } = useApp();

  // ── Standard CSV state
  const [activeTab, setActiveTab] = useState<Tab>('units');
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [importing, setImporting] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [skippedCount, setSkippedCount] = useState(0);
  const [done, setDone] = useState(false);
  const [showCompletion, setShowCompletion] = useState(false);
  const [completionData, setCompletionData] = useState<Record<number, Record<string, string>>>({});

  // ── AI mode state
  const [mode, setMode] = useState<ImportMode>('ai');
  const [aiParsing, setAiParsing] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiPortfolio, setAiPortfolio] = useState<AiPortfolioResult | null>(null);
  const [aiImporting, setAiImporting] = useState(false);
  const [aiDone, setAiDone] = useState(false);
  const [aiCounts, setAiCounts] = useState({ properties: 0, units: 0 });
  const [aiFilename, setAiFilename] = useState('');

  const fileRef = useRef<HTMLInputElement>(null);

  const tabHeaders: Record<Tab, string[]> = {
    units: ['code', 'property_name', 'description', 'bedrooms', 'default_rent_amount', 'status'],
    properties: ['name', 'address', 'district', 'lc_area', 'property_type', 'property_rates_ref'],
  };

  const selectedErrorRows = rows
    .map((r, i) => ({ ...r, index: i }))
    .filter(r => selectedIndices.has(r.index) && r.errors.length > 0);

  // ── Text extraction ────────────────────────────────────────────────────────

  const extractText = (file: File): Promise<string> => {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    const isExcel = ['xlsx', 'xls', 'ods'].includes(ext)
      || file.type.includes('spreadsheet') || file.type.includes('excel');
    const isPdf = ext === 'pdf' || file.type === 'application/pdf';
    const isDocx = ['docx', 'doc'].includes(ext)
      || file.type.includes('wordprocessingml') || file.type.includes('msword');

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Failed to read file'));

      if (isPdf) {
        reader.onload = async e => {
          try {
            const pdfjsLib = await import('pdfjs-dist');
            pdfjsLib.GlobalWorkerOptions.workerSrc =
              `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
            const pdf = await pdfjsLib.getDocument({ data: e.target?.result as ArrayBuffer }).promise;
            const pages: string[] = [];
            for (let i = 1; i <= pdf.numPages; i++) {
              const page = await pdf.getPage(i);
              const content = await page.getTextContent();
              pages.push(content.items.map(item => ('str' in item ? (item as { str: string }).str : '')).join(' '));
            }
            resolve(pages.join('\n'));
          } catch {
            reject(new Error('Could not parse PDF. Make sure it contains selectable text (not a scanned image).'));
          }
        };
        reader.readAsArrayBuffer(file);

      } else if (isDocx) {
        reader.onload = async e => {
          try {
            const mammoth = await import('mammoth');
            const result = await mammoth.extractRawText({ arrayBuffer: e.target?.result as ArrayBuffer });
            resolve(result.value);
          } catch {
            reject(new Error('Could not parse Word document.'));
          }
        };
        reader.readAsArrayBuffer(file);

      } else if (isExcel) {
        reader.onload = async e => {
          try {
            const XLSX = await import('xlsx');
            const wb = XLSX.read(e.target?.result, { type: 'array' });
            // Read ALL sheets for AI mode
            const parts: string[] = [];
            wb.SheetNames.forEach(name => {
              const ws = wb.Sheets[name];
              const csv = XLSX.utils.sheet_to_csv(ws);
              if (csv.trim().replace(/,+/g, '').trim()) {
                parts.push(`=== Sheet: ${name} ===\n${csv}`);
              }
            });
            resolve(parts.join('\n\n'));
          } catch {
            reject(new Error('Could not parse Excel file. Please try saving it as CSV first.'));
          }
        };
        reader.readAsArrayBuffer(file);

      } else {
        reader.onload = e => resolve(e.target?.result as string ?? '');
        reader.readAsText(file);
      }
    });
  };

  // ── Standard CSV parsers ───────────────────────────────────────────────────

  const applyRows = (mapped: ImportRow[]) => {
    setRows(mapped);
    setSelectedIndices(new Set(
      mapped.map((r, i) => r.errors.length === 0 ? i : -1).filter(i => i >= 0)
    ));
  };

  const parseStandard = (text: string) => {
    const parsed = parseCSV(text);
    if (parsed.length === 0) return;
    applyRows(parsed.map(row => {
      if (activeTab === 'units') {
        const m = mapUnitRow(row);
        const { errors, ...rest } = m;
        return { row, errors, mapped: rest as unknown as Record<string, string> };
      } else {
        const m = mapPropertyRow(row, landlord.id);
        const { errors, ...rest } = m;
        return { row, errors, mapped: rest as unknown as Record<string, string> };
      }
    }));
  };

  // ── AI mode: portfolio extraction ──────────────────────────────────────────

  const parseWithAI = async (text: string, filename: string) => {
    setAiParsing(true);
    setAiError('');
    setAiPortfolio(null);
    try {
      const res = await fetch('/api/ai-import/portfolio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, filename }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setAiError(data.error ?? 'AI parsing failed. Try again or switch to Standard CSV.');
        return;
      }
      setAiPortfolio({
        summary: data.summary ?? '',
        properties: Array.isArray(data.properties) ? data.properties : [],
        units: Array.isArray(data.units) ? data.units : [],
      });
    } catch {
      setAiError('Network error. Please try again.');
    } finally {
      setAiParsing(false);
    }
  };

  // ── AI mode: import both entity types in order ─────────────────────────────

  const doAiImport = async () => {
    if (!aiPortfolio) return;
    setAiImporting(true);
    let propCount = 0;
    let unitCount = 0;

    // Step 1: Properties — collect returned IDs directly (avoids stale closure)
    const resolvedPropIds: Record<string, string> = {};

    // Seed with already-existing properties
    properties.forEach(p => { resolvedPropIds[p.name.trim().toLowerCase()] = p.id; });

    for (const prop of aiPortfolio.properties) {
      const key = prop.name.trim().toLowerCase();
      if (resolvedPropIds[key]) {
        propCount++;
        continue;
      }
      try {
        const created = await addProperty({
          name: prop.name || 'Unnamed Property',
          address: prop.address || '',
          district: prop.district || 'Kampala',
          lc_area: prop.lc_area || '',
          property_type: PROPERTY_TYPES.includes(prop.property_type) ? prop.property_type : 'Residential',
          property_rates_ref: '',
        });
        if (created) {
          resolvedPropIds[created.name.trim().toLowerCase()] = created.id;
          propCount++;
        }
      } catch { /* skip */ }
    }

    // Step 2: Units — use the collected IDs, auto-create property if still missing
    for (const unit of aiPortfolio.units) {
      const propKey = unit.property_name?.trim().toLowerCase() ?? '';
      let propId = resolvedPropIds[propKey]
        ?? Object.entries(resolvedPropIds).find(([k]) => k.includes(propKey) || propKey.includes(k))?.[1]
        ?? null;

      // Auto-create property if referenced by a unit but not in the extracted list
      if (!propId && unit.property_name?.trim()) {
        try {
          const created = await addProperty({
            name: unit.property_name.trim(),
            address: '',
            district: 'Kampala',
            lc_area: '',
            property_type: 'Residential',
            property_rates_ref: '',
          });
          if (created) {
            resolvedPropIds[created.name.toLowerCase()] = created.id;
            propId = created.id;
            propCount++;
          }
        } catch { /* skip */ }
      }

      if (!propId) continue;

      try {
        const created = await addUnit({
          property_id: propId,
          code: unit.code || 'Unit',
          description: unit.description || '',
          bedrooms: Number(unit.bedrooms) || 1,
          default_rent_amount: Number(unit.default_rent_amount) || 0,
          status: UNIT_STATUSES.includes(unit.status) ? unit.status : 'Available',
        });
        if (created) unitCount++;
      } catch { /* duplicate — skip */ }
    }

    setAiCounts({ properties: propCount, units: unitCount });
    setAiImporting(false);
    setAiDone(true);
  };

  // ── File handler ───────────────────────────────────────────────────────────

  const handleFile = (file: File) => {
    setRows([]);
    setSelectedIndices(new Set());
    setDone(false);
    setImportedCount(0);
    setSkippedCount(0);
    setAiError('');
    setShowCompletion(false);
    setAiPortfolio(null);
    setAiDone(false);
    setAiFilename(file.name);

    if (mode === 'ai') {
      extractText(file)
        .then(text => {
          if (!text?.trim()) { setAiError('File appears to be empty.'); return; }
          parseWithAI(text, file.name);
        })
        .catch(err => setAiError(err.message));
    } else {
      extractText(file)
        .then(text => { if (text?.trim()) parseStandard(text); })
        .catch(err => setAiError(err.message));
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  // ── Selection ──────────────────────────────────────────────────────────────

  const toggleSelect = (i: number) => {
    setSelectedIndices(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIndices.size === rows.length) {
      setSelectedIndices(new Set());
    } else {
      setSelectedIndices(new Set(rows.map((_, i) => i)));
    }
  };

  const selectValid = () => {
    setSelectedIndices(new Set(
      rows.map((r, i) => r.errors.length === 0 ? i : -1).filter(i => i >= 0)
    ));
  };

  // ── Standard import ────────────────────────────────────────────────────────

  const resolvePropertyId = (propertyName: string): string | null => {
    const name = propertyName.trim().toLowerCase();
    const match = properties.find(p =>
      p.name.toLowerCase() === name ||
      p.name.toLowerCase().includes(name) ||
      name.includes(p.name.toLowerCase())
    );
    return match?.id ?? null;
  };

  const handleImportClick = () => {
    if (selectedIndices.size === 0) return;
    if (selectedErrorRows.length > 0) {
      const cd: Record<number, Record<string, string>> = {};
      for (const r of selectedErrorRows) {
        cd[r.index] = { ...r.mapped };
      }
      setCompletionData(cd);
      setShowCompletion(true);
    } else {
      doImport({});
    }
  };

  const doImport = async (overrides: Record<number, Record<string, string>>) => {
    setImporting(true);
    let count = 0;
    let skipped = 0;

    for (const idx of Array.from(selectedIndices)) {
      const base = rows[idx].mapped;
      const finalData = overrides[idx] ? { ...base, ...overrides[idx] } : base;

      try {
        if (activeTab === 'units') {
          let propertyId = resolvePropertyId(finalData.property_name ?? '');
          // Auto-create property if not found — never skip a unit just because the property is missing
          if (!propertyId && finalData.property_name?.trim()) {
            const created = await addProperty({
              name: finalData.property_name.trim(),
              address: '',
              district: 'Kampala',
              lc_area: '',
              property_type: 'Residential',
              property_rates_ref: '',
            });
            propertyId = created?.id ?? null;
          }
          if (!propertyId) { skipped++; continue; }
          const rawStatus = finalData.status ?? '';
          await addUnit({
            property_id: propertyId,
            code: finalData.code ?? '',
            description: finalData.description ?? '',
            bedrooms: parseInt(finalData.bedrooms ?? '1', 10) || 1,
            default_rent_amount: parseInt((finalData.default_rent_amount ?? '0').replace(/[^0-9]/g, ''), 10) || 0,
            status: UNIT_STATUSES.includes(rawStatus as UnitStatus) ? (rawStatus as UnitStatus) : 'Available',
          });
          count++;
        } else {
          await addProperty(finalData as Parameters<typeof addProperty>[0]);
          count++;
        }
      } catch {
        skipped++;
      }
    }

    setImportedCount(count);
    setSkippedCount(skipped);
    setImporting(false);
    setShowCompletion(false);
    setDone(true);
    setRows([]);
  };

  const handleCompletionSubmit = () => { doImport(completionData); };

  const reset = () => {
    setRows([]);
    setSelectedIndices(new Set());
    setDone(false);
    setImportedCount(0);
    setSkippedCount(0);
    setAiError('');
    setShowCompletion(false);
    setAiPortfolio(null);
    setAiDone(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const allSelected = rows.length > 0 && selectedIndices.size === rows.length;
  const acceptTypes = mode === 'ai'
    ? '.csv,.tsv,.txt,.xlsx,.xls,.ods,.pdf,.docx,.doc'
    : '.csv';

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Import Data</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Bulk import properties and units from any file</p>
      </div>

      {/* Mode toggle */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-1 flex gap-1 mb-6 w-fit">
        <button
          onClick={() => { setMode('ai'); reset(); }}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-1.5 ${mode === 'ai' ? 'bg-violet-600 text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          AI Auto-Detect
        </button>
        <button
          onClick={() => { setMode('standard'); reset(); }}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${mode === 'standard' ? 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}
        >
          Standard CSV
        </button>
      </div>

      {/* ── Standard CSV mode: tab selector ── */}
      {mode === 'standard' && (
        <>
          <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6">
            {(['units', 'properties'] as Tab[]).map(tab => (
              <button
                key={tab}
                onClick={() => { setActiveTab(tab); reset(); }}
                className={`px-5 py-2.5 text-sm font-medium capitalize border-b-2 transition -mb-px ${activeTab === tab ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Hints */}
          {activeTab === 'units' && properties.length > 0 && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-3 mb-4 text-xs text-amber-800 dark:text-amber-300">
              <strong>property_name</strong> must match an existing property exactly.
              Your properties: {properties.map(p => `"${p.name}"`).join(', ')}
            </div>
          )}

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4 mb-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-800 dark:text-blue-200">Expected CSV format</p>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">Download the sample template and fill it in with your data</p>
            </div>
            <button
              onClick={() => {
                const content = activeTab === 'units'
                  ? buildSampleCSV(UNIT_SAMPLE_HEADERS, UNIT_SAMPLE_ROWS)
                  : buildSampleCSV(PROPERTY_SAMPLE_HEADERS, PROPERTY_SAMPLE_ROWS);
                downloadSample(`${activeTab}-import-sample.csv`, content);
              }}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 shrink-0"
            >
              Download Sample CSV
            </button>
          </div>
        </>
      )}

      {/* ── AI mode header ── */}
      {mode === 'ai' && !aiPortfolio && !aiParsing && !aiDone && (
        <div className="bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-700 rounded-xl p-4 mb-6">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-violet-100 dark:bg-violet-800 rounded-full flex items-center justify-center shrink-0 mt-0.5">
              <svg className="w-4 h-4 text-violet-600 dark:text-violet-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-violet-800 dark:text-violet-200">AI Auto-Detect — powered by Claude Sonnet</p>
              <p className="text-xs text-violet-600 dark:text-violet-300 mt-1">
                Drop any file. Claude reads every sheet, detects properties <em>and</em> units simultaneously — no need to tell it what type to import.
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                {['Excel (.xlsx)', 'CSV', 'PDF', 'Word (.docx)', 'TSV'].map(fmt => (
                  <span key={fmt} className="text-xs bg-violet-100 dark:bg-violet-800 text-violet-700 dark:text-violet-300 px-2 py-0.5 rounded-full">{fmt}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── States ── */}

      {/* Standard done screen */}
      {mode === 'standard' && done && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${importedCount > 0 ? 'bg-green-100 dark:bg-green-900/30' : 'bg-orange-100 dark:bg-orange-900/30'}`}>
            {importedCount > 0
              ? <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              : <svg className="w-8 h-8 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            }
          </div>
          <p className="text-xl font-bold text-gray-800 dark:text-white mb-2">
            {importedCount > 0 ? 'Import Complete' : 'Import Finished'}
          </p>
          <p className="text-gray-500 dark:text-gray-400 mb-1">
            {importedCount} {activeTab} imported successfully.
          </p>
          {skippedCount > 0 && (
            <p className="text-sm text-orange-600 dark:text-orange-400 mb-1">
              {skippedCount} skipped — {activeTab === 'units' ? 'property name not found or already exists' : 'already exists or validation error'}.
            </p>
          )}
          <button onClick={reset} className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 mt-6">Import More</button>
        </div>
      )}

      {/* AI done screen */}
      {mode === 'ai' && aiDone && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-12 text-center">
          <div className="text-5xl mb-4">🎉</div>
          <p className="text-xl font-bold text-gray-800 dark:text-white mb-2">Import Complete</p>
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">from {aiFilename}</p>
          <div className="flex justify-center gap-6 mb-8">
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl px-8 py-4">
              <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{aiCounts.properties}</p>
              <p className="text-xs text-blue-600 dark:text-blue-400">Properties</p>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 rounded-xl px-8 py-4">
              <p className="text-2xl font-bold text-green-700 dark:text-green-300">{aiCounts.units}</p>
              <p className="text-xs text-green-600 dark:text-green-400">Units</p>
            </div>
          </div>
          <button onClick={reset} className="bg-blue-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700">Import Another File</button>
        </div>
      )}

      {/* AI parsing spinner */}
      {mode === 'ai' && aiParsing && (
        <div className="border-2 border-dashed border-violet-300 dark:border-violet-600 rounded-xl p-12 text-center bg-violet-50/50 dark:bg-violet-900/10">
          <div className="w-14 h-14 mx-auto mb-4 relative">
            <div className="absolute inset-0 rounded-full border-4 border-violet-200 dark:border-violet-700" />
            <div className="absolute inset-0 rounded-full border-4 border-t-violet-600 animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <svg className="w-5 h-5 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
          </div>
          <p className="text-violet-700 dark:text-violet-300 font-semibold text-base mb-1">Claude is reading your file…</p>
          <p className="text-sm text-violet-500 dark:text-violet-400">Detecting properties and units simultaneously</p>
        </div>
      )}

      {/* AI preview — properties + units extracted */}
      {mode === 'ai' && aiPortfolio && !aiDone && !aiImporting && (
        <div className="space-y-5">
          {/* AI summary */}
          <div className="bg-gradient-to-r from-violet-50 to-blue-50 dark:from-violet-900/20 dark:to-blue-900/20 border border-violet-100 dark:border-violet-800 rounded-xl p-4">
            <div className="flex items-start gap-2">
              <span className="text-violet-500 mt-0.5">✨</span>
              <div>
                <p className="text-xs font-semibold text-violet-700 dark:text-violet-300 mb-1">Claude found:</p>
                <p className="text-sm text-gray-700 dark:text-gray-300 italic">{aiPortfolio.summary}</p>
              </div>
            </div>
          </div>

          {/* Count cards */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 text-center">
              <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">{aiPortfolio.properties.length}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">🏘️ Properties</div>
            </div>
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 text-center">
              <div className="text-3xl font-bold text-green-600 dark:text-green-400">{aiPortfolio.units.length}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">🚪 Units</div>
            </div>
          </div>

          {/* Properties preview */}
          {aiPortfolio.properties.length > 0 && (
            <details className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden" open>
              <summary className="px-4 py-3 cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-750 list-none flex items-center justify-between">
                <span>🏘️ {aiPortfolio.properties.length} Properties</span>
                <span className="text-xs text-gray-400">click to collapse</span>
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
                    {aiPortfolio.properties.map((p, i) => (
                      <tr key={i} className="border-t border-gray-100 dark:border-gray-700">
                        <td className="px-3 py-2 font-medium text-gray-900 dark:text-white">{p.name}</td>
                        <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{p.address}</td>
                        <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{p.district}</td>
                        <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{p.property_type}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}

          {/* Units preview */}
          {aiPortfolio.units.length > 0 && (
            <details className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden" open>
              <summary className="px-4 py-3 cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-750 list-none flex items-center justify-between">
                <span>🚪 {aiPortfolio.units.length} Units</span>
                <span className="text-xs text-gray-400">click to collapse</span>
              </summary>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      {['Code', 'Property', 'Bedrooms', 'Rent (UGX)', 'Status'].map(h => (
                        <th key={h} className="px-3 py-2 text-left text-gray-500 dark:text-gray-400 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {aiPortfolio.units.slice(0, 20).map((u, i) => (
                      <tr key={i} className="border-t border-gray-100 dark:border-gray-700">
                        <td className="px-3 py-2 font-medium text-gray-900 dark:text-white">{u.code}</td>
                        <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{u.property_name}</td>
                        <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{u.bedrooms}</td>
                        <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{u.default_rent_amount > 0 ? u.default_rent_amount.toLocaleString() : '—'}</td>
                        <td className="px-3 py-2">
                          <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${u.status === 'Occupied' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : u.status === 'Under_maintenance' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}>
                            {u.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {aiPortfolio.units.length > 20 && (
                      <tr className="border-t border-gray-100 dark:border-gray-700">
                        <td colSpan={5} className="px-3 py-2 text-gray-400 text-center">+{aiPortfolio.units.length - 20} more units</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </details>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={doAiImport}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-semibold text-sm transition-colors"
            >
              Import All ({aiPortfolio.properties.length + aiPortfolio.units.length} records)
            </button>
            <button
              onClick={reset}
              className="px-5 py-3 border border-gray-300 dark:border-gray-600 rounded-xl text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Re-upload
            </button>
          </div>
        </div>
      )}

      {/* AI importing progress */}
      {mode === 'ai' && aiImporting && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-10 text-center">
          <div className="w-14 h-14 mx-auto mb-4 relative">
            <div className="absolute inset-0 rounded-full border-4 border-blue-100 dark:border-blue-900" />
            <div className="absolute inset-0 rounded-full border-4 border-t-blue-600 animate-spin" />
          </div>
          <p className="text-gray-700 dark:text-gray-300 font-medium">Importing properties and units…</p>
          <p className="text-sm text-gray-400 mt-1">Please keep this page open</p>
        </div>
      )}

      {/* Drop zone (shown when no results yet, not parsing, not done) */}
      {!aiParsing && !aiPortfolio && !aiDone && !(mode === 'standard' && done) && (
        <>
          {aiError && (
            <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-4 flex items-start gap-3">
              <svg className="w-5 h-5 text-red-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <p className="text-sm text-red-700 dark:text-red-300">{aiError}</p>
            </div>
          )}

          {/* Standard CSV: row table or drop zone */}
          {mode === 'standard' && rows.length > 0 ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3 text-sm flex-wrap">
                  <span className="text-green-700 dark:text-green-400 font-medium">{rows.filter(r => r.errors.length === 0).length} valid</span>
                  {rows.filter(r => r.errors.length > 0).length > 0 && (
                    <span className="text-orange-600 dark:text-orange-400 font-medium">{rows.filter(r => r.errors.length > 0).length} with errors</span>
                  )}
                  <span className="text-gray-400">·</span>
                  <span className="text-blue-600 dark:text-blue-400 font-medium">{selectedIndices.size} selected</span>
                  <button onClick={selectValid} className="text-xs text-gray-500 hover:text-blue-600 underline underline-offset-2">Select valid only</button>
                </div>
                <button onClick={reset} className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">Upload different file</button>
              </div>

              {activeTab === 'units' && properties.length === 0 && (
                <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700 rounded-lg p-3 text-xs text-orange-700 dark:text-orange-300">
                  No properties found. Units must be linked to an existing property. Please add properties first, then import units.
                </div>
              )}
              {activeTab === 'units' && properties.length > 0 && (
                <div className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2">
                  Available properties: {properties.map(p => <span key={p.id} className="font-medium text-gray-700 dark:text-gray-300 mr-2">"{p.name}"</span>)}
                </div>
              )}

              <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 uppercase text-xs">
                      <tr>
                        <th className="px-3 py-3 text-left w-10">
                          <input
                            type="checkbox"
                            checked={allSelected}
                            ref={el => { if (el) el.indeterminate = !allSelected && selectedIndices.size > 0; }}
                            onChange={toggleSelectAll}
                            className="rounded"
                          />
                        </th>
                        <th className="px-3 py-3 text-left">Status</th>
                        {tabHeaders[activeTab].map(h => (
                          <th key={h} className="px-3 py-3 text-left">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {rows.map((r, i) => {
                        const propMissing = activeTab === 'units' &&
                          r.errors.length === 0 &&
                          !resolvePropertyId(r.mapped.property_name ?? '');
                        return (
                          <tr
                            key={i}
                            onClick={() => toggleSelect(i)}
                            className={`cursor-pointer transition-colors ${
                              selectedIndices.has(i)
                                ? (r.errors.length > 0 || propMissing) ? 'bg-orange-50 dark:bg-orange-900/10' : 'bg-blue-50 dark:bg-blue-900/10'
                                : (r.errors.length > 0 || propMissing) ? 'bg-red-50/40 dark:bg-red-900/5 opacity-60' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                            }`}
                          >
                            <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                              <input type="checkbox" checked={selectedIndices.has(i)} onChange={() => toggleSelect(i)} className="rounded" />
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap">
                              {propMissing
                                ? <span className="text-orange-600 text-xs font-medium">⚠ property not found</span>
                                : r.errors.length === 0
                                  ? <span className="text-green-600 text-xs font-medium">✓ OK</span>
                                  : <span className="text-orange-600 text-xs font-medium" title={r.errors.join(', ')}>⚠ {r.errors[0]}</span>
                              }
                            </td>
                            {tabHeaders[activeTab].map(h => (
                              <td key={h} className="px-3 py-2 text-gray-700 dark:text-gray-300 max-w-xs truncate">{r.row[h] ?? ''}</td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {selectedIndices.size > 0 ? (
                <button
                  onClick={handleImportClick}
                  disabled={importing}
                  className="w-full py-3 rounded-lg font-medium text-sm disabled:opacity-50 transition bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {importing
                    ? 'Importing…'
                    : selectedErrorRows.length > 0
                      ? `Import ${selectedIndices.size} ${activeTab} — complete ${selectedErrorRows.length} with missing fields →`
                      : `Import ${selectedIndices.size} ${activeTab}`}
                </button>
              ) : (
                <p className="text-center text-gray-400 dark:text-gray-500 text-sm">Select rows above to import</p>
              )}
            </div>

          ) : (
            /* Drop zone */
            <div
              onDrop={handleDrop}
              onDragOver={e => e.preventDefault()}
              className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors cursor-pointer ${mode === 'ai' ? 'border-violet-300 dark:border-violet-600 hover:border-violet-500 bg-violet-50/30 dark:bg-violet-900/5' : 'border-gray-300 dark:border-gray-600 hover:border-blue-400'}`}
              onClick={() => fileRef.current?.click()}
            >
              {mode === 'ai' ? (
                <div className="flex justify-center gap-3 mb-4">
                  {[['PDF', 'bg-red-100 dark:bg-red-900/30 text-red-600'], ['DOC', 'bg-blue-100 dark:bg-blue-900/30 text-blue-600'], ['XLS', 'bg-green-100 dark:bg-green-900/30 text-green-600'], ['CSV', 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300']].map(([label, cls]) => (
                    <div key={label} className={`w-10 h-10 ${cls} rounded-lg flex items-center justify-center`}>
                      <span className="text-xs font-bold">{label}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
              )}
              <p className={`font-medium mb-1 ${mode === 'ai' ? 'text-violet-700 dark:text-violet-300' : 'text-gray-600 dark:text-gray-300'}`}>
                {mode === 'ai' ? 'Drop any file — Claude detects properties & units automatically' : 'Drop your CSV file here'}
              </p>
              <p className="text-sm text-gray-400 dark:text-gray-500">
                {mode === 'ai' ? 'Excel, PDF, Word, CSV, TSV — any format, any column names' : 'or click to browse'}
              </p>
              {mode === 'ai' && <p className="text-xs text-violet-400 mt-2">No need to pick a type — Claude figures it all out</p>}
              <input ref={fileRef} type="file" accept={acceptTypes} className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            </div>
          )}
        </>
      )}

      {/* ── Completion Modal ── */}
      {showCompletion && (
        <div className="fixed inset-0 bg-black/60 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl my-8">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h2 className="text-lg font-semibold text-gray-800 dark:text-white">Complete Missing Details</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                  {selectedErrorRows.length} record{selectedErrorRows.length !== 1 ? 's' : ''} need required fields filled in
                </p>
              </div>
              <button onClick={() => setShowCompletion(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-2xl leading-none">&times;</button>
            </div>

            <div className="p-6 space-y-5 max-h-[60vh] overflow-y-auto">
              {selectedErrorRows.map(({ index, errors }) => {
                const cd = completionData[index] ?? {};
                const identifier = cd.code || cd.name || rows[index].row.code || rows[index].row.name || `Row ${index + 1}`;

                return (
                  <div key={index} className="border border-orange-200 dark:border-orange-700 rounded-xl p-5 bg-orange-50/50 dark:bg-orange-900/10">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-7 h-7 bg-orange-100 dark:bg-orange-800 rounded-full flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-orange-600 dark:text-orange-300">{index + 1}</span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-800 dark:text-white">{identifier}</p>
                        <p className="text-xs text-orange-600 dark:text-orange-400">{errors.join(' · ')}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {REQUIRED_FIELDS[activeTab].map(field => {
                        const isMissing = !cd[field]?.trim();
                        if (field === 'property_name') {
                          return (
                            <div key={field}>
                              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                {FIELD_LABELS[field]} <span className="text-red-500">*</span>
                              </label>
                              <select
                                value={cd[field] ?? ''}
                                onChange={e => setCompletionData(prev => ({ ...prev, [index]: { ...(prev[index] ?? {}), [field]: e.target.value } }))}
                                className={`w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white ${isMissing ? 'border-orange-400 ring-1 ring-orange-300' : 'border-gray-300 dark:border-gray-600'}`}
                              >
                                <option value="">— Select property —</option>
                                {properties.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                              </select>
                            </div>
                          );
                        }
                        if (field === 'status') {
                          return (
                            <div key={field}>
                              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                {FIELD_LABELS[field]} <span className="text-red-500">*</span>
                              </label>
                              <select
                                value={cd[field] ?? 'Available'}
                                onChange={e => setCompletionData(prev => ({ ...prev, [index]: { ...(prev[index] ?? {}), [field]: e.target.value } }))}
                                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white"
                              >
                                {UNIT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                              </select>
                            </div>
                          );
                        }
                        if (field === 'property_type') {
                          return (
                            <div key={field}>
                              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                {FIELD_LABELS[field]} <span className="text-red-500">*</span>
                              </label>
                              <select
                                value={cd[field] ?? 'Residential'}
                                onChange={e => setCompletionData(prev => ({ ...prev, [index]: { ...(prev[index] ?? {}), [field]: e.target.value } }))}
                                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white"
                              >
                                {PROPERTY_TYPES.map(o => <option key={o} value={o}>{o}</option>)}
                              </select>
                            </div>
                          );
                        }
                        return (
                          <div key={field}>
                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                              {FIELD_LABELS[field] ?? field} <span className="text-red-500">*</span>
                            </label>
                            <input
                              value={cd[field] ?? ''}
                              onChange={e => setCompletionData(prev => ({ ...prev, [index]: { ...(prev[index] ?? {}), [field]: e.target.value } }))}
                              placeholder={`Enter ${FIELD_LABELS[field] ?? field}`}
                              className={`w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white ${isMissing ? 'border-orange-400 ring-1 ring-orange-300' : 'border-gray-300 dark:border-gray-600'}`}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {selectedIndices.size - selectedErrorRows.length} valid row{selectedIndices.size - selectedErrorRows.length !== 1 ? 's' : ''} will also be imported
              </p>
              <div className="flex gap-3">
                <button onClick={() => setShowCompletion(false)} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition">
                  Back
                </button>
                <button onClick={handleCompletionSubmit} disabled={importing} className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50">
                  {importing ? 'Importing…' : `Import ${selectedIndices.size} ${activeTab}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
