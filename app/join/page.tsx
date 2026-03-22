'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';
import { useAuth } from '../components/AuthProvider';

function JoinPageContent() {
  const params = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const token = params.get('token');
  const [status, setStatus] = useState<'loading' | 'found' | 'invalid' | 'accepted' | 'error'>('loading');
  const [memberInfo, setMemberInfo] = useState<{ email: string; role: string; name: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!token || !supabase) { setStatus('invalid'); return; }
    supabase.from('team_members').select('email, role, name, status').eq('invite_token', token).single()
      .then(({ data, error }) => {
        if (error || !data) { setStatus('invalid'); return; }
        if (data.status === 'Active') { setStatus('accepted'); return; }
        if (data.status === 'Revoked') { setStatus('invalid'); return; }
        setMemberInfo({ email: data.email, role: data.role, name: data.name });
        setStatus('found');
      });
  }, [token]);

  const handleAccept = async () => {
    if (!user || !supabase || !token) return;
    try {
      const { error } = await supabase.from('team_members')
        .update({ user_id: user.id, status: 'Active' })
        .eq('invite_token', token);
      if (error) throw error;
      setStatus('accepted');
      setTimeout(() => router.push('/'), 2000);
    } catch (e: any) {
      setErrorMsg(e.message);
      setStatus('error');
    }
  };

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3"></div>
          <p className="text-gray-500 text-sm">Verifying invite...</p>
        </div>
      </div>
    );
  }

  if (status === 'invalid') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 max-w-md w-full text-center">
          <div className="text-5xl mb-4">❌</div>
          <h1 className="text-xl font-bold text-gray-800 mb-2">Invalid Invite Link</h1>
          <p className="text-sm text-gray-500 mb-6">This invite link is invalid, expired, or has already been used.</p>
          <a href="/" className="bg-blue-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 inline-block">Go to Dashboard</a>
        </div>
      </div>
    );
  }

  if (status === 'accepted') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 max-w-md w-full text-center">
          <div className="text-5xl mb-4">✅</div>
          <h1 className="text-xl font-bold text-gray-800 mb-2">You&apos;re in!</h1>
          <p className="text-sm text-gray-500 mb-6">You have successfully joined the team. Redirecting to dashboard...</p>
          <a href="/" className="bg-blue-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 inline-block">Go to Dashboard</a>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 max-w-md w-full text-center">
          <div className="text-5xl mb-4">⚠️</div>
          <h1 className="text-xl font-bold text-gray-800 mb-2">Something went wrong</h1>
          <p className="text-sm text-red-500 mb-6">{errorMsg}</p>
          <a href="/" className="bg-blue-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 inline-block">Go to Dashboard</a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 max-w-md w-full">
        <div className="text-center mb-6">
          <div className="text-5xl mb-3">🎉</div>
          <h1 className="text-xl font-bold text-gray-800">You&apos;ve been invited!</h1>
          <p className="text-sm text-gray-500 mt-1">You have been invited to join a RentFlow account</p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-600">Email</span>
            <span className="font-medium text-gray-800">{memberInfo?.email}</span>
          </div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-600">Role</span>
            <span className="font-medium text-blue-700">{memberInfo?.role}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Name</span>
            <span className="font-medium text-gray-800">{memberInfo?.name}</span>
          </div>
        </div>

        {!user ? (
          <div>
            <p className="text-sm text-gray-600 mb-4 text-center">Please sign in or create an account to accept this invite.</p>
            <a
              href={`/login?redirect=/join?token=${token}`}
              className="w-full block bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors text-center"
            >
              Sign In to Accept
            </a>
          </div>
        ) : (
          <div>
            <p className="text-sm text-gray-600 mb-4 text-center">
              Signed in as <strong>{user.email}</strong>. Accept this invite to join the team.
            </p>
            <button
              onClick={handleAccept}
              className="w-full bg-green-600 text-white py-3 rounded-lg font-medium hover:bg-green-700 transition-colors"
            >
              Accept Invite
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function JoinPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div></div>}>
      <JoinPageContent />
    </Suspense>
  );
}
