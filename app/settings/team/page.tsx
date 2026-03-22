'use client';

import { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../components/AuthProvider';
import { supabase } from '../../lib/supabase';
import type { TeamMember, TeamRole } from '../../types';

const ROLES: TeamRole[] = ['Manager', 'Viewer'];

const ROLE_BADGE: Record<TeamRole, string> = {
  Owner: 'bg-purple-100 text-purple-700',
  Manager: 'bg-blue-100 text-blue-700',
  Viewer: 'bg-gray-100 text-gray-600',
};

const STATUS_BADGE: Record<string, string> = {
  Active: 'bg-green-100 text-green-700',
  Pending: 'bg-yellow-100 text-yellow-700',
  Revoked: 'bg-red-100 text-red-700',
};

function genToken(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(24)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export default function TeamPage() {
  const { landlord } = useApp();
  const { user } = useAuth();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState<TeamRole>('Manager');
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!supabase || !user) { setLoading(false); return; }
    supabase.from('team_members').select('*').eq('owner_id', user.id).order('created_at', { ascending: false })
      .then(({ data }) => { setMembers(data ?? []); setLoading(false); });
  }, [user]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !user || !supabase) return;
    setSaving(true);
    setError('');
    try {
      const token = genToken();
      const { data, error: err } = await supabase.from('team_members').insert({
        owner_id: user.id,
        user_id: null,
        email: inviteEmail.trim().toLowerCase(),
        name: inviteName.trim() || inviteEmail.split('@')[0],
        role: inviteRole,
        status: 'Pending',
        invite_token: token,
      }).select().single();
      if (err) throw new Error(err.message);
      setMembers(prev => [data, ...prev]);
      setInviteEmail(''); setInviteName(''); setInviteRole('Manager');
      setShowInvite(false);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const copyInviteLink = (token: string) => {
    const url = `${window.location.origin}/join?token=${token}`;
    navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const handleRoleChange = async (id: string, role: TeamRole) => {
    if (!supabase) return;
    await supabase.from('team_members').update({ role }).eq('id', id);
    setMembers(prev => prev.map(m => m.id === id ? { ...m, role } : m));
  };

  const handleRevoke = async (id: string) => {
    if (!supabase) return;
    await supabase.from('team_members').update({ status: 'Revoked' }).eq('id', id);
    setMembers(prev => prev.map(m => m.id === id ? { ...m, status: 'Revoked' } : m));
  };

  const handleRemove = async (id: string) => {
    if (!supabase) return;
    await supabase.from('team_members').delete().eq('id', id);
    setMembers(prev => prev.filter(m => m.id !== id));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Team Management</h1>
          <p className="text-sm text-gray-500 mt-1">Invite team members and manage their access roles</p>
        </div>
        <button
          onClick={() => setShowInvite(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2"
        >
          + Invite Member
        </button>
      </div>

      {/* Role guide */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 grid grid-cols-3 gap-4 text-sm">
        <div><span className="font-semibold text-blue-800">Owner</span><p className="text-blue-600 text-xs mt-0.5">Full access — add, edit, delete, manage team</p></div>
        <div><span className="font-semibold text-blue-800">Manager</span><p className="text-blue-600 text-xs mt-0.5">Can add & edit records, cannot delete or manage team</p></div>
        <div><span className="font-semibold text-blue-800">Viewer</span><p className="text-blue-600 text-xs mt-0.5">Read-only access across all modules</p></div>
      </div>

      {/* Owner row */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-4">
        <div className="px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 font-bold text-sm">
              {landlord.name?.charAt(0)?.toUpperCase() || 'O'}
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">{landlord.name || 'You (Owner)'}</p>
              <p className="text-xs text-gray-500">{user?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${ROLE_BADGE.Owner}`}>Owner</span>
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_BADGE.Active}`}>Active</span>
          </div>
        </div>
      </div>

      {/* Team members list */}
      {loading ? (
        <div className="text-center py-8 text-gray-400 text-sm">Loading team...</div>
      ) : members.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-dashed border-gray-300 p-10 text-center">
          <p className="text-gray-500 font-medium mb-1">No team members yet</p>
          <p className="text-sm text-gray-400">Invite managers or viewers to collaborate on this account</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
              <tr>
                <th className="px-5 py-3 text-left">Member</th>
                <th className="px-5 py-3 text-left">Role</th>
                <th className="px-5 py-3 text-left">Status</th>
                <th className="px-5 py-3 text-left">Invite Link</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {members.map(m => (
                <tr key={m.id}>
                  <td className="px-5 py-3">
                    <p className="font-medium text-gray-800">{m.name}</p>
                    <p className="text-xs text-gray-500">{m.email}</p>
                  </td>
                  <td className="px-5 py-3">
                    {m.status !== 'Revoked' ? (
                      <select
                        value={m.role}
                        onChange={e => handleRoleChange(m.id, e.target.value as TeamRole)}
                        className="border rounded px-2 py-1 text-xs focus:ring-1 focus:ring-blue-500"
                      >
                        {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    ) : (
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${ROLE_BADGE[m.role]}`}>{m.role}</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_BADGE[m.status]}`}>{m.status}</span>
                  </td>
                  <td className="px-5 py-3">
                    {m.status === 'Pending' && (
                      <button
                        onClick={() => copyInviteLink(m.invite_token)}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        {copiedToken === m.invite_token ? '✓ Copied!' : 'Copy link'}
                      </button>
                    )}
                    {m.status === 'Active' && <span className="text-xs text-gray-400">Joined</span>}
                    {m.status === 'Revoked' && <span className="text-xs text-gray-400">—</span>}
                  </td>
                  <td className="px-5 py-3 text-right flex items-center justify-end gap-2">
                    {m.status === 'Active' && (
                      <button onClick={() => handleRevoke(m.id)} className="text-xs text-yellow-600 hover:underline">Revoke</button>
                    )}
                    <button onClick={() => handleRemove(m.id)} className="text-xs text-red-600 hover:underline">Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Invite modal */}
      {showInvite && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-bold text-gray-800">Invite Team Member</h2>
              <button onClick={() => setShowInvite(false)} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
            </div>
            <form onSubmit={handleInvite} className="p-6 space-y-4">
              {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2 rounded-lg">{error}</div>}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Address *</label>
                <input type="email" required value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                  placeholder="colleague@example.com"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input type="text" value={inviteName} onChange={e => setInviteName(e.target.value)}
                  placeholder="Team member's name"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select value={inviteRole} onChange={e => setInviteRole(e.target.value as TeamRole)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500">
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  {inviteRole === 'Manager' ? 'Can add and edit records' : 'Read-only access'}
                </p>
              </div>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-800">
                An invite link will be generated. Share it with your team member — they will need to sign in or create an account.
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowInvite(false)}
                  className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50">
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                  {saving ? 'Creating...' : 'Generate Invite Link'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
