import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import ProtectedRoute from '../../components/ProtectedRoute/ProtectedRoute';
import AppShell from '../../components/AppShell/AppShell';
import useOwnedResource from '../../hooks/useOwnedResource';
import usePersistentDraft from '../../hooks/usePersistentDraft';
import { submitProcessingRequest } from '../../services/processing';
const empty = { resumeId: '', targetRole: 'Fullstack Developer', workspaceId: '', jobDescriptionId: '', count: 5, difficulty: 'Medium', timeLimitSeconds: 0, feedbackMode: 'instant', topicFocus: '' };
export default function InterviewSetupPage() {
  const router = useRouter(), resumes = useOwnedResource('/resumes'), workspaces = useOwnedResource('/workspaces'), descriptions = useOwnedResource('/interview/descriptions');
  const draft = usePersistentDraft('interview-setup', { userId: resumes.userId, revision: 0, value: empty });
  const [starting, setStarting] = useState(false), [error, setError] = useState('');
  const list = (resumes.data || []).filter((item) => item.processingStatus === 'COMPLETED');
  useEffect(() => {
    if (!draft.ready || !router.query.workspace || !workspaces.data) return;
    const item = workspaces.data.find((entry) => entry._id === router.query.workspace);
    if (item && draft.value.workspaceId !== item._id) draft.change({ ...draft.value, workspaceId: item._id, resumeId: item.resumeId || '', targetRole: item.title, jobDescriptionId: item.jobDescriptionId || '' });
  }, [draft, router.query.workspace, workspaces.data]);
  const field = (key, value) => draft.change({ ...draft.value, [key]: value });
  const chooseWorkspace = (id) => {
    const item = workspaces.data?.find((entry) => entry._id === id);
    draft.change({ ...draft.value, workspaceId: id, ...(item ? { resumeId: item.resumeId || '', targetRole: item.title, jobDescriptionId: item.jobDescriptionId || '' } : {}) });
  };
  const start = async (event) => {
    event.preventDefault(); if (starting) return;
    setStarting(true); setError('');
    const { workspaceId, ...input } = draft.value;
    try {
      const response = await submitProcessingRequest(workspaceId ? '/workspaces/' + workspaceId + '/interview' : '/interview/sessions', input);
      draft.discard(); router.push('/interview/session/' + response.data.data.session._id);
    } catch (failure) { setError(failure.response?.data?.message || failure.message || 'Unable to start this interview'); setStarting(false); }
  };
  return <ProtectedRoute><AppShell><div className="space-y-6 max-w-3xl mx-auto"><h1 className="text-3xl font-bold">Interview practice</h1><p className="text-sm">Choose a saved job or practise for a role. Your setup is kept while you navigate.</p>
    {resumes.loading ? <p role="status">Loading resumes…</p> : resumes.error ? <p role="alert">{resumes.error}</p> : !list.length ? <p className="brutal-card p-6">Add a resume to personalise your questions. <Link href="/profile" className="underline">Build your profile</Link> or <Link href="/resume/upload" className="underline">upload a resume</Link>.</p> : draft.ready && <form onSubmit={start} className="brutal-card p-6 grid sm:grid-cols-2 gap-5">
      {error && <p role="alert" className="sm:col-span-2">{error}</p>}
      <label className="text-sm font-semibold sm:col-span-2">Saved job workspace<select className="brutal-input block w-full mt-1" value={draft.value.workspaceId} onChange={(event) => chooseWorkspace(event.target.value)}><option value="">Practise without a workspace</option>{(workspaces.data || []).map((item) => <option key={item._id} value={item._id}>{item.title} at {item.company}</option>)}</select></label>
      <label className="text-sm font-semibold">Target role<input required disabled={Boolean(draft.value.workspaceId)} maxLength={120} value={draft.value.targetRole} onChange={(event) => field('targetRole', event.target.value)} className="brutal-input block w-full mt-1" /></label>
      <label className="text-sm font-semibold">Resume<select required disabled={Boolean(draft.value.workspaceId)} className="brutal-input block w-full mt-1" value={draft.value.resumeId} onChange={(event) => field('resumeId', event.target.value)}><option value="">Choose a resume</option>{list.map((item) => <option key={item._id} value={item._id}>{item.title}</option>)}</select></label>
      {!draft.value.workspaceId && <label className="text-sm font-semibold sm:col-span-2">Saved job description (optional)<select value={draft.value.jobDescriptionId} onChange={(event) => field('jobDescriptionId', event.target.value)} className="brutal-input block w-full mt-1"><option value="">General role practice</option>{(descriptions.data || []).map((item) => <option key={item._id} value={item._id}>{item.title}</option>)}</select></label>}
      <label className="text-sm font-semibold">Difficulty<select className="brutal-input block w-full mt-1" value={draft.value.difficulty} onChange={(event) => field('difficulty', event.target.value)}>{['Easy', 'Medium', 'Hard'].map((item) => <option key={item}>{item}</option>)}</select></label>
      <label className="text-sm font-semibold">Questions<select className="brutal-input block w-full mt-1" value={draft.value.count} onChange={(event) => field('count', Number(event.target.value))}>{[3, 5, 8, 10].map((item) => <option key={item} value={item}>{item} questions</option>)}</select></label>
      <label className="text-sm font-semibold">Practice timer per question<select className="brutal-input block w-full mt-1" value={draft.value.timeLimitSeconds} onChange={(event) => field('timeLimitSeconds', Number(event.target.value))}>{[0, 60, 120, 180, 300].map((item) => <option key={item} value={item}>{item ? item / 60 + ' minutes' : 'Untimed'}</option>)}</select></label>
      <label className="text-sm font-semibold">Feedback<select className="brutal-input block w-full mt-1" value={draft.value.feedbackMode} onChange={(event) => field('feedbackMode', event.target.value)}><option value="instant">After each answer</option><option value="end">After completing the session</option></select></label>
      <label className="text-sm font-semibold sm:col-span-2">Focus topic (optional)<input maxLength={150} className="brutal-input block w-full mt-1" value={draft.value.topicFocus} onChange={(event) => field('topicFocus', event.target.value)} placeholder="e.g. API design, debugging or leadership" /></label>
      <p className="text-sm sm:col-span-2">The practice timer keeps running when you switch questions or refresh. It reminds you when time is up; you choose when to submit.</p>
      <button disabled={starting || !draft.value.resumeId} className="brutal-btn-primary sm:col-span-2 px-4 py-3 text-sm disabled:opacity-40">{starting ? 'Preparing questions… You can return through Activity.' : 'Start practice'}</button>
    </form>}
  </div></AppShell></ProtectedRoute>;
}
