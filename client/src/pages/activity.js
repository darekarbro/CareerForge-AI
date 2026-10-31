import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import AppShell from '../components/AppShell/AppShell';
import ProtectedRoute from '../components/ProtectedRoute/ProtectedRoute';
import useOwnedResource from '../hooks/useOwnedResource';
import ProcessingTimeline from '../components/ProcessingTimeline/ProcessingTimeline';
import api from '../services/api';
import { watchProcessingJob } from '../services/processing';
const names = { resume_parse: 'Read resume', resume_tailor: 'Tailor resume', section_rewrite: 'Rewrite section', gap_analysis: 'Check job match', ats_score: 'Assess resume quality', question_generation: 'Prepare interview', answer_evaluation: 'Review answer' };
export function resultLink(job) {
  if (job.output?.tailoredResume) return '/resume/' + job.inputRef.resumeId + '/tailor?version=' + job.output.tailoredResume._id;
  if (job.jobType === 'section_rewrite') return '/resume/' + job.inputRef.resumeId + '/tailor?version=' + job.inputRef.versionId + '&suggestion=' + job._id;
  if (job.output?.session?._id || job.inputRef.sessionId) return '/interview/session/' + (job.output?.session?._id || job.inputRef.sessionId);
  if (job.inputRef.workspaceId) return '/workspaces/' + job.inputRef.workspaceId;
  return job.inputRef.resumeId ? '/resume/' + job.inputRef.resumeId : '/dashboard';
}
export default function ActivityPage() {
  const router = useRouter(), [status, setStatus] = useState('all'), inventory = useOwnedResource('/processing-jobs?status=' + status), usage = useOwnedResource('/processing-jobs/usage');
  const [selected, setSelected] = useState(null), [events, setEvents] = useState([]), [error, setError] = useState(''), [working, setWorking] = useState(false);
  useEffect(() => {
    const id = router.query.job; setSelected(null); setEvents([]);
    if (!id) return;
    return watchProcessingJob(id, { onStatus: setSelected, onEvent: (event) => setEvents((previous) => [...previous, event]), onError: (failure) => setError(failure.response?.data?.message || 'Connection interrupted. Reconnecting…') });
  }, [router.query.job, inventory.userId]);
  useEffect(() => {
    if (!inventory.data?.some((job) => ['PENDING', 'RUNNING', 'RETRYING', 'COMMITTING'].includes(job.status))) return;
    const timer = setTimeout(() => inventory.reload(), 5000); return () => clearTimeout(timer);
  }, [inventory]);
  const action = async (job, type) => {
    setWorking(true); setError('');
    try { const response = await api.post('/processing-jobs/' + job._id + '/' + type, {}); if (type === 'retry') router.push('/activity?job=' + response.data.data.jobId); await inventory.reload(); await usage.reload(); }
    catch (failure) { setError(failure.response?.data?.message || 'Unable to update this request'); }
    finally { setWorking(false); }
  };
  return <ProtectedRoute><AppShell><div className="max-w-6xl mx-auto space-y-5"><h1 className="text-3xl font-bold">Activity</h1><p className="text-sm">Requests continue while you navigate. Return here to open a result, cancel an active request or retry a failed request within 24 hours.</p>
    {usage.data && <section className="brutal-card p-5 text-sm space-y-2"><h2 className="font-bold text-xl">Usage in the last 24 hours</h2><p>{usage.data.requests} requests · {usage.data.completed} completed · {usage.data.failed} failed · {usage.data.offlineResponses} offline responses</p><p>Average request time: {Math.round(usage.data.averageDurationMs / 1000)} seconds · {usage.data.providerAttempts} provider attempts</p><p>Reported tokens: {usage.data.inputTokens} input / {usage.data.outputTokens} output, from {usage.data.providerTokenReports} responses that supplied token counts.</p><p className="text-gray-600">Server limit: up to {usage.data.requestLimit} AI requests per {usage.data.limitWindowMinutes} minutes. Provider quotas may differ.</p></section>}
    <label className="text-sm font-semibold block">Request status<select className="brutal-input block mt-1" value={status} onChange={(event) => setStatus(event.target.value)}>{['all', 'PENDING', 'RUNNING', 'RETRYING', 'COMMITTING', 'COMPLETED', 'FAILED', 'CANCELLED'].map((item) => <option key={item} value={item}>{item === 'all' ? 'All requests' : item.toLowerCase()}</option>)}</select></label>
    {error && <p role="alert" className="bg-red-50 p-3">{error}</p>}
    {inventory.loading && !inventory.data ? <p role="status">Loading activity…</p> : inventory.error ? <p role="alert">{inventory.error} <button className="underline" onClick={() => inventory.reload()}>Retry</button></p> : !inventory.data?.length ? <p className="brutal-card p-5">No requests found. Your processing activity will appear here.</p> : <ul className="space-y-3">{inventory.data.map((job) => <li className="brutal-card p-4 flex flex-wrap justify-between gap-3" key={job._id}><div><h2 className="font-bold">{names[job.jobType] || 'Processing request'}</h2><p className="text-sm">{job.status.toLowerCase()} · {new Date(job.createdAt).toLocaleString()}{job.retryCount ? ' · ' + job.retryCount + ' retries' : ''}</p>{job.error?.message && <p className="text-sm text-red-800">{job.error.message}</p>}</div><div className="flex flex-wrap gap-3 items-center text-sm"><Link href={'/activity?job=' + job._id} className="underline">View progress</Link>{job.status === 'FAILED' && <button disabled={working} onClick={() => action(job, 'retry')} className="border-2 px-3 py-2">Retry request</button>}{['PENDING', 'RUNNING', 'RETRYING'].includes(job.status) && <button disabled={working} onClick={() => action(job, 'cancel')} className="border-2 px-3 py-2">Cancel</button>}</div></li>)}</ul>}
    {selected && <section className="brutal-card p-5 space-y-3"><h2 className="font-bold text-xl">{names[selected.jobType]} · {selected.status.toLowerCase()}</h2>{selected.status === 'COMPLETED' && <Link className="brutal-btn-primary inline-block px-4 py-2 text-sm" href={resultLink(selected)}>Open result</Link>}{selected.error?.message && <p role="alert" className="text-sm">{selected.error.message}</p>}<details><summary className="cursor-pointer text-sm font-semibold">Technical processing details</summary><ProcessingTimeline events={events} title="Processing details" /></details></section>}
  </div></AppShell></ProtectedRoute>;
}
