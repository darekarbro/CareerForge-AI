import React, { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import AppShell from '../../components/AppShell/AppShell';
import ProtectedRoute from '../../components/ProtectedRoute/ProtectedRoute';
import useOwnedResource from '../../hooks/useOwnedResource';
import usePersistentDraft from '../../hooks/usePersistentDraft';
import api from '../../services/api';
import OpportunityPreferences from '../../components/OpportunityPreferences/OpportunityPreferences';
import JobImport from '../../components/JobImport/JobImport';
const empty = { company: '', title: '', description: '', jobUrl: '', notes: '', resumeId: '' };
export default function WorkspacesPage() {
  const [state, setState] = useState('active');
  const router = useRouter(), inventory = useOwnedResource('/workspaces/ranked?state=' + state), resumes = useOwnedResource('/resumes');
  const draft = usePersistentDraft('new-workspace', { userId: inventory.userId, revision: 0, value: empty });
  const [search, setSearch] = useState(''), [creating, setCreating] = useState(false), [error, setError] = useState('');
  const [duplicate, setDuplicate] = useState(null);
  const [sort, setSort] = useState('recommended');
  const formRef = useRef(null);
  function openForm() { if (formRef.current) { formRef.current.open = true; formRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }
  const items = [...(inventory.data?.items || [])].filter(({ workspace }) => (workspace.title + ' ' + workspace.company).toLowerCase().includes(search.toLowerCase()));
  if (sort === 'recent') items.sort((a, b) => new Date(b.workspace.updatedAt) - new Date(a.workspace.updatedAt));
  const create = async (event) => {
    event.preventDefault(); setCreating(true); setError(''); setDuplicate(null);
    try { const response = await api.post('/workspaces', draft.value); draft.discard(); router.push('/workspaces/' + response.data.data._id); }
    catch (failure) { setError(failure.response?.data?.message || 'Unable to save this job. Your draft is kept.'); if (failure.response?.data?.code === 'DUPLICATE_WORKSPACE') setDuplicate(failure.response.data.details); }
    finally { setCreating(false); }
  };
  return <ProtectedRoute><AppShell><div className="max-w-5xl mx-auto space-y-5"><h1 className="text-3xl font-bold">Job workspaces</h1><p className="text-sm">Save a job once. Keep its tailored resumes, match report, practice sessions and application together.</p>
    {inventory.data?.preferences && <OpportunityPreferences key={inventory.userId + ':' + inventory.data.preferences.revision} preferences={inventory.data.preferences} onSaved={() => inventory.reload()} />}
    <JobImport key={inventory.userId} onPreview={(fields) => { draft.change({ ...draft.value, ...fields }); openForm(); }} onManual={(fields) => { if (fields?.jobUrl) draft.change({ ...draft.value, jobUrl: fields.jobUrl }); openForm(); }} />
    <details ref={formRef} className="brutal-card p-5" open={!inventory.loading && !inventory.data?.items.length}><summary className="font-semibold cursor-pointer">Save a new job</summary>
      {draft.ready && <form onSubmit={create} className="grid sm:grid-cols-2 gap-4 mt-4">
        {['company', 'title', 'jobUrl'].map((key) => <label key={key} className="font-semibold text-sm">{key === 'title' ? 'Role title' : key === 'jobUrl' ? 'Job link (optional)' : 'Company'}<input required={key !== 'jobUrl'} value={draft.value[key]} maxLength={key === 'jobUrl' ? 2048 : 150} className="brutal-input block w-full mt-1" onChange={(event) => draft.change({ ...draft.value, [key]: event.target.value })} /></label>)}
        <label className="font-semibold text-sm">Resume<select value={draft.value.resumeId} onChange={(event) => draft.change({ ...draft.value, resumeId: event.target.value })} className="brutal-input block w-full mt-1"><option value="">Choose later</option>{(resumes.data || []).filter((item) => item.processingStatus === 'COMPLETED').map((item) => <option key={item._id} value={item._id}>{item.title}</option>)}</select></label>
        <label className="font-semibold text-sm sm:col-span-2">Job description<textarea required rows={6} maxLength={24000} value={draft.value.description} className="brutal-input block w-full mt-1" onChange={(event) => draft.change({ ...draft.value, description: event.target.value })} /></label>
        {error && <p role="alert" className="sm:col-span-2">{error} {duplicate && <Link className="underline font-bold" href={'/workspaces/' + duplicate.workspaceId}>{duplicate.archived ? 'Open archived workspace to restore it' : 'Open existing workspace'}</Link>}</p>}<button disabled={creating} className="brutal-btn-primary px-4 py-3 text-sm">{creating ? 'Saving…' : 'Create job workspace'}</button>
      </form>}
    </details>
    <label className="block text-sm font-semibold">Search jobs<input value={search} onChange={(event) => setSearch(event.target.value)} className="brutal-input block mt-1 w-full" /></label>
    <label className="block text-sm font-semibold">Workspace view<select className="brutal-input block mt-1" value={state} onChange={(event) => setState(event.target.value)}><option value="active">Active jobs</option><option value="archived">Archived jobs</option><option value="all">All jobs</option></select></label>
    <label className="text-sm font-semibold block">Job order<select className="brutal-input block mt-1" value={sort} onChange={(event) => setSort(event.target.value)}><option value="recommended">Recommended first</option><option value="recent">Recently updated</option></select></label>
    {inventory.loading ? <p role="status">Loading saved jobs…</p> : inventory.error ? <p role="alert">{inventory.error} <button className="underline" onClick={() => inventory.reload()}>Retry</button></p> : !items.length ? <p>No saved jobs match this view.</p> : <ul className="space-y-3">{items.map(({ workspace: item, ...ranking }) => <li key={item._id} className="brutal-card p-5"><Link className="font-bold text-blue-700 underline" href={'/workspaces/' + item._id}>{item.title} at {item.company}</Link><p className="text-sm mt-1">Updated {new Date(item.updatedAt).toLocaleDateString()} · Priority {ranking.score === null ? 'needs review' : ranking.score + '/100'}{ranking.deprioritized ? ' · Deprioritized company' : ''}</p><details className="text-sm mt-3"><summary className="cursor-pointer font-semibold">Why this recommendation?</summary><p className="mt-2">{ranking.method}</p><ul className="list-disc pl-5 my-2">{ranking.reasons.map((reason) => <li key={reason.label}>{reason.label} ({reason.points}/{reason.possible} points)</li>)}{ranking.concerns.map((concern) => <li key={concern}>{concern}</li>)}</ul>{ranking.evidence.map((row) => <div key={row.skill} className="border-t py-2"><strong>{row.skill}</strong>{row.citations.map((citation, index) => <p key={index}>{citation.quote} {citation.evidenceId ? <Link href={'/evidence?search=' + encodeURIComponent(citation.title)} className="underline">Career evidence</Link> : citation.resumeId && <Link href={'/resume/' + citation.resumeId + '/edit'} className="underline">Selected resume</Link>}</p>)}</div>)}</details></li>)}</ul>}
  </div></AppShell></ProtectedRoute>;
}
