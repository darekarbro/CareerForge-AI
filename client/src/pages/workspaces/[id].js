import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import AppShell from '../../components/AppShell/AppShell';
import ProtectedRoute from '../../components/ProtectedRoute/ProtectedRoute';
import DraftToolbar from '../../components/DraftToolbar/DraftToolbar';
import useOwnedResource from '../../hooks/useOwnedResource';
import usePersistentDraft from '../../hooks/usePersistentDraft';
import useDraftSync from '../../hooks/useDraftSync';
import { submitProcessingRequest } from '../../services/processing';
const decode = (record) => { const item = record.workspace || record; return { revision: item.revision, value: Object.fromEntries(['company', 'title', 'jobUrl', 'description', 'notes', 'resumeId'].map((key) => [key, item[key] || ''])) }; };
export default function WorkspacePage() {
  const router = useRouter(), id = router.query.id, resource = useOwnedResource(id ? '/workspaces/' + id : null), resumes = useOwnedResource('/resumes');
  const [server, setServer] = useState(null), [working, setWorking] = useState('');
  const draft = usePersistentDraft('workspace:' + id, server), sync = useDraftSync(draft, '/workspaces/' + id, decode, setServer);
  useEffect(() => { setServer(resource.data ? { ...decode(resource.data), userId: resource.userId } : null); }, [resource.data, resource.userId]);
  const action = async (name) => {
    if (!await sync.save()) return;
    setWorking(name); sync.setError('');
    try {
      const response = await submitProcessingRequest('/workspaces/' + id + '/' + name, {});
      if (!sync.current()) return;
      if (name === 'tailor') router.push('/resume/' + response.data.data.tailoredResume.resumeId + '/tailor?version=' + response.data.data.tailoredResume._id);
      else if (name === 'interview') router.push('/interview/session/' + response.data.data.session._id);
      else await resource.reload();
    } catch (failure) { if (sync.current()) sync.setError(failure.response?.data?.message || failure.message || 'Unable to complete this action'); }
    finally { if (sync.current()) setWorking(''); }
  };
  const data = resource.data;
  return <ProtectedRoute><AppShell><div className="max-w-5xl mx-auto space-y-5"><Link href="/workspaces" className="text-blue-700 underline text-sm">All jobs</Link><h1 className="text-3xl font-bold">{data?.workspace.title || 'Job workspace'}</h1>
    {!draft.ready ? <p role={resource.error ? 'alert' : 'status'}>{resource.error || 'Loading your job workspace…'}</p> : <>
      <DraftToolbar draft={draft} saving={sync.saving} error={sync.error} onSave={sync.save} onReload={sync.reload} />
      <div className="brutal-card p-5 grid sm:grid-cols-2 gap-4">{['company', 'title', 'jobUrl'].map((key) => <label key={key} className="font-semibold text-sm">{key === 'title' ? 'Role title' : key === 'jobUrl' ? 'Job link' : 'Company'}<input className="brutal-input w-full block mt-1" value={draft.value[key]} onChange={(event) => sync.change({ ...draft.value, [key]: event.target.value })} /></label>)}
        <label className="text-sm font-semibold">Resume<select className="brutal-input w-full block mt-1" value={draft.value.resumeId} onChange={(event) => sync.change({ ...draft.value, resumeId: event.target.value })}><option value="">Choose a resume</option>{(resumes.data || []).filter((item) => item.processingStatus === 'COMPLETED').map((item) => <option key={item._id} value={item._id}>{item.title}</option>)}</select></label>
        <label className="sm:col-span-2 text-sm font-semibold">Job description<textarea rows={7} maxLength={24000} className="brutal-input w-full block mt-1" value={draft.value.description} onChange={(event) => sync.change({ ...draft.value, description: event.target.value })} /></label>
        <label className="sm:col-span-2 text-sm font-semibold">Job notes<textarea rows={3} maxLength={10000} className="brutal-input w-full block mt-1" value={draft.value.notes} onChange={(event) => sync.change({ ...draft.value, notes: event.target.value })} /></label>
      </div>
      <div className="flex flex-wrap gap-3">{[['analyze', 'Check job match'], ['tailor', 'Tailor resume']].map(([name, label]) => <button key={name} disabled={!draft.value.resumeId || Boolean(working) || draft.conflict || sync.saving} onClick={() => action(name)} className="brutal-btn-primary px-4 py-3 text-sm disabled:opacity-40">{working === name ? 'Working… You can return through Activity.' : label}</button>)}
        <Link href={'/interview/setup?workspace=' + id} className="brutal-btn-primary px-4 py-3 text-sm">Practice for this job</Link>
        <Link href={'/applications?workspace=' + id} className="brutal-btn-yellow px-4 py-3 text-sm">Track application</Link>
      </div>
      {data?.gap && <section className="brutal-card p-5 space-y-3"><h2 className="text-xl font-bold">Job match: {data.gap.matchScore}%</h2><p className="text-sm">Estimated match to this saved job description, separate from resume quality.</p><ul className="text-sm space-y-2">{(data.gap.mustHaveMissing || []).map((item, index) => <li key={index}><strong>{item.skill}</strong>: {item.recommendation}</li>)}</ul></section>}
      <section className="brutal-card p-5"><h2 className="text-xl font-bold mb-3">Resume versions for this job</h2>{!data?.versions.length ? <p className="text-sm">Tailor your resume to create the first version.</p> : <ul className="space-y-2">{data.versions.map((version) => <li key={version._id}><Link href={'/resume/' + version.resumeId + '/tailor?version=' + version._id} className="underline text-blue-700 text-sm">Version {version.version} · {new Date(version.createdAt).toLocaleDateString()} · Review and export</Link></li>)}</ul>}</section>
      <section className="brutal-card p-5"><h2 className="text-xl font-bold mb-3">Interview practice</h2>{!data?.interviews.length ? <p className="text-sm">Start a practice session using this job description.</p> : <ul className="space-y-2">{data.interviews.map((item) => <li key={item._id}><Link href={'/interview/session/' + item._id} className="text-blue-700 underline text-sm">{new Date(item.createdAt).toLocaleDateString()} · {item.answeredCount}/{item.totalQuestions} answered</Link></li>)}</ul>}</section>
    </>}
  </div></AppShell></ProtectedRoute>;
}
