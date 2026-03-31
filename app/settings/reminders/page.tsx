'use client';

import { useState, useEffect } from 'react';

interface ReminderConfig {
  enabled: boolean;
  daysBefore: number;
  includeOverdue: boolean;
  includeExpiringLeases: boolean;
  expiryWarningDays: number;
}

const DEFAULT_CONFIG: ReminderConfig = {
  enabled: false,
  daysBefore: 3,
  includeOverdue: true,
  includeExpiringLeases: true,
  expiryWarningDays: 30,
};

const STORAGE_KEY = 'rf_reminder_config';

function loadConfig(): ReminderConfig {
  if (typeof window === 'undefined') return DEFAULT_CONFIG;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULT_CONFIG, ...JSON.parse(raw) } : DEFAULT_CONFIG;
  } catch { return DEFAULT_CONFIG; }
}

export default function ReminderSettingsPage() {
  const [config, setConfig] = useState<ReminderConfig>(DEFAULT_CONFIG);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  useEffect(() => { setConfig(loadConfig()); }, []);

  const handleSave = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      // POST to /api/cron/test-run which injects the server-side CRON_SECRET,
      // so the client never needs to know or expose it.
      const res = await fetch('/api/cron/test-run', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setTestResult(`Error: ${data.error ?? 'Unknown error'}`);
      } else {
        setTestResult(`Processed: ${data.sent ?? 0} sent, ${data.skipped ?? 0} skipped`);
      }
    } catch (e: any) {
      setTestResult(`Error: ${e.message}`);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Auto Reminder Settings</h1>
        <p className="text-sm text-gray-500 mt-1">
          Configure automatic SMS reminders sent to tenants before rent is due
        </p>
      </div>

      {/* Africa's Talking Status */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <p className="text-sm font-semibold text-blue-800 mb-1">SMS Provider: Africa's Talking</p>
        <p className="text-xs text-blue-600">
          Set <code className="bg-blue-100 px-1 rounded">AFRICASTALKING_API_KEY</code>,{' '}
          <code className="bg-blue-100 px-1 rounded">AFRICASTALKING_USERNAME</code>, and{' '}
          <code className="bg-blue-100 px-1 rounded">AFRICASTALKING_ENV=production</code> in your environment variables to enable live SMS.
          Without these, reminders are simulated.
        </p>
      </div>

      {/* Cron Setup */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
        <p className="text-sm font-semibold text-gray-700 mb-1">Vercel Cron Setup</p>
        <p className="text-xs text-gray-600 mb-2">Add to <code className="bg-gray-100 px-1 rounded">vercel.json</code> to run daily at 8 AM:</p>
        <pre className="bg-white border rounded p-3 text-xs overflow-x-auto text-gray-800">{`{
  "crons": [
    { "path": "/api/cron/reminders", "schedule": "0 8 * * *" }
  ]
}`}</pre>
        <p className="text-xs text-gray-500 mt-2">
          Also set <code className="bg-gray-100 px-1 rounded">CRON_SECRET</code> and{' '}
          <code className="bg-gray-100 px-1 rounded">SUPABASE_SERVICE_ROLE_KEY</code> env vars.
        </p>
      </div>

      {/* Settings form */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-800">Enable Auto Reminders</p>
            <p className="text-xs text-gray-500 mt-0.5">Automatically send SMS reminders before rent is due</p>
          </div>
          <button
            onClick={() => setConfig(prev => ({ ...prev, enabled: !prev.enabled }))}
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${config.enabled ? 'bg-blue-600' : 'bg-gray-200'}`}
            aria-label="Toggle auto reminders"
          >
            <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${config.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Send reminder this many days before due date
          </label>
          <div className="flex items-center gap-3">
            <input
              type="range" min={1} max={14} value={config.daysBefore}
              onChange={e => setConfig(prev => ({ ...prev, daysBefore: +e.target.value }))}
              className="flex-1"
            />
            <span className="text-sm font-semibold text-blue-600 w-8">{config.daysBefore}d</span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-800">Send overdue reminders</p>
            <p className="text-xs text-gray-500 mt-0.5">Remind tenants who have not paid after the due date</p>
          </div>
          <button
            onClick={() => setConfig(prev => ({ ...prev, includeOverdue: !prev.includeOverdue }))}
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${config.includeOverdue ? 'bg-blue-600' : 'bg-gray-200'}`}
          >
            <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${config.includeOverdue ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-800">Send lease expiry warnings</p>
            <p className="text-xs text-gray-500 mt-0.5">Notify tenants when their lease is about to expire</p>
          </div>
          <button
            onClick={() => setConfig(prev => ({ ...prev, includeExpiringLeases: !prev.includeExpiringLeases }))}
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${config.includeExpiringLeases ? 'bg-blue-600' : 'bg-gray-200'}`}
          >
            <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${config.includeExpiringLeases ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>

        {config.includeExpiringLeases && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Warn this many days before lease expiry
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range" min={7} max={90} step={7} value={config.expiryWarningDays}
                onChange={e => setConfig(prev => ({ ...prev, expiryWarningDays: +e.target.value }))}
                className="flex-1"
              />
              <span className="text-sm font-semibold text-blue-600 w-10">{config.expiryWarningDays}d</span>
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={handleSave}
            className="bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            Save Settings
          </button>
          {saved && <span className="text-green-600 text-sm font-medium">Saved!</span>}
          <button
            onClick={handleTest}
            disabled={testing}
            className="ml-auto border border-gray-300 text-gray-700 px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
          >
            {testing ? 'Running...' : 'Test Run Now'}
          </button>
        </div>
        {testResult && (
          <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-800">
            {testResult}
          </div>
        )}
      </div>
    </div>
  );
}
