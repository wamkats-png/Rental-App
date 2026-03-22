'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '../context/AppContext';
import { useAuth } from '../components/AuthProvider';
import type { PropertyType } from '../types';

export default function WelcomePage() {
  const router = useRouter();
  const { user } = useAuth();
  const { landlord, updateLandlord, addProperty, addUnit } = useApp();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Step 1: Profile
  const [profile, setProfile] = useState({
    name: landlord.name || '',
    phone: landlord.phone || '',
    landlord_type: landlord.landlord_type || 'Individual' as 'Individual' | 'Company',
    ura_tin: landlord.ura_tin || '',
  });

  // Step 2: First property
  const [property, setProperty] = useState({
    name: '',
    address: '',
    district: '',
    property_type: 'Residential' as PropertyType,
  });
  const [unitCount, setUnitCount] = useState(1);

  const handleProfileSave = async () => {
    setSaveError('');
    setSaving(true);
    try {
      await updateLandlord(profile);
      setStep(2);
    } catch {
      setSaveError('Failed to save profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handlePropertySave = async () => {
    setSaveError('');
    if (!property.name) {
      setStep(3);
      return;
    }
    setSaving(true);
    try {
      await addProperty({
        name: property.name,
        address: property.address,
        district: property.district,
        lc_area: '',
        property_type: property.property_type,
        property_rates_ref: '',
      });
      setStep(3);
    } catch {
      setSaveError('Failed to save property. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleFinish = () => {
    router.replace('/');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-lg">
        {/* Progress dots */}
        <div className="flex justify-center gap-2 mb-8">
          {[1, 2, 3].map(s => (
            <div
              key={s}
              className={`h-2 rounded-full transition-all ${
                s === step ? 'w-8 bg-blue-600' : s < step ? 'w-2 bg-blue-400' : 'w-2 bg-gray-300'
              }`}
            />
          ))}
        </div>

        {/* Step 1: Profile */}
        {step === 1 && (
          <div>
            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold text-gray-800 mb-2">Welcome to RentFlow Uganda!</h1>
              <p className="text-gray-600">Let&apos;s set up your landlord profile.</p>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name / Company Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={profile.name}
                  onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Your name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                <input
                  type="tel"
                  value={profile.phone}
                  onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="+256 700 000 000"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Account Type</label>
                <select
                  value={profile.landlord_type}
                  onChange={(e) => setProfile({ ...profile, landlord_type: e.target.value as 'Individual' | 'Company' })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="Individual">Individual Landlord</option>
                  <option value="Company">Property Management Company</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">URA Tax Identification Number</label>
                <input
                  type="text"
                  value={profile.ura_tin}
                  onChange={(e) => setProfile({ ...profile, ura_tin: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Optional — you can add this later"
                />
              </div>
              {saveError && <p className="text-red-600 text-sm">{saveError}</p>}
              <button
                onClick={handleProfileSave}
                disabled={!profile.name || saving}
                className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-all disabled:opacity-50 font-medium mt-2"
              >
                {saving ? 'Saving...' : 'Continue'}
              </button>
            </div>
          </div>
        )}

        {/* Step 2: First property */}
        {step === 2 && (
          <div>
            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold text-gray-800 mb-2">Add Your First Property</h1>
              <p className="text-gray-600">You can skip this and add properties later.</p>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Property Name</label>
                <input
                  type="text"
                  value={property.name}
                  onChange={(e) => setProperty({ ...property, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g. Kampala Heights Apartments"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <input
                  type="text"
                  value={property.address}
                  onChange={(e) => setProperty({ ...property, address: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Street address"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">District</label>
                <input
                  type="text"
                  value={property.district}
                  onChange={(e) => setProperty({ ...property, district: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g. Kampala"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Property Type</label>
                <select
                  value={property.property_type}
                  onChange={(e) => setProperty({ ...property, property_type: e.target.value as PropertyType })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="Residential">Residential</option>
                  <option value="Commercial">Commercial</option>
                  <option value="Mixed">Mixed Use</option>
                </select>
              </div>
              {saveError && <p className="text-red-600 text-sm">{saveError}</p>}
              <div className="flex gap-3 mt-2">
                <button
                  onClick={() => { setSaveError(''); setProperty({ name: '', address: '', district: '', property_type: 'Residential' }); setStep(3); }}
                  className="flex-1 border border-gray-300 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-50 transition-all font-medium"
                >
                  Skip
                </button>
                <button
                  onClick={handlePropertySave}
                  disabled={saving}
                  className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-all disabled:opacity-50 font-medium"
                >
                  {saving ? 'Saving...' : property.name ? 'Add Property' : 'Skip'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Done */}
        {step === 3 && (
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-800 mb-2">You&apos;re All Set!</h1>
            <p className="text-gray-600 mb-6">
              Your RentFlow Uganda account is ready. Start managing your properties, tenants, and payments.
            </p>
            <button
              onClick={handleFinish}
              className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 transition-all font-medium"
            >
              Go to Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
