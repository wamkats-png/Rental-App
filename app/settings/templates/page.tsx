'use client';

import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import type { CommTemplate } from '../../types';

const TEMPLATE_CATEGORIES = ['Rent Reminder', 'Receipt', 'Notice', 'Other'] as const;

const PLACEHOLDER_TOKENS = [
  { token: '{{tenant_name}}', desc: 'Tenant full name' },
  { token: '{{amount}}', desc: 'Rent amount (UGX)' },
  { token: '{{property_name}}', desc: 'Property name' },
  { token: '{{due_date}}', desc: 'Payment due date' },
  { token: '{{landlord_name}}', desc: 'Landlord name' },
];

const defaultForm = {
  name: '',
  category: 'Rent Reminder' as typeof TEMPLATE_CATEGORIES[number],
  body: '',
};

export default function TemplatesPage() {
  const { commTemplates, addCommTemplate, updateCommTemplate, deleteCommTemplate, landlord } = useApp();

  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const openAdd = () => {
    setForm(defaultForm);
    setEditId(null);
    setShowModal(true);
  };

  const openEdit = (t: CommTemplate) => {
    setForm({ name: t.name, category: t.category as typeof TEMPLATE_CATEGORIES[number], body: t.body });
    setEditId(t.id);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.body.trim()) return;
    setSaving(true);
    try {
      const payload = { landlord_id: landlord.id, name: form.name.trim(), category: form.category, body: form.body.trim() };
      if (editId) {
        await updateCommTemplate(editId, payload);
      } else {
        await addCommTemplate(payload);
      }
      setShowModal(false);
    } finally {
      setSaving(false);
    }
  };

  const insertToken = (token: string) => {
    setForm(prev => ({ ...prev, body: prev.body + token }));
  };

  const copyToken = (token: string) => {
    navigator.clipboard.writeText(token).catch(() => {});
    setCopied(token);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Message Templates</h1>
          <p className="text-sm text-gray-500 mt-1">Reusable templates for rent reminders, notices, and receipts</p>
        </div>
        <button onClick={openAdd} className="bg-blue-600 text-white px-4 py-2.5 rounded-lg hover:bg-blue-700 transition font-medium text-sm">
          + New Template
        </button>
      </div>

      {commTemplates.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <p className="text-gray-500 text-lg mb-2">No templates yet</p>
          <p className="text-sm text-gray-400">Create reusable message templates to speed up your reminders and notices.</p>
          <button onClick={openAdd} className="mt-4 bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">Create First Template</button>
        </div>
      ) : (
        <div className="space-y-4">
          {commTemplates.map(t => (
            <div key={t.id} className="bg-white rounded-lg shadow p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-gray-800">{t.name}</h3>
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">{t.category}</span>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => openEdit(t)} className="text-blue-600 hover:text-blue-800 text-sm font-medium">Edit</button>
                  <button onClick={() => setConfirmDelete(t.id)} className="text-red-500 hover:text-red-700 text-sm font-medium">Delete</button>
                </div>
              </div>
              <pre className="text-sm text-gray-700 bg-gray-50 rounded p-3 whitespace-pre-wrap font-sans border">{t.body}</pre>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl my-8">
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-800">{editId ? 'Edit Template' : 'New Template'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Template Name *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g. Monthly Rent Reminder"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select
                    value={form.category}
                    onChange={e => setForm(prev => ({ ...prev, category: e.target.value as typeof TEMPLATE_CATEGORIES[number] }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                  >
                    {TEMPLATE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs font-semibold text-blue-700 mb-2">Available tokens (click to insert, right-click to copy):</p>
                <div className="flex flex-wrap gap-2">
                  {PLACEHOLDER_TOKENS.map(({ token, desc }) => (
                    <button
                      key={token}
                      onClick={() => insertToken(token)}
                      onContextMenu={e => { e.preventDefault(); copyToken(token); }}
                      title={desc}
                      className="px-2 py-1 bg-white border border-blue-300 text-blue-700 rounded text-xs font-mono hover:bg-blue-100 transition"
                    >
                      {copied === token ? '✓ Copied!' : token}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Message Body *</label>
                <textarea
                  value={form.body}
                  onChange={e => setForm(prev => ({ ...prev, body: e.target.value }))}
                  rows={8}
                  placeholder={'Dear {{tenant_name}},\n\nThis is a reminder that your rent of {{amount}} is due. Please make payment by the {{due_date}}.\n\nThank you,\n{{landlord_name}}'}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 font-mono"
                />
              </div>
            </div>
            <div className="p-6 border-t flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
              <button
                onClick={handleSave}
                disabled={saving || !form.name.trim() || !form.body.trim()}
                className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : editId ? 'Update' : 'Save Template'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Delete Template?</h3>
            <p className="text-sm text-gray-600 mb-6">This template will be permanently removed.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmDelete(null)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
              <button onClick={async () => { await deleteCommTemplate(confirmDelete); setConfirmDelete(null); }} className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
