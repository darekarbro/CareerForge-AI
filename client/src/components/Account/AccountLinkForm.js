import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '../../services/api';
import { useAuthStore } from '../../store/authStore';

export default function AccountLinkForm({ mode }) {
  const [token, setToken] = useState(''), [email, setEmail] = useState(''), [password, setPassword] = useState(''), [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState(''), [done, setDone] = useState(false);
  const title = mode === 'forgot' ? 'Recover your account' : mode === 'reset' ? 'Choose a new password' : 'Verify your email';
  useEffect(() => { setToken(new URLSearchParams(window.location.hash.slice(1)).get('token') || ''); }, []);
  async function submit(event) {
    event.preventDefault(); setError(''); setBusy(true);
    try {
      if (mode === 'reset' && password !== confirm) throw new Error('The passwords do not match.');
      const endpoint = mode === 'forgot' ? '/auth/forgot-password' : mode === 'reset' ? '/auth/reset-password' : '/auth/verify-email';
      const response = await api.post(endpoint, mode === 'forgot' ? { email } : { token, password });
      if (mode !== 'forgot') { window.history.replaceState(null, '', window.location.pathname); setToken(''); }
      if (mode === 'verify' && useAuthStore.getState().token) {
        const me = await api.get('/auth/me'); useAuthStore.getState().updateUser(me.data.data);
      }
      if (mode === 'reset') useAuthStore.getState().logout(false);
      setDone(true); setMessage(mode === 'forgot' ? response.data.data.message : mode === 'reset' ? 'Password updated. All devices have been signed out.' : 'Email verified. You can now use AI features.');
    } catch (err) { setError(err.response?.data?.message || err.message); }
    finally { setBusy(false); }
  }
  return <main className="min-h-screen bg-[#f5f0e8] p-6 flex items-center justify-center"><div className="brutal-card p-8 w-full max-w-lg space-y-5">
    <Link href="/" className="font-black">CareerForge.AI</Link><h1 className="text-2xl font-black">{title}</h1>
    {message && <p role="status">{message}</p>}{error && <p role="alert" className="text-red-800">{error}</p>}
    {!done && <form onSubmit={submit} className="space-y-4">
      {mode === 'forgot' ? <><p>We will send a recovery link if a local account exists. Links expire in 30 minutes.</p><label className="block">Email address<input type="email" required autoComplete="email" className="brutal-input w-full" value={email} onChange={(e) => setEmail(e.target.value)} /></label></> : !token ? <p>Open the complete link from your email. Request a new link if it has expired.</p> : mode === 'reset' ? <>
        <label className="block">New password<input type="password" required minLength={8} maxLength={72} autoComplete="new-password" className="brutal-input w-full" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        <label className="block">Confirm new password<input type="password" required minLength={8} maxLength={72} autoComplete="new-password" className="brutal-input w-full" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></label><p className="text-sm">Use at least 8 characters, up to 72 UTF-8 bytes.</p></> : <p>Confirm that this email address belongs to you. Verification links expire after 24 hours.</p>}
      {(mode === 'forgot' || token) && <button disabled={busy} className="brutal-btn-primary px-5 py-3">{busy ? 'Please wait…' : mode === 'forgot' ? 'Send recovery link' : mode === 'reset' ? 'Reset password' : 'Verify email'}</button>}
    </form>}
    <div className="flex gap-5 flex-wrap"><Link href="/login" className="underline">Sign in</Link><Link href="/account" className="underline">Account settings</Link></div>
  </div></main>;
}
