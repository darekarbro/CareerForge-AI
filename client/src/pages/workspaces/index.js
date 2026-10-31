import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import AppShell from '../../components/AppShell/AppShell';
import ProtectedRoute from '../../components/ProtectedRoute/ProtectedRoute';
import useOwnedResource from '../../hooks/useOwnedResource';
import usePersistentDraft from '../../hooks/usePersistentDraft';
import api from '../../services/api';
const empty = { company: '', title: '', description: '', jobUrl: '', notes: '', resumeId: '' };
export default function WorkspacesPage() {
  const [state, setState] = useState('active');
  const router = useRouter(), inventory = useOwnedResource(state === 'active' ? '/workspaces' : '/workspaces?state=' + state), resumes = useOwnedResource('/resumes');
  const draft = usePersistentDraft('new-workspace', { userId: inventory.userId, revision: 0, value: empty });
  const [search, setSearch] = useState(''), [creating, setCreating] = useState(false), [error, setError] = useState('');
  const [duplicate, setDuplicate] = useState(null);
  const create = async (event) => {
    event.preventDefault(); setCreating(true); setError(''); setDuplicate(null);
    try { const response = await api.post('/workspaces', draft.value); draft.discard(); router.push('/workspaces/' + response.data.data._id); }
    catch (failure) { setError(failure.response?.data?.message || 'Unable to save this job. Your draft is kept.'); if (failure.response?.data?.code === 'DUPLICATE_WORKSPACE') setDuplicate(failure.response.data.details); }
    finally { setCreating(false); }
  };
  return <ProtectedRoute><AppShell><div className="max-w-5xl mx-auto space-y-5"><h1 className="text-3xl font-bold">Job workspaces</h1><p className="text-sm">Save a job once. Keep its tailored resumes, match report, practice sessions and application together.</p>
    <details className="brutal-card p-5" open={!inventory.loading && !inventory.data?.length}><summary className="font-semibold cursor-pointer">Save a new job</summary>
      {draft.ready && <form onSubmit={create} className="grid sm:grid-cols-2 gap-4 mt-4">
        {['company', 'title', 'jobUrl'].map((key) => <label key={key} className="font-semibold text-sm">{key === 'title' ? 'Role title' : key === 'jobUrl' ? 'Job link (optional)' : 'Company'}<input required={key !== 'jobUrl'} value={draft.value[key]} maxLength={key === 'jobUrl' ? 2048 : 150} className="brutal-input block w-full mt-1" onChange={(event) => draft.change({ ...draft.value, [key]: event.target.value })} /></label>)}
        <label className="font-semibold text-sm">Resume<select value={draft.value.resumeId} onChange={(event) => draft.change({ ...draft.value, resumeId: event.target.value })} className="brutal-input block w-full mt-1"><option value="">Choose later</option>{(resumes.data || []).filter((item) => item.processingStatus === 'COMPLETED').map((item) => <option key={item._id} value={item._id}>{item.title}</option>)}</select></label>
        <label className="font-semibold text-sm sm:col-span-2">Job description<textarea required rows={6} maxLength={24000} value={draft.value.description} className="brutal-input block w-full mt-1" onChange={(event) => draft.change({ ...draft.value, description: event.target.value })} /></label>
        {error && <p role="alert" className="sm:col-span-2">{error} {duplicate && <Link className="underline font-bold" href={'/workspaces/' + duplicate.workspaceId}>{duplicate.archived ? 'Open archived workspace to restore it' : 'Open existing workspace'}</Link>}</p>}<button disabled={creating} className="brutal-btn-primary px-4 py-3 text-sm">{creating ? 'Saving…' : 'Create job workspace'}</button>
      </form>}
    </details>
    <label className="block text-sm font-semibold">Search jobs<input value={search} onChange={(event) => setSearch(event.target.value)} className="brutal-input block mt-1 w-full" /></label>
    <label className="block text-sm font-semibold">Workspace view<select className="brutal-input block mt-1" value={state} onChange={(event) => setState(event.target.value)}><option value="active">Active jobs</option><option value="archived">Archived jobs</option><option value="all">All jobs</option></select></label>
    {inventory.loading ? <p role="status">Loading saved jobs…</p> : inventory.error ? <p role="alert">{inventory.error} <button className="underline" onClick={() => inventory.reload()}>Retry</button></p> : <ul className="space-y-3">{(inventory.data || []).filter((item) => (item.title + ' ' + item.company).toLowerCase().includes(search.toLowerCase())).map((item) => <li key={item._id} className="brutal-card p-5"><Link className="font-bold text-blue-700 underline" href={'/workspaces/' + item._id}>{item.title} at {item.company}</Link><p className="text-sm mt-1">Updated {new Date(item.updatedAt).toLocaleDateString()}</p></li>)}</ul>}
  </div></AppShell></ProtectedRoute>;
}
