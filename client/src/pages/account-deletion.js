import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '../services/api';
export default function AccountDeletion() {
  const [receipt, setReceipt] = useState(''), [status, setStatus] = useState(null), [error, setError] = useState('');
  useEffect(() => { setReceipt(new URLSearchParams(window.location.hash.slice(1)).get('receipt') || ''); }, []);
  async function check(event) { event.preventDefault(); setError(''); try { setStatus((await api.post('/privacy/deletion-status', { receipt })).data.data); } catch (err) { setError(err.response?.data?.message || 'Unable to check deletion.'); } }
  return <main className="min-h-screen p-6 flex items-center justify-center"><div className="brutal-card p-8 max-w-xl w-full space-y-5"><h1 className="text-2xl font-black">Account deletion status</h1><p>Your private receipt lets you check completion without signing in. Save it somewhere safe. Processing continues if you close this page.</p><form onSubmit={check} className="space-y-4"><label className="block">Deletion receipt<input required value={receipt} onChange={(e) => setReceipt(e.target.value)} className="brutal-input w-full font-mono text-sm" /></label><button className="brutal-btn-primary p-3">Check deletion status</button></form>{error && <p role="alert">{error}</p>}{status && <p role="status">Status: {status.status}{status.completedAt && ' · Completed ' + new Date(status.completedAt).toLocaleString()}</p>}<Link className="block underline" href="/">Back to CareerForge</Link></div></main>;
}
