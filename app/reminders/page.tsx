'use client';

import { useState, useMemo } from 'react';
import { RateLimitBanner } from '../components/RateLimitBanner';
import { useApp } from '../context/AppContext';
import { resolveTemplate, formatUGX } from '../lib/utils';

type Language = 'English' | 'Luganda';

interface ReminderTarget {
  leaseId: string;
  tenantId: string;
  tenantName: string;
  tenantPhone: string;
  propertyName: string;
  unitCode: string;
  rentAmount: number;
  currency: string;
  dueDay: number;
  lastPaymentDate: string | null;
  daysOverdue: number;
}

export default function RemindersPage() {
  const { leases, tenants, properties, units, payments, landlord, addCommunicationLog, commTemplates, addCommTemplate } = useApp();

  // Single mode
  const [selectedLeaseId, setSelectedLeaseId] = useState('');
  const [language, setLanguage] = useState<Language>('English');
  const [generatedMessage, setGeneratedMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rateLimitMs, setRateLimitMs] = useState(0);
  const [copied, setCopied] = useState(false);
  const [logged, setLogged] = useState(false);

  // Bulk mode
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkMessages, setBulkMessages] = useState<Record<string, string>>({});
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(0);
  const [copiedBulk, setCopiedBulk] = useState<string | null>(null);
  const [loggedBulk, setLoggedBulk] = useState<Set<string>>(new Set());

  // Template
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);

  const reminderTargets = useMemo<ReminderTarget[]>(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return leases
      .filter(l => l.status === 'Active')
      .map(lease => {
        const tenant = tenants.find(t => t.id === lease.tenant_id);
        const property = properties.find(p => p.id === lease.property_id);
        const unit = units.find(u => u.id === lease.unit_id);

        const leasePayments = payments
          .filter(p => p.lease_id === lease.id)
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        const lastPayment = leasePayments[0] ?? null;

        const dueThisMonth = new Date(today.getFullYear(), today.getMonth(), lease.due_day);
        let daysOverdue = 0;
        if (today > dueThisMonth) {
          const paidThisMonth = leasePayments.some(p => {
            const pd = new Date(p.date);
            return pd.getFullYear() === today.getFullYear() && pd.getMonth() === today.getMonth();
          });
          if (!paidThisMonth) {
            daysOverdue = Math.floor((today.getTime() - dueThisMonth.getTime()) / (1000 * 60 * 60 * 24));
          }
        }

        return {
          leaseId: lease.id,
          tenantId: lease.tenant_id,
          tenantName: tenant?.full_name ?? 'Unknown Tenant',
          tenantPhone: tenant?.phone ?? '',
          propertyName: property?.name ?? 'Unknown Property',
          unitCode: unit?.code ?? '',
          rentAmount: lease.rent_amount,
          currency: lease.currency,
          dueDay: lease.due_day,
          lastPaymentDate: lastPayment?.date ?? null,
          daysOverdue,
        };
      })
      .sort((a, b) => b.daysOverdue - a.daysOverdue);
  }, [leases, tenants, properties, units, payments]);

  const selectedTarget = reminderTargets.find(t => t.leaseId === selectedLeaseId);
  const overdueCount = reminderTargets.filter(t => t.daysOverdue > 0).length;

  // Build template vars for selected tenant
  const templateVars = (target: ReminderTarget) => ({
    tenant_name: target.tenantName,
    amount: formatUGX(target.rentAmount),
    property_name: target.propertyName,
    due_date: `${target.dueDay}${(() => { const n = target.dueDay; const s = n % 100; return s >= 11 && s <= 13 ? 'th' : ['th','st','nd','rd'][n % 10] ?? 'th'; })()} of month`,
    landlord_name: landlord.name,
  });

  // Apply template to single mode
  const handleApplyTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId);
    if (!templateId || !selectedTarget) return;
    const template = commTemplates.find(t => t.id === templateId);
    if (!template) return;
    const resolved = resolveTemplate(template.body, templateVars(selectedTarget));
    setGeneratedMessage(resolved);
  };

  async function handleGenerate() {
    if (!selectedTarget) return;
    setLoading(true);
    setError('');
    setGeneratedMessage('');
    setCopied(false);
    setLogged(false);

    try {
      const res = await fetch('/api/ai-reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantName: selectedTarget.tenantName,
          landlordName: landlord.name,
          amountDue: selectedTarget.rentAmount,
          currency: selectedTarget.currency,
          dueDay: selectedTarget.dueDay,
          propertyAddress: `${selectedTarget.propertyName}${selectedTarget.unitCode ? ` - ${selectedTarget.unitCode}` : ''}`,
          language,
          daysOverdue: selectedTarget.daysOverdue,
        }),
      });
      const data = await res.json();
      if (res.status === 429) {
        setRateLimitMs(data.retryAfterMs ?? 60_000);
        return;
      }
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to generate message');
      setGeneratedMessage(data.message);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(generatedMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleLogCommunication() {
    if (!selectedTarget || !generatedMessage) return;
    await addCommunicationLog({
      tenant_id: selectedTarget.tenantId,
      date: new Date().toISOString().split('T')[0],
      type: 'WhatsApp',
      note: `AI reminder (${language}): ${generatedMessage.substring(0, 120)}...`,
    });
    setLogged(true);
  }

  // Save current message as template
  async function handleSaveTemplate() {
    if (!newTemplateName.trim() || !generatedMessage) return;
    setSavingTemplate(true);
    try {
      await addCommTemplate({
        landlord_id: landlord.id,
        name: newTemplateName.trim(),
        category: 'Rent Reminder',
        body: generatedMessage,
      });
      setShowSaveTemplate(false);
      setNewTemplateName('');
    } finally {
      setSavingTemplate(false);
    }
  }

  // Bulk mode handlers
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAllOverdue = () => {
    const overdue = reminderTargets.filter(t => t.daysOverdue > 0).map(t => t.leaseId);
    setSelectedIds(new Set(overdue));
  };

  const handleBulkGenerate = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setBulkLoading(true);
    setBulkProgress(0);
    setBulkMessages({});
    setRateLimitMs(0);

    // Sequential — avoids thundering herd on the 20/min rate limit
    const results: [string, string][] = [];
    for (let i = 0; i < ids.length; i++) {
      const leaseId = ids[i];
      const target = reminderTargets.find(t => t.leaseId === leaseId)!;
      try {
        const res = await fetch('/api/ai-reminders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenantName: target.tenantName,
            landlordName: landlord.name,
            amountDue: target.rentAmount,
            currency: target.currency,
            dueDay: target.dueDay,
            propertyAddress: `${target.propertyName}${target.unitCode ? ` - ${target.unitCode}` : ''}`,
            language,
            daysOverdue: target.daysOverdue,
          }),
        });
        const data = await res.json();
        if (res.status === 429) {
          // Mark remaining as pending, show countdown, stop loop
          for (let j = i; j < ids.length; j++) results.push([ids[j], '⏳ Rate limit — regenerate after countdown']);
          setRateLimitMs(data.retryAfterMs ?? 60_000);
          break;
        }
        results.push([leaseId, data.success ? data.message : `Error: ${data.error}`]);
      } catch {
        results.push([leaseId, 'Failed to generate']);
      }
      setBulkProgress(i + 1);
    }

    setBulkMessages(Object.fromEntries(results));
    setBulkLoading(false);
  };

  const copyBulk = async (leaseId: string, msg: string) => {
    await navigator.clipboard.writeText(msg);
    setCopiedBulk(leaseId);
    setTimeout(() => setCopiedBulk(null), 2000);
  };

  const logBulk = async (leaseId: string, msg: string) => {
    const target = reminderTargets.find(t => t.leaseId === leaseId);
    if (!target) return;
    await addCommunicationLog({
      tenant_id: target.tenantId,
      date: new Date().toISOString().split('T')[0],
      type: 'WhatsApp',
      note: `Bulk AI reminder (${language}): ${msg.substring(0, 120)}...`,
    });
    setLoggedBulk(prev => new Set(Array.from(prev).concat(leaseId)));
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AI Rent Reminders</h1>
          <p className="text-gray-500 mt-1">Generate WhatsApp or SMS reminder messages for your tenants using AI.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setBulkMode(false); setSelectedIds(new Set()); setBulkMessages({}); }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition ${!bulkMode ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
          >
            Single
          </button>
          <button
            onClick={() => setBulkMode(true)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition ${bulkMode ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
          >
            Bulk
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-lg border p-4">
          <p className="text-sm text-gray-500">Active Leases</p>
          <p className="text-2xl font-bold text-gray-900">{reminderTargets.length}</p>
        </div>
        <div className={`rounded-lg border p-4 ${overdueCount > 0 ? 'bg-red-50 border-red-200' : 'bg-white'}`}>
          <p className="text-sm text-gray-500">Overdue Payments</p>
          <p className={`text-2xl font-bold ${overdueCount > 0 ? 'text-red-600' : 'text-gray-900'}`}>{overdueCount}</p>
        </div>
      </div>

      {/* ── SINGLE MODE ── */}
      {!bulkMode && (
        <div className="bg-white rounded-xl border shadow-sm p-6 space-y-5">
          {/* Tenant selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Tenant / Lease</label>
            <select
              value={selectedLeaseId}
              onChange={e => { setSelectedLeaseId(e.target.value); setGeneratedMessage(''); setError(''); setSelectedTemplateId(''); }}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Choose a tenant --</option>
              {reminderTargets.map(t => (
                <option key={t.leaseId} value={t.leaseId}>
                  {t.tenantName} — {t.propertyName}{t.unitCode ? ` (${t.unitCode})` : ''}
                  {t.daysOverdue > 0 ? ` ⚠ ${t.daysOverdue}d overdue` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Selected tenant info */}
          {selectedTarget && (
            <div className={`rounded-lg p-4 text-sm space-y-1 ${selectedTarget.daysOverdue > 0 ? 'bg-red-50 border border-red-200' : 'bg-blue-50 border border-blue-200'}`}>
              <div className="flex justify-between"><span className="text-gray-600">Tenant</span><span className="font-medium">{selectedTarget.tenantName}</span></div>
              <div className="flex justify-between"><span className="text-gray-600">Rent</span><span className="font-medium">{selectedTarget.currency} {selectedTarget.rentAmount.toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-gray-600">Status</span><span className={`font-medium ${selectedTarget.daysOverdue > 0 ? 'text-red-600' : 'text-green-600'}`}>{selectedTarget.daysOverdue > 0 ? `${selectedTarget.daysOverdue} days overdue` : 'Up to date'}</span></div>
              {selectedTarget.tenantPhone && <div className="flex justify-between"><span className="text-gray-600">Phone</span><span className="font-medium">{selectedTarget.tenantPhone}</span></div>}
            </div>
          )}

          {/* Template picker */}
          {commTemplates.length > 0 && selectedTarget && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Use Saved Template (optional)</label>
              <select
                value={selectedTemplateId}
                onChange={e => handleApplyTemplate(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- No template, use AI --</option>
                {commTemplates.map(t => (
                  <option key={t.id} value={t.id}>{t.name} ({t.category})</option>
                ))}
              </select>
            </div>
          )}

          {/* Language selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Message Language</label>
            <div className="flex gap-3">
              {(['English', 'Luganda'] as Language[]).map(lang => (
                <button key={lang} onClick={() => setLanguage(lang)} className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${language === lang ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}>{lang}</button>
              ))}
            </div>
          </div>

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={!selectedLeaseId || loading || rateLimitMs > 0}
            className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full"></span>
                Generating...
              </span>
            ) : 'Generate AI Reminder'}
          </button>

          {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">{error}</div>}
          {rateLimitMs > 0 && (
            <RateLimitBanner retryAfterMs={rateLimitMs} onReady={() => setRateLimitMs(0)} />
          )}

          {generatedMessage && (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">Generated Message</label>
              <textarea value={generatedMessage} onChange={e => setGeneratedMessage(e.target.value)} rows={7} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              <div className="flex gap-3 flex-wrap">
                <button onClick={handleCopy} className="flex-1 bg-green-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors">{copied ? 'Copied!' : 'Copy'}</button>
                <button onClick={handleLogCommunication} disabled={logged} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-60 transition-colors">{logged ? 'Logged!' : 'Log as WhatsApp Sent'}</button>
                <button onClick={() => setShowSaveTemplate(true)} className="flex-1 border border-blue-300 text-blue-700 py-2 rounded-lg text-sm font-medium hover:bg-blue-50 transition-colors">Save as Template</button>
              </div>
              {selectedTarget?.tenantPhone && (
                <a href={`https://wa.me/${selectedTarget.tenantPhone.replace(/\D/g, '')}?text=${encodeURIComponent(generatedMessage)}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 w-full bg-[#25D366] text-white py-2 rounded-lg text-sm font-medium hover:bg-[#1ebe5b] transition-colors">Open in WhatsApp</a>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── BULK MODE ── */}
      {bulkMode && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-800">Select Tenants</h2>
              <div className="flex gap-2">
                {overdueCount > 0 && (
                  <button onClick={selectAllOverdue} className="text-sm text-orange-600 border border-orange-300 px-3 py-1.5 rounded-lg hover:bg-orange-50">
                    Select All Overdue ({overdueCount})
                  </button>
                )}
                <button onClick={() => setSelectedIds(new Set())} className="text-sm text-gray-500 border border-gray-300 px-3 py-1.5 rounded-lg hover:bg-gray-50">Clear</button>
              </div>
            </div>

            <div className="space-y-2 max-h-80 overflow-y-auto">
              {reminderTargets.map(t => (
                <label key={t.leaseId} className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer border transition ${selectedIds.has(t.leaseId) ? 'bg-blue-50 border-blue-200' : 'border-gray-100 hover:bg-gray-50'}`}>
                  <input type="checkbox" checked={selectedIds.has(t.leaseId)} onChange={() => toggleSelect(t.leaseId)} className="w-4 h-4 text-blue-600" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800 text-sm">{t.tenantName}</p>
                    <p className="text-xs text-gray-500">{t.propertyName}{t.unitCode ? ` — ${t.unitCode}` : ''} · {t.currency} {t.rentAmount.toLocaleString()}</p>
                  </div>
                  {t.daysOverdue > 0 && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">{t.daysOverdue}d overdue</span>}
                </label>
              ))}
            </div>

            <div className="flex items-center gap-3 mt-4">
              <div className="flex gap-2">
                {(['English', 'Luganda'] as Language[]).map(lang => (
                  <button key={lang} onClick={() => setLanguage(lang)} className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition ${language === lang ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}>{lang}</button>
                ))}
              </div>
              <button
                onClick={handleBulkGenerate}
                disabled={selectedIds.size === 0 || bulkLoading || rateLimitMs > 0}
                className="ml-auto bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {bulkLoading ? `Generating ${bulkProgress}/${selectedIds.size}...` : `Generate ${selectedIds.size > 0 ? selectedIds.size : ''} Messages`}
              </button>
            </div>
          </div>

          {/* Bulk results */}
          {Object.keys(bulkMessages).length > 0 && (
            <div className="space-y-3">
              {Object.entries(bulkMessages).map(([leaseId, msg]) => {
                const target = reminderTargets.find(t => t.leaseId === leaseId)!;
                return (
                  <div key={leaseId} className="bg-white rounded-xl border shadow-sm p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="font-semibold text-gray-800">{target.tenantName}</p>
                        <p className="text-xs text-gray-500">{target.propertyName}{target.unitCode ? ` — ${target.unitCode}` : ''}</p>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => copyBulk(leaseId, msg)} className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700">{copiedBulk === leaseId ? 'Copied!' : 'Copy'}</button>
                        <button onClick={() => logBulk(leaseId, msg)} disabled={loggedBulk.has(leaseId)} className="text-xs border border-gray-300 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-50 disabled:opacity-50">{loggedBulk.has(leaseId) ? 'Logged' : 'Log'}</button>
                        {target.tenantPhone && (
                          <a href={`https://wa.me/${target.tenantPhone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`} target="_blank" rel="noopener noreferrer" className="text-xs bg-[#25D366] text-white px-3 py-1.5 rounded-lg hover:bg-[#1ebe5b]">WhatsApp</a>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-gray-700 bg-gray-50 rounded p-3 whitespace-pre-wrap">{msg}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {reminderTargets.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <p className="text-4xl mb-3">💬</p>
          <p>No active leases found. Add a lease first to generate reminders.</p>
        </div>
      )}

      {/* Save as Template modal */}
      {showSaveTemplate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Save as Template</h3>
            <input
              type="text"
              value={newTemplateName}
              onChange={e => setNewTemplateName(e.target.value)}
              placeholder="Template name (e.g. Monthly Reminder EN)"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 mb-4"
            />
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowSaveTemplate(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
              <button onClick={handleSaveTemplate} disabled={savingTemplate || !newTemplateName.trim()} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">{savingTemplate ? 'Saving...' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
