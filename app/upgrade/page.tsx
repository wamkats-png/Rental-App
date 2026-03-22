'use client';

import { useApp } from '../context/AppContext';
import { useSubscription } from '../lib/useSubscription';

const FEATURES = [
  { label: 'Properties', free: '3', pro: 'Unlimited' },
  { label: 'Tenants', free: '10', pro: 'Unlimited' },
  { label: 'Active Leases', free: '10', pro: 'Unlimited' },
  { label: 'Expense Tracking', free: '✓', pro: '✓' },
  { label: 'CSV Import', free: '✓', pro: '✓' },
  { label: 'Bank Reconciliation', free: '✓', pro: '✓' },
  { label: 'Auto SMS Reminders', free: '✓', pro: '✓' },
  { label: 'AI Rent Reminders', free: '✗', pro: '✓' },
  { label: 'AI Contract Generator', free: '✗', pro: '✓' },
  { label: 'AI Portfolio Insights', free: '✗', pro: '✓' },
  { label: 'Team Members', free: '1', pro: '5' },
  { label: 'Revenue Forecasting', free: '✗', pro: '✓' },
  { label: 'Audit Log', free: '✗', pro: '✓' },
  { label: 'White-label Branding', free: '✗', pro: '✓' },
  { label: 'Priority Support', free: '✗', pro: '✓' },
];

export default function UpgradePage() {
  const { landlord } = useApp();
  const { plan, propertiesUsed, propertiesMax, tenantsUsed, tenantsMax, leasesUsed, leasesMax } = useSubscription();
  const isAI = plan === 'AI_Assist';

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-gray-900">
          {isAI ? '✅ You\'re on AI Assist' : 'Upgrade to AI Assist'}
        </h1>
        <p className="text-gray-500 mt-2">
          {isAI
            ? 'You have full access to all RentFlow features.'
            : 'Unlock unlimited properties, AI features, and team collaboration.'}
        </p>
      </div>

      {/* Current usage */}
      {!isAI && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-8">
          <p className="text-sm font-semibold text-amber-800 mb-3">Your Current Usage (Free Plan)</p>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Properties', used: propertiesUsed, max: propertiesMax },
              { label: 'Tenants', used: tenantsUsed, max: tenantsMax },
              { label: 'Active Leases', used: leasesUsed, max: leasesMax },
            ].map(item => (
              <div key={item.label}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-amber-700">{item.label}</span>
                  <span className="font-semibold text-amber-800">{item.used}/{item.max}</span>
                </div>
                <div className="h-2 bg-amber-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      item.used >= item.max ? 'bg-red-500' : item.used >= item.max * 0.8 ? 'bg-amber-500' : 'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(100, (item.used / item.max) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Plan cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Free */}
        <div className={`rounded-xl border-2 p-6 ${plan === 'Free' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'}`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-800">Free</h2>
            {plan === 'Free' && <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-semibold rounded">Current</span>}
          </div>
          <p className="text-3xl font-bold text-gray-900 mb-1">UGX 0<span className="text-lg font-normal text-gray-500">/mo</span></p>
          <p className="text-sm text-gray-500 mb-5">Great for getting started</p>
          <ul className="space-y-2 text-sm">
            <li className="flex gap-2 text-gray-600"><span className="text-green-500">✓</span> 3 properties, 10 tenants</li>
            <li className="flex gap-2 text-gray-600"><span className="text-green-500">✓</span> Payments & leases</li>
            <li className="flex gap-2 text-gray-600"><span className="text-green-500">✓</span> SMS via Africa's Talking</li>
            <li className="flex gap-2 text-gray-400"><span className="text-red-400">✗</span> AI features</li>
            <li className="flex gap-2 text-gray-400"><span className="text-red-400">✗</span> Team collaboration</li>
          </ul>
        </div>

        {/* AI Assist */}
        <div className={`rounded-xl border-2 p-6 ${plan === 'AI_Assist' ? 'border-purple-500 bg-purple-50' : 'border-purple-300 bg-white'} relative overflow-hidden`}>
          <div className="absolute top-3 right-3">
            <span className="px-2 py-0.5 bg-purple-600 text-white text-xs font-bold rounded">RECOMMENDED</span>
          </div>
          {plan === 'AI_Assist' && (
            <div className="absolute top-3 left-3">
              <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-semibold rounded">Current</span>
            </div>
          )}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-800">AI Assist</h2>
          </div>
          <p className="text-3xl font-bold text-gray-900 mb-1">UGX 50,000<span className="text-lg font-normal text-gray-500">/mo</span></p>
          <p className="text-sm text-gray-500 mb-5">For professional landlords</p>
          <ul className="space-y-2 text-sm">
            <li className="flex gap-2 text-gray-600"><span className="text-green-500">✓</span> Unlimited properties & tenants</li>
            <li className="flex gap-2 text-gray-600"><span className="text-green-500">✓</span> AI Contract Generator</li>
            <li className="flex gap-2 text-gray-600"><span className="text-green-500">✓</span> AI Reminders & Insights</li>
            <li className="flex gap-2 text-gray-600"><span className="text-green-500">✓</span> Team members (up to 5)</li>
            <li className="flex gap-2 text-gray-600"><span className="text-green-500">✓</span> Audit log & white-label</li>
          </ul>
          {!isAI && (
            <button
              onClick={() => alert('Payment integration coming soon. Contact support@rentflow.ug to upgrade manually.')}
              className="mt-6 w-full bg-purple-600 text-white py-3 rounded-lg font-semibold hover:bg-purple-700 transition-colors"
            >
              Upgrade Now →
            </button>
          )}
        </div>
      </div>

      {/* Feature comparison table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b bg-gray-50">
          <h2 className="font-semibold text-gray-800">Full Feature Comparison</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="px-5 py-3 text-left text-gray-600 font-medium">Feature</th>
              <th className="px-5 py-3 text-center text-gray-600 font-medium">Free</th>
              <th className="px-5 py-3 text-center text-purple-700 font-medium">AI Assist</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {FEATURES.map(f => (
              <tr key={f.label} className="hover:bg-gray-50">
                <td className="px-5 py-3 text-gray-700">{f.label}</td>
                <td className="px-5 py-3 text-center">
                  <span className={f.free === '✗' ? 'text-red-400' : 'text-green-600'}>{f.free}</span>
                </td>
                <td className="px-5 py-3 text-center">
                  <span className={f.pro === '✗' ? 'text-red-400' : 'text-purple-600 font-medium'}>{f.pro}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!isAI && (
        <div className="mt-6 text-center text-sm text-gray-500">
          To upgrade, contact <a href="mailto:support@rentflow.ug" className="text-blue-600 hover:underline">support@rentflow.ug</a> or call +256 700 000 000
        </div>
      )}
    </div>
  );
}
