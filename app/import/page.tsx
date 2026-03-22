'use client';

import { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import {
  parseCSV, mapTenantRow, mapPropertyRow,
  TENANT_SAMPLE_HEADERS, TENANT_SAMPLE_ROWS,
  PROPERTY_SAMPLE_HEADERS, PROPERTY_SAMPLE_ROWS,
  buildSampleCSV, downloadSample,
  type ParsedRow,
} from '../lib/csvImport';

type Tab = 'tenants' | 'properties';

interface ImportRow {
  row: ParsedRow;
  errors: string[];
  mapped: Record<string, string>;
}

export default function ImportPage() {
  const { landlord, addTenant, addProperty } = useApp();
  const [activeTab, setActiveTab] = useState<Tab>('tenants');
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [done, setDone] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const validRows = rows.filter(r => r.errors.length === 0);
  const errorRows = rows.filter(r => r.errors.length > 0);

  const handleFile = (file: File) => {
    setRows([]);
    setDone(false);
    setImportedCount(0);
    const reader = new FileReader();
    reader.onload = e => {
      const text = e.target?.result as string;
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
    reader.readAsText(file);
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
    if (fileRef.current) fileRef.current.value = '';
  };

  const tabHeaders: Record<Tab, string[]> = {
    tenants: ['full_name', 'phone', 'email', 'national_id', 'address', 'comm_preference'],
    properties: ['name', 'address', 'district', 'lc_area', 'property_type', 'property_rates_ref'],
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Import Data</h1>
        <p className="text-sm text-gray-500 mt-1">Bulk import tenants or properties from a CSV file</p>
      </div>

      {/* Tab selector */}
      <div className="flex border-b mb-6">
        {(['tenants', 'properties'] as Tab[]).map(tab => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab); reset(); }}
            className={`px-5 py-2.5 text-sm font-medium capitalize border-b-2 transition -mb-px ${activeTab === tab ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Sample download */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-blue-800">Expected CSV format</p>
          <p className="text-xs text-blue-600 mt-0.5">Download the sample template and fill it in with your data</p>
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

      {done ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          </div>
          <p className="text-xl font-bold text-gray-800 mb-2">Import Complete</p>
          <p className="text-gray-500 mb-6">{importedCount} {activeTab} imported successfully.</p>
          <button onClick={reset} className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">Import More</button>
        </div>
      ) : rows.length === 0 ? (
        /* Drop zone */
        <div
          onDrop={handleDrop}
          onDragOver={e => e.preventDefault()}
          className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center hover:border-blue-400 transition-colors cursor-pointer"
          onClick={() => fileRef.current?.click()}
        >
          <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
          <p className="text-gray-600 font-medium mb-1">Drop your CSV file here</p>
          <p className="text-sm text-gray-400">or click to browse</p>
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
        </div>
      ) : (
        /* Preview */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex gap-3 text-sm">
              <span className="text-green-700 font-medium">{validRows.length} valid</span>
              {errorRows.length > 0 && <span className="text-red-600 font-medium">{errorRows.length} with errors</span>}
            </div>
            <button onClick={reset} className="text-sm text-gray-500 hover:text-gray-700">Upload different file</button>
          </div>

          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
                  <tr>
                    <th className="px-3 py-3 text-left">Status</th>
                    {tabHeaders[activeTab].map(h => (
                      <th key={h} className="px-3 py-3 text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map((r, i) => (
                    <tr key={i} className={r.errors.length > 0 ? 'bg-red-50' : ''}>
                      <td className="px-3 py-2">
                        {r.errors.length === 0
                          ? <span className="text-green-600 text-xs font-medium">✓ OK</span>
                          : <span className="text-red-600 text-xs font-medium" title={r.errors.join(', ')}>✗ {r.errors[0]}</span>
                        }
                      </td>
                      {tabHeaders[activeTab].map(h => (
                        <td key={h} className="px-3 py-2 text-gray-700 max-w-xs truncate">{r.row[h] ?? ''}</td>
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
            <p className="text-center text-red-600 text-sm">All rows have errors. Please fix your CSV and re-upload.</p>
          )}
        </div>
      )}
    </div>
  );
}
