import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import ProtectedRoute from '../components/ProtectedRoute/ProtectedRoute';
import AppShell from '../components/AppShell/AppShell';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
import { googleProof } from '../services/reauthenticate';

function AccountContent() {
  const router = useRouter(), { user, logout } = useAuthStore();
  const [privacy, setPrivacy] = useState(null), [sessions, setSessions] = useState([]), [password, setPassword] = useState(''), [nextPassword, setNextPassword] = useState('');
  const [confirmation, setConfirmation] = useState(''), [originals, setOriginals] = useState(true), [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    Promise.all([api.get('/privacy'), api.get('/auth/sessions')]).then(([p, s]) => { if (live) { setPrivacy(p.data.data); setSessions(s.data.data); } }).catch((err) => { if (live) setError(err.response?.data?.message || 'Unable to load account settings.'); });
    return () => { live = false; };
  }, []);
  async function action(work) { setBusy(true); setError(''); setMessage(''); try { await work(); } catch (err) {
    let data = err.response?.data;
    if (data instanceof Blob) { try { data = JSON.parse(await data.text()); } catch { /* Use the request error below. */ } }
    setError(data?.message || err.message || 'Please try again.');
  } finally { setBusy(false); } }
  const proof = () => user.authProvider === 'local' ? Promise.resolve({ password }) : googleProof();
  async function exportAccount() {
    const accountToken = useAuthStore.getState().token;
    const response = await api.post('/privacy/export', { ...await proof(), includeOriginals: originals }, { responseType: 'blob' });
    if (accountToken !== useAuthStore.getState().token) return;
    const url = URL.createObjectURL(response.data), anchor = document.createElement('a'); anchor.href = url; anchor.download = 'careerforge-account.zip'; anchor.click(); URL.revokeObjectURL(url); setPassword(''); setMessage('Your account archive has been downloaded.');
  }
  async function deleteAccount() {
    const accountToken = useAuthStore.getState().token;
    const response = await api.post('/privacy/delete', { ...await proof(), confirmation });
    if (accountToken !== useAuthStore.getState().token) return;
    const receipt = response.data.data.receipt; logout(false);
    await router.push('/account-deletion#receipt=' + receipt);
  }
  return <ProtectedRoute><AppShell><div className="max-w-3xl mx-auto space-y-6">
    <h1 className="text-3xl font-black">Account & privacy</h1>
    {message && <p role="status" className="border-2 p-4 bg-green-100 text-black">{message}</p>}{error && <p role="alert" className="border-2 p-4 bg-red-100 text-red-900">{error}</p>}
    <section className="brutal-card p-6 space-y-4"><h2 className="font-black text-xl">Email verification</h2><p>{user?.email} — {user?.emailVerifiedAt ? 'Verified' : 'Verification required'}</p>
      {!user?.emailVerifiedAt && <><p>Check your inbox and spam folder. Links last 24 hours; a new email can be requested once a minute.</p><button disabled={busy} className="brutal-btn-primary p-3" onClick={() => action(async () => { const res = await api.post('/auth/resend-verification'); setMessage(res.data.data.message); })}>Resend verification email</button></>}
    </section>
    <section className="brutal-card p-6 space-y-4"><h2 className="font-black text-xl">AI data sharing</h2>
      <p>External AI is off until you choose providers below. Enabled providers may receive your resume text and structured content, job descriptions, interview questions and answers needed for a request. Groq can receive the full resume within its input limit. Providers are tried in order: Groq, OpenRouter, Gemini. Offline tools remain available.</p>
      <p className="text-sm">Turning sharing off prevents new calls to that provider and clears cached assessments. A request already sent may finish. Provider retention follows its own terms; account deletion removes data stored by CareerForge.</p>
      {privacy ? <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); action(async () => { const res = await api.put('/privacy', privacy); setPrivacy(res.data.data); setMessage('Privacy preferences saved.'); }); }}>
        <fieldset className="space-y-3"><legend className="font-bold mb-2">Allow data to be sent to</legend>{['groq', 'openrouter', 'gemini'].map((name) => <label key={name} className="block"><input type="checkbox" checked={privacy.providers[name]} onChange={(e) => setPrivacy({ ...privacy, providers: { ...privacy.providers, [name]: e.target.checked } })} /> {name === 'groq' ? 'Groq' : name === 'openrouter' ? 'OpenRouter' : 'Gemini'}</label>)}</fieldset>
        <h3 className="font-black">Retention</h3><p>Saved profiles, resumes, applications and interview results stay until you delete them. These limits apply to supporting activity and temporary data. Shorter periods remove eligible data when saved; scheduled cleanup runs every 15 minutes.</p>
        {[['activityDays', 'Activity, notifications and processing logs', [30, 90, 365], 'days'], ['cacheDays', 'Cached assessments', [1, 7, 30], 'days'], ['retryInputHours', 'Encrypted retry inputs', [1, 6, 24], 'hours']].map(([key, label, values, unit]) => <label key={key} className="block">{label}<select className="brutal-input block w-full mt-1" value={privacy[key]} onChange={(e) => setPrivacy({ ...privacy, [key]: Number(e.target.value) })}>{values.map((value) => <option key={value} value={value}>{value} {unit}</option>)}</select></label>)}
        <button disabled={busy} className="brutal-btn-primary p-3">Save privacy preferences</button>
      </form> : <p>Loading privacy preferences…</p>}
    </section>
    <section className="brutal-card p-6 space-y-4"><h2 className="font-black text-xl">Active sessions</h2><ul className="space-y-2">{sessions.map((session) => <li key={session.id} className="border-b pb-2">{session.device}{session.current ? ' (this device)' : ''}<span className="block text-sm">Signed in {new Date(session.createdAt).toLocaleString()} · Expires {new Date(session.expiresAt).toLocaleString()}</span></li>)}</ul>
      <button disabled={busy} className="brutal-btn-secondary p-3" onClick={() => action(async () => { const initial = useAuthStore.getState().token; await api.post('/auth/logout-all'); if (initial !== useAuthStore.getState().token) return; logout(false); router.push('/login'); })}>Sign out all devices</button>
    </section>
    <section className="brutal-card p-6 space-y-4"><h2 className="font-black text-xl">Confirm your identity</h2><p>{user?.authProvider === 'local' ? 'Enter your current password before changing it, exporting your data or deleting your account.' : 'Google will ask you to sign in again before export or deletion.'}</p>
      {user?.authProvider === 'local' && <><label className="block">Current password<input type="password" autoComplete="current-password" className="brutal-input w-full" value={password} onChange={(e) => setPassword(e.target.value)} /></label><form className="space-y-3" onSubmit={(e) => { e.preventDefault(); action(async () => { const initial = useAuthStore.getState().token; await api.put('/auth/password', { currentPassword: password, newPassword: nextPassword }); if (initial !== useAuthStore.getState().token) return; logout(false); router.push('/login'); }); }}>
        <label className="block">New password<input type="password" autoComplete="new-password" minLength={8} maxLength={72} required className="brutal-input w-full" value={nextPassword} onChange={(e) => setNextPassword(e.target.value)} /></label><button disabled={busy || !password} className="brutal-btn-secondary p-3">Change password and sign out</button></form></>}
    </section>
    <section className="brutal-card p-6 space-y-4"><h2 className="font-black text-xl">Export account data</h2><p>Download your saved records as JSON in a ZIP archive, with optional original resume files (up to 50 MB). Passwords, reset tokens and encrypted retry contents are excluded.</p><label className="block"><input type="checkbox" checked={originals} onChange={(e) => setOriginals(e.target.checked)} /> Include original resume files</label><button disabled={busy || (user?.authProvider === 'local' && !password)} className="brutal-btn-primary p-3" onClick={() => action(exportAccount)}>Download account archive</button></section>
    <section className="brutal-card p-6 space-y-4 border-red-800"><h2 className="font-black text-xl">Delete account permanently</h2><p>This disables access immediately and deletes your profile, resumes, originals, interviews, applications, notifications and processing data in the background. Active requests drain before cleanup. Failed file deletions are retried. Keep the private receipt to check completion; it expires seven days after deletion completes.</p><label className="block">Type DELETE to confirm<input autoComplete="off" className="brutal-input w-full" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} /></label><button disabled={busy || confirmation !== 'DELETE' || (user?.authProvider === 'local' && !password)} className="border-2 border-red-900 bg-red-100 text-red-900 font-bold p-3 disabled:opacity-50" onClick={() => action(deleteAccount)}>Delete my account</button></section>
  </div></AppShell></ProtectedRoute>;
}
export default function AccountPage() {
  const account = useAuthStore((state) => state.user?.id);
  return <AccountContent key={account || 'signed-out'} />;
}
