'use client';

import { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { formatUGX } from '../lib/utils';
import { RateLimitBanner } from '../components/RateLimitBanner';

interface ContractData {
  tenant_name?: string;
  landlord_name?: string;
  property_address?: string;
  unit_description?: string;
  rent_amount?: number;
  payment_frequency?: string;
  currency?: string;
  start_date?: string;
  end_date?: string;
  deposit_amount?: number;
  due_day?: number;
  grace_period_days?: number;
  utilities_responsibility?: string;
  notice_period_days?: number;
  contract_type?: string;
  special_terms?: string;
  contract_html?: string;
}

type InputMode = 'text' | 'image';

export default function AIContractPage() {
  const { properties, units, tenants, addLease } = useApp();
  const [mode, setMode] = useState<InputMode>('text');
  const [textInput, setTextInput] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rateLimitMs, setRateLimitMs] = useState(0);
  const [result, setResult] = useState<ContractData | null>(null);
  const [showContract, setShowContract] = useState(false);
  const [saved, setSaved] = useState(false);
  const [leaseMapping, setLeaseMapping] = useState({ property_id: '', unit_id: '', tenant_id: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const unitsForProperty = units.filter(u => u.property_id === leaseMapping.property_id);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file (JPG, PNG, etc.)');
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      setError('Image must be under 20MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setImagePreview(base64);
      setImageBase64(base64);
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (mode === 'text' && !textInput.trim()) {
      setError('Please describe the contract terms');
      return;
    }
    if (mode === 'image' && !imageBase64) {
      setError('Please upload a contract image');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setSaved(false);

    try {
      const res = await fetch('/api/ai-contract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          text: mode === 'text' ? textInput : undefined,
          imageBase64: mode === 'image' ? imageBase64 : undefined,
        }),
      });

      const data = await res.json();

      if (res.status === 429) {
        setRateLimitMs(data.retryAfterMs ?? 60_000);
        return;
      }
      if (!res.ok) {
        throw new Error(data.error || 'Failed to process contract');
      }

      setResult(data.data);
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateLease = () => {
    if (!result) return;
    if (!leaseMapping.property_id || !leaseMapping.unit_id || !leaseMapping.tenant_id) {
      alert('Please select a property, unit, and tenant before saving.');
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    const oneYear = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    addLease({
      property_id: leaseMapping.property_id,
      unit_id: leaseMapping.unit_id,
      tenant_id: leaseMapping.tenant_id,
      contract_type: (result.contract_type as any) || 'Residential',
      rent_amount: result.rent_amount || 0,
      payment_frequency: (result.payment_frequency as any) || 'Monthly',
      currency: result.currency || 'UGX',
      start_date: result.start_date || today,
      end_date: result.end_date || oneYear,
      due_day: result.due_day || 1,
      grace_period_days: result.grace_period_days || 5,
      deposit_amount: result.deposit_amount || 0,
      utilities_responsibility: (result.utilities_responsibility as any) || 'Tenant',
      notice_period_days: result.notice_period_days || 30,
      status: 'Draft',
    });

    setSaved(true);
  };

  const clearAll = () => {
    setTextInput('');
    setImagePreview(null);
    setImageBase64(null);
    setResult(null);
    setError(null);
    setSaved(false);
    setShowContract(false);
    setLeaseMapping({ property_id: '', unit_id: '', tenant_id: '' });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const examplePrompts = [
    'Contract with tenant John Mukasa for 2 years at 450,000 UGX per month, starting March 2026, property in Ntinda',
    'Lease for a commercial shop in Kampala Central, 1,200,000 UGX quarterly, tenant pays utilities, 3-month notice period',
    '6 month rental agreement with Sarah Nakato, 800,000 UGX monthly, 2 bedroom apartment in Kololo, deposit of 1 month rent',
  ];

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">AI Contract Assistant</h1>
        <p className="text-sm text-gray-500 mt-1">
          Upload a photo of a physical contract or describe your terms in plain language
        </p>
      </div>

      {/* Mode Tabs */}
      <div className="bg-white rounded-xl shadow mb-6">
        <div className="flex border-b">
          <button
            onClick={() => { setMode('text'); setError(null); }}
            className={`flex-1 py-4 px-6 text-center font-medium transition-colors ${
              mode === 'text'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <span className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              Describe in Text
            </span>
          </button>
          <button
            onClick={() => { setMode('image'); setError(null); }}
            className={`flex-1 py-4 px-6 text-center font-medium transition-colors ${
              mode === 'image'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <span className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Upload Contract Photo
            </span>
          </button>
        </div>

        <div className="p-6">
          {/* Text Mode */}
          {mode === 'text' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Describe your contract terms in plain language
              </label>
              <textarea
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder='e.g. "Contract with tenant for 2 years at 450,000 UGX per month, property in Ntinda, Kampala"'
                className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                rows={4}
              />
              <div className="mt-3">
                <p className="text-xs text-gray-400 mb-2">Try an example:</p>
                <div className="flex flex-wrap gap-2">
                  {examplePrompts.map((prompt, i) => (
                    <button
                      key={i}
                      onClick={() => setTextInput(prompt)}
                      className="text-xs bg-gray-100 text-gray-600 px-3 py-1.5 rounded-full hover:bg-blue-50 hover:text-blue-600 transition-colors"
                    >
                      {prompt.length > 60 ? prompt.slice(0, 60) + '...' : prompt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Image Mode */}
          {mode === 'image' && (
            <div>
              <div
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                  imagePreview
                    ? 'border-blue-300 bg-blue-50/30'
                    : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50/20'
                }`}
              >
                {imagePreview ? (
                  <div>
                    <img
                      src={imagePreview}
                      alt="Contract preview"
                      className="max-h-64 mx-auto rounded-lg shadow-sm mb-3"
                    />
                    <p className="text-sm text-blue-600 font-medium">Click to change image</p>
                  </div>
                ) : (
                  <div>
                    <svg className="w-12 h-12 mx-auto text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="text-gray-600 font-medium mb-1">Upload a photo of your contract</p>
                    <p className="text-xs text-gray-400">JPG, PNG up to 20MB - Take a clear photo of the full document</p>
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleImageUpload}
                className="hidden"
              />
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}
          {rateLimitMs > 0 && (
            <div className="mt-4">
              <RateLimitBanner retryAfterMs={rateLimitMs} onReady={() => setRateLimitMs(0)} />
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-3 mt-5">
            <button
              onClick={handleSubmit}
              disabled={loading || rateLimitMs > 0 || (mode === 'text' && !textInput.trim()) || (mode === 'image' && !imageBase64)}
              className="bg-blue-600 text-white px-6 py-2.5 rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  {mode === 'image' ? 'Analyzing Contract...' : 'Generating Contract...'}
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  {mode === 'image' ? 'Extract Contract Data' : 'Generate Contract'}
                </>
              )}
            </button>
            {(textInput || imagePreview || result) && (
              <button onClick={clearAll} className="text-gray-500 hover:text-gray-700 px-4 py-2.5 font-medium">
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-6">
          {/* Extracted Data Summary */}
          <div className="bg-white rounded-xl shadow">
            <div className="p-5 border-b flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-800">
                  {mode === 'image' ? 'Extracted Contract Details' : 'Generated Contract Details'}
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">Review the details below, then save as a lease or view the full contract</p>
              </div>
              <span className="bg-green-100 text-green-700 text-xs font-medium px-3 py-1 rounded-full">AI Generated</span>
            </div>
            <div className="p-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <InfoCard label="Tenant" value={result.tenant_name || 'Not specified'} />
                <InfoCard label="Landlord" value={result.landlord_name || 'Not specified'} />
                <InfoCard label="Property" value={result.property_address || 'Not specified'} />
                <InfoCard label="Unit" value={result.unit_description || 'Not specified'} />
                <InfoCard label="Rent" value={result.rent_amount ? formatUGX(result.rent_amount) : 'Not specified'} highlight />
                <InfoCard label="Frequency" value={result.payment_frequency || 'Monthly'} />
                <InfoCard label="Start Date" value={result.start_date || 'Not specified'} />
                <InfoCard label="End Date" value={result.end_date || 'Not specified'} />
                <InfoCard label="Deposit" value={result.deposit_amount ? formatUGX(result.deposit_amount) : 'None'} />
                <InfoCard label="Due Day" value={result.due_day ? `${result.due_day} of month` : '1st of month'} />
                <InfoCard label="Grace Period" value={`${result.grace_period_days || 5} days`} />
                <InfoCard label="Notice Period" value={`${result.notice_period_days || 30} days`} />
                <InfoCard label="Utilities" value={result.utilities_responsibility || 'Tenant'} />
                <InfoCard label="Contract Type" value={result.contract_type || 'Residential'} />
              </div>

              {result.special_terms && (
                <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-xs font-medium text-yellow-700 mb-1">Special Terms</p>
                  <p className="text-sm text-yellow-800">{result.special_terms}</p>
                </div>
              )}
            </div>
          </div>

          {/* Link to Records — required before saving */}
          {!saved && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-blue-800 mb-3">Link to your records before saving</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Property</label>
                  <select
                    value={leaseMapping.property_id}
                    onChange={e => setLeaseMapping(prev => ({ ...prev, property_id: e.target.value, unit_id: '' }))}
                    className="w-full border rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select property</option>
                    {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Unit</label>
                  <select
                    value={leaseMapping.unit_id}
                    onChange={e => setLeaseMapping(prev => ({ ...prev, unit_id: e.target.value }))}
                    disabled={!leaseMapping.property_id}
                    className="w-full border rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  >
                    <option value="">Select unit</option>
                    {unitsForProperty.map(u => <option key={u.id} value={u.id}>{u.code} — {u.description}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Tenant</label>
                  <select
                    value={leaseMapping.tenant_id}
                    onChange={e => setLeaseMapping(prev => ({ ...prev, tenant_id: e.target.value }))}
                    className="w-full border rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select tenant</option>
                    {tenants.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3">
            {result.contract_html && (
              <button
                onClick={() => setShowContract(!showContract)}
                className="bg-white border border-gray-300 text-gray-700 px-5 py-2.5 rounded-lg hover:bg-gray-50 font-medium transition flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                {showContract ? 'Hide Full Contract' : 'View Full Contract'}
              </button>
            )}
            <button
              onClick={handleCreateLease}
              disabled={saved}
              className={`px-5 py-2.5 rounded-lg font-medium transition flex items-center gap-2 ${
                saved
                  ? 'bg-green-100 text-green-700 cursor-default'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {saved ? (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Saved as Draft Lease
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Save as Draft Lease
                </>
              )}
            </button>
            {result.contract_html && (
              <button
                onClick={() => {
                  const w = window.open('', '_blank');
                  if (w) {
                    w.document.write(`<!DOCTYPE html><html><head><title>Contract</title><style>body{font-family:Georgia,serif;max-width:800px;margin:40px auto;padding:20px;line-height:1.6;color:#333}h1{text-align:center;border-bottom:2px solid #333;padding-bottom:10px}h2{color:#444;margin-top:24px}ol,ul{margin-left:20px}@media print{body{margin:0;padding:20px}}</style></head><body>${result.contract_html}</body></html>`);
                    w.document.close();
                  }
                }}
                className="bg-white border border-gray-300 text-gray-700 px-5 py-2.5 rounded-lg hover:bg-gray-50 font-medium transition flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Print / Save PDF
              </button>
            )}
          </div>

          {/* Full Contract Preview — rendered in a sandboxed iframe to prevent XSS */}
          {showContract && result.contract_html && (
            <div className="bg-white rounded-xl shadow">
              <div className="p-5 border-b">
                <h2 className="text-lg font-bold text-gray-800">Full Contract Document</h2>
              </div>
              <iframe
                sandbox="allow-same-origin"
                srcDoc={`<!DOCTYPE html><html><head><style>body{font-family:Georgia,serif;max-width:800px;margin:32px auto;padding:20px;line-height:1.7;color:#333}h1{text-align:center;border-bottom:2px solid #333;padding-bottom:10px}h2{color:#444;margin-top:24px}ol,ul{margin-left:20px}</style></head><body>${result.contract_html}</body></html>`}
                className="w-full border-0 rounded-b-xl"
                style={{ minHeight: '600px' }}
                title="Contract Preview"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function InfoCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="bg-gray-50 rounded-lg p-3">
      <p className="text-xs text-gray-400 uppercase tracking-wide">{label}</p>
      <p className={`text-sm font-medium mt-0.5 ${highlight ? 'text-blue-700 text-base' : 'text-gray-800'}`}>{value}</p>
    </div>
  );
}
