'use client';

import { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';

const PRESET_COLORS = [
  '#2563eb', '#7c3aed', '#16a34a', '#ea580c', '#0891b2',
  '#be185d', '#92400e', '#1e293b', '#475569', '#064e3b',
];

export default function BrandingPage() {
  const { landlord, updateLandlord } = useApp();
  const [logoUrl, setLogoUrl] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#2563eb');
  const [tagline, setTagline] = useState('');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLogoUrl(landlord.logo_url ?? '');
    setPrimaryColor(landlord.primary_color ?? '#2563eb');
    setTagline(landlord.company_tagline ?? '');
  }, [landlord]);

  const handleSave = async () => {
    setSaving(true);
    await updateLandlord({
      logo_url: logoUrl.trim() || undefined,
      primary_color: primaryColor,
      company_tagline: tagline.trim() || undefined,
    });
    setSaved(true);
    setSaving(false);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Branding & White-label</h1>
        <p className="text-sm text-gray-500 mt-1">Customize the appearance of your RentFlow account</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Settings form */}
        <div className="space-y-6">
          {/* Logo */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <h2 className="text-base font-semibold text-gray-800 mb-4">Company Logo</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Logo URL</label>
              <input
                type="url"
                value={logoUrl}
                onChange={e => setLogoUrl(e.target.value)}
                placeholder="https://yourcompany.com/logo.png"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">Use a public image URL (PNG, SVG, or JPG). Recommended: 160×40px</p>
            </div>
            {logoUrl && (
              <div className="mt-3 p-3 bg-gray-50 rounded-lg border">
                <p className="text-xs text-gray-500 mb-2">Preview:</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logoUrl} alt="Logo preview" className="h-10 object-contain" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              </div>
            )}
          </div>

          {/* Brand color */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <h2 className="text-base font-semibold text-gray-800 mb-4">Brand Color</h2>
            <div className="flex flex-wrap gap-2 mb-4">
              {PRESET_COLORS.map(color => (
                <button
                  key={color}
                  onClick={() => setPrimaryColor(color)}
                  className={`w-8 h-8 rounded-full border-2 transition ${primaryColor === color ? 'border-gray-800 scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={primaryColor}
                onChange={e => setPrimaryColor(e.target.value)}
                className="w-12 h-10 rounded cursor-pointer border"
              />
              <input
                type="text"
                value={primaryColor}
                onChange={e => setPrimaryColor(e.target.value)}
                placeholder="#2563eb"
                className="flex-1 border rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Tagline */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <h2 className="text-base font-semibold text-gray-800 mb-4">Company Tagline</h2>
            <input
              type="text"
              value={tagline}
              onChange={e => setTagline(e.target.value)}
              placeholder="Professional property management"
              maxLength={80}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">{tagline.length}/80 characters</p>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving...' : 'Save Branding'}
          </button>
          {saved && <p className="text-green-600 text-sm text-center font-medium">✓ Branding saved successfully!</p>}
        </div>

        {/* Preview panel */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 h-fit">
          <h2 className="text-base font-semibold text-gray-800 mb-4">Live Preview</h2>

          {/* Sidebar preview */}
          <div className="rounded-lg overflow-hidden border border-gray-200 shadow-sm">
            <div className="px-4 py-3 text-white font-semibold text-sm flex items-center gap-2" style={{ backgroundColor: primaryColor }}>
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt="logo" className="h-6 object-contain" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              ) : (
                <span>{landlord.name || 'RentFlow'}</span>
              )}
            </div>
            <div className="p-3 bg-gray-800 space-y-1">
              {['Dashboard', 'Properties', 'Tenants', 'Leases', 'Payments'].map(item => (
                <div key={item} className="px-3 py-1.5 rounded text-xs text-gray-300 hover:bg-gray-700">
                  {item}
                </div>
              ))}
            </div>
          </div>

          {tagline && (
            <div className="mt-4 p-3 rounded-lg border text-sm text-center" style={{ borderColor: primaryColor, color: primaryColor }}>
              &ldquo;{tagline}&rdquo;
            </div>
          )}

          <div className="mt-4 p-3 rounded-lg text-white text-sm text-center font-medium" style={{ backgroundColor: primaryColor }}>
            Sample Button
          </div>

          <p className="text-xs text-gray-400 mt-4 text-center">
            Branding is applied to PDFs, receipts, and printed reports
          </p>
        </div>
      </div>
    </div>
  );
}
