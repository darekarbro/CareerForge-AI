import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import AppShell from '../components/AppShell/AppShell';
import ProtectedRoute from '../components/ProtectedRoute/ProtectedRoute';
import useOwnedResource from '../hooks/useOwnedResource';
import api from '../services/api';
export default function OnboardingPage() {
  const profile = useOwnedResource('/profile'), router = useRouter();
  const [role, setRole] = useState(''), [level, setLevel] = useState('early'), [error, setError] = useState(''), [saving, setSaving] = useState(false);
  useEffect(() => { if (profile.data) { setRole(profile.data.targetRole); setLevel(profile.data.experienceLevel); } }, [profile.data]);
  const save = async (event) => {
    event.preventDefault(); setSaving(true); setError('');
    try { await api.put('/profile', { revision: profile.data.revision, content: profile.data.content, targetRole: role, experienceLevel: level, onboardingCompleted: true }); router.push('/profile'); }
    catch (failure) { setError(failure.response?.data?.message || 'Unable to save your preferences. Please retry.'); }
    finally { setSaving(false); }
  };
  return <ProtectedRoute><AppShell><div className="max-w-3xl mx-auto space-y-6"><h1 className="text-3xl font-bold">Let’s build your next resume</h1><p>Start with your goal, then verify your experience and choose a target job.</p>
    <ol className="space-y-3 text-sm"><li>1. Set your target role and experience level.</li><li>2. Upload your resume or enter your career facts.</li><li>3. Save a job, review the tailored changes and export.</li></ol>
    {profile.loading ? <p role="status">Loading your preferences…</p> : profile.error ? <p role="alert">{profile.error}</p> : <form onSubmit={save} className="brutal-card p-6 space-y-5"><label className="block font-semibold text-sm">Target role<input required maxLength={120} className="brutal-input block w-full mt-1" value={role} onChange={(event) => setRole(event.target.value)} /></label><label className="block font-semibold text-sm">Experience level<select className="brutal-input block w-full mt-1" value={level} onChange={(event) => setLevel(event.target.value)}><option value="student">Student / graduate</option><option value="early">Early career</option><option value="mid">Experienced professional</option><option value="senior">Senior / leadership</option></select></label>{error && <p role="alert">{error}</p>}<button disabled={saving} className="brutal-btn-primary px-4 py-3 text-sm">{saving ? 'Saving…' : 'Save goal and build my profile'}</button></form>}
    <div className="flex gap-5 text-sm"><Link href="/resume/upload" className="underline">I already have a resume to upload</Link><Link href="/dashboard" className="underline">Continue later</Link></div>
  </div></AppShell></ProtectedRoute>;
}
