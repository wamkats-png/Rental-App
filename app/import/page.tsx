'use client';

import { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import * as XLSX from 'xlsx';
import {
  parseCSV, mapTenantRow, mapPropertyRow,
  TENANT_SAMPLE_HEADERS, TENANT_SAMPLE_ROWS,
  PROPERTY_SAMPLE_HEADERS, PROPERTY_SAMPLE_ROWS,
  buildSampleCSV, downloadSample,
  type ParsedRow,
} from '../lib/csvImport';

type Tab = 'tenants' | 'properties';
type ImportMode = 'standard' | 'ai';

interface ImportRow {
  row: ParsedRow;
  errors: string[];
  mapped: Record<string, string>;
}

export default function ImportPage() {
  const { landlord, addTenant, addProperty } = useApp();
  const [activeTab, setActiveTab] = useState<Tab>('tenants');
  const [mode, setMode] = useState<ImportMode>('standard');
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [aiParsing, setAiParsing] = useState(false);
  const [aiError, setAiError] = useState('');
  const [importedCount, setImportedCount] = useState(0);
  const [done, setDone] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const validRows = rows.filter(r => r.errors.length === 0);
  const errorRows = rows.filter(r => r.errors.length > 0);

  const parseStandard = (text: string) => {
    const parsed = parseCSV(text);
    if (parsed.length === 0) return;
    const mapped: ImportRow[] = parsed.map(row => {
      if (activeTab === 'tenants') {
        const m = mapTenantRow(row, landlord.id);
        const { errors, ...rest } = m;
        return { row, errors, mapped: rest as unknown as Record<string, string> };
      } else {
        const m = mapPropertyRow(row, landlord.id);
        const { errors, ...rest } = m;
        return { row, errors, mapped: rest as unknown as Record<string, string> };
      }
    });
    setRows(mapped);
  };

  const parseWithAI = async (text: string) => {
    setAiParsing(true);
    setAiError('');
    try {
      const res = await fetch('/api/ai-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, type: activeTab }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setAiError(data.error ?? 'AI parsing failed. Try again or use Standard CSV.');
        return;
      }
      const mapped: ImportRow[] = (data.rows as Record<string, string>[]).map(aiRow => {
        const { errors: rawErrors, ...fields } = aiRow;
        const errors: string[] = Array.isArray(rawErrors) ? rawErrors : [];
        return { row: fields as ParsedRow, errors, mapped: { ...fields, landlord_id: landlord.id } };
      });
      setRows(mapped);
    } catch {
      setAiError('Network error. Please try again.');
    } finally {
      setAiParsing(false);
    }
  };

  const extractText = (file: File): Promise<string> => {
    const isExcel = /\.(xlsx|xls|ods)$/i.test(file.name) || file.type.includes('spreadsheet') || file.type.includes('excel');
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Failed to read file'));
      if (isExcel) {
        reader.onload = e => {
          try {
            const wb = XLSX.read(e.target?.result, { type: 'array' });
            const ws = wb.Sheets[wb.SheetNames[0]];
            resolve(XLSX.utils.sheet_to_csv(ws));
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

  const handleFile = (file: File) => {
    setRows([]);
    setDone(false);
    setImportedCount(0);
    setAiError('');
    extractText(file).then(text => {
      if (!text?.trim()) return;
      if (mode === 'ai') {
        parseWithAI(text);
      } else {
        parseStandard(text);
      }
    }).catch(err => {
      setAiError(err.message);
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleImport = async () => {
    if (validRows.length === 0) return;
    setImporting(true);
    let count = 0;
    for (const r of validRows) {
      try {
        if (activeTab === 'tenants') {
          await addTenant(r.mapped as Parameters<typeof addTenant>[0]);
        } else {
          await addProperty(r.mapped as Parameters<typeof addProperty>[0]);
        }
        count++;
      } catch {
        // individual row failures don't abort the batch
      }
    }
    setImportedCount(count);
    setImporting(false);
    setDone(true);
    setRows([]);
  };

  const reset = () => {
    setRows([]);
    setDone(false);
    setImportedCount(0);
    setAiError('');
    if (fileRef.current) fileRef.current.value = '';
  };

  const tabHeaders: Record<Tab, string[]> = {
    tenants: ['full_name', 'phone', 'email', 'national_id', 'address', 'comm_preference'],
    properties: ['name', 'address', 'district', 'lc_area', 'property_type', 'property_rates_ref'],
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Import Data</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Bulk import tenants or properties from a CSV file</p>
      </div>

      {/* Tab selector */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6">
        {(['tenants', 'properties'] as Tab[]).map(tab => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab); reset(); }}
            className={`px-5 py-2.5 text-sm font-medium capitalize border-b-2 transition -mb-px ${activeTab === tab ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Mode toggle */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-1 flex gap-1 mb-6 w-fit">
        <button
          onClick={() => { setMode('standard'); reset(); }}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${mode === 'standard' ? 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}
        >
          Standard CSV
        </button>
        <button
          onClick={() => { setMode('ai'); reset(); }}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-1.5 ${mode === 'ai' ? 'bg-violet-600 text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          AI Smart Import
        </button>
      </div>

      {/* Mode description */}
      {mode === 'ai' && (
        <div className="bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-700 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-violet-100 dark:bg-violet-800 rounded-full flex items-center justify-center shrink-0 mt-0.5">
              <svg className="w-4 h-4 text-violet-600 dark:text-violet-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-violet-800 dark:text-violet-200">AI Smart Import — powered by Claude</p>
              <p className="text-xs text-violet-600 dark:text-violet-300 mt-1">
                Upload any file — doesn't have to match our template exactly. Claude will detect your column names, remap them to the correct fields, and flag any issues. Supports CSV, TSV, Excel (.xlsx/.xls), semicolon-delimited, and other formats.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Standard mode: sample download */}
      {mode === 'standard' && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4 mb-6 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-blue-800 dark:text-blue-200">Expected CSV format</p>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">Download the sample template and fill it in with your data</p>
          </div>
          <button
            onClick={() => {
              const content = activeTab === 'tenants'
                ? buildSampleCSV(TENANT_SAMPLE_HEADERS, TENANT_SAMPLE_ROWS)
                : buildSampleCSV(PROPERTY_SAMPLE_HEADERS, PROPERTY_SAMPLE_ROWS);
              downloadSample(`${activeTab}-import-sample.csv`, content);
            }}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 shrink-0"
          >
            Download Sample CSV
          </button>
        </div>
      )}

      {done ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
          <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          </div>
          <p className="text-xl font-bold text-gray-800 dark:text-white mb-2">Import Complete</p>
          <p className="text-gray-500 dark:text-gray-400 mb-6">{importedCount} {activeTab} imported successfully.</p>
          <button onClick={reset} className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">Import More</button>
        </div>
      ) : aiParsing ? (
        /* AI parsing loader */
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
          <p className="text-violet-700 dark:text-violet-300 font-semibold text-base mb-1">Claude is parsing your file…</p>
          <p className="text-sm text-violet-500 dark:text-violet-400">Detecting columns, mapping fields, and validating rows</p>
        </div>
      ) : rows.length === 0 ? (
        /* Drop zone */
        <div>
          {aiError && (
            <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-4 flex items-start gap-3">
              <svg className="w-5 h-5 text-red-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <p className="text-sm text-red-700 dark:text-red-300">{aiError}</p>
            </div>
          )}
          <div
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors cursor-pointer ${mode === 'ai' ? 'border-violet-300 dark:border-violet-600 hover:border-violet-500 dark:hover:border-violet-400 bg-violet-50/30 dark:bg-violet-900/5' : 'border-gray-300 dark:border-gray-600 hover:border-blue-400'}`}
            onClick={() => fileRef.current?.click()}
          >
            {mode === 'ai' ? (
              <svg className="w-12 h-12 text-violet-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            ) : (
              <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
            )}
            <p className={`font-medium mb-1 ${mode === 'ai' ? 'text-violet-700 dark:text-violet-300' : 'text-gray-600 dark:text-gray-300'}`}>
              {mode === 'ai' ? 'Drop any file here — Claude will figure it out' : 'Drop your CSV file here'}
            </p>
            <p className="text-sm text-gray-400 dark:text-gray-500">
              {mode === 'ai' ? 'CSV, TSV, Excel (.xlsx), or any text-delimited format' : 'or click to browse'}
            </p>
            {mode === 'ai' && (
              <p className="text-xs text-violet-400 dark:text-violet-500 mt-2">Any column names — Claude will map them automatically</p>
            )}
            <input
              ref={fileRef}
              type="file"
              accept={mode === 'ai' ? '.csv,.tsv,.txt,.xlsx,.xls,.ods' : '.csv'}
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
          </div>
        </div>
      ) : (
        /* Preview table */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex gap-3 text-sm items-center">
              {mode === 'ai' && (
                <span className="inline-flex items-center gap-1 text-xs bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 px-2 py-1 rounded-full font-medium">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                  Parsed by Claude
                </span>
              )}
              <span className="text-green-700 dark:text-green-400 font-medium">{validRows.length} valid</span>
              {errorRows.length > 0 && <span className="text-red-600 dark:text-red-400 font-medium">{errorRows.length} with errors</span>}
            </div>
            <button onClick={reset} className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">Upload different file</button>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 uppercase text-xs">
                  <tr>
                    <th className="px-3 py-3 text-left">Status</th>
                    {tabHeaders[activeTab].map(h => (
                      <th key={h} className="px-3 py-3 text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {rows.map((r, i) => (
                    <tr key={i} className={r.errors.length > 0 ? 'bg-red-50 dark:bg-red-900/10' : ''}>
                      <td className="px-3 py-2">
                        {r.errors.length === 0
                          ? <span className="text-green-600 text-xs font-medium">✓ OK</span>
                          : <span className="text-red-600 text-xs font-medium" title={r.errors.join(', ')}>✗ {r.errors[0]}</span>
                        }
                      </td>
                      {tabHeaders[activeTab].map(h => (
                        <td key={h} className="px-3 py-2 text-gray-700 dark:text-gray-300 max-w-xs truncate">
                          {r.row[h] ?? ''}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {validRows.length > 0 && (
            <button
              onClick={handleImport}
              disabled={importing}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 text-sm"
            >
              {importing ? 'Importing...' : `Import ${validRows.length} ${activeTab}`}
            </button>
          )}
          {errorRows.length > 0 && validRows.length === 0 && (
            <p className="text-center text-red-600 dark:text-red-400 text-sm">All rows have errors. Please fix your file and re-upload.</p>
          )}
        </div>
      )}
    </div>
  );
}
