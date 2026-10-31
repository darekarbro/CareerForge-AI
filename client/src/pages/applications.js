import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import ProtectedRoute from '../components/ProtectedRoute/ProtectedRoute';
import AppShell from '../components/AppShell/AppShell';
import ApplicationBoard from '../components/ApplicationBoard/ApplicationBoard';
import useOwnedResource from '../hooks/useOwnedResource';
import api from '../services/api';
export default function ApplicationsPage() {
  const router = useRouter(), [search, setSearch] = useState(''), [status, setStatus] = useState('all'), [due, setDue] = useState(false), [sort, setSort] = useState('-lastUpdated'), [initialDraft, setInitialDraft] = useState(null), [error, setError] = useState('');
  const query = new URLSearchParams({ search, status, sort, ...(due ? { due: '1' } : {}) });
  const apps = useOwnedResource('/applications?' + query), analytics = useOwnedResource('/applications/analytics');
  const workspace = useOwnedResource(router.query.workspace ? '/workspaces/' + router.query.workspace : null);
  useEffect(() => { if (router.query.due) setDue(true); }, [router.query.due]);
  useEffect(() => {
    if (!workspace.data) { setInitialDraft(null); return; }
    const item = workspace.data.workspace;
    if (workspace.data.application) setInitialDraft({ userId: workspace.userId, value: workspace.data.application });
    else setInitialDraft({ userId: workspace.userId, value: { company: item.company, roleTitle: item.title, jobLink: item.jobUrl, workspaceId: item._id, resumeVersionId: item.latestVersionId } });
  }, [workspace.data, workspace.userId]);
  const refresh = () => { apps.reload(); analytics.reload(); };
  const add = async (body) => { await api.post('/applications', body); refresh(); };
  const update = async (id, body) => { await api.put('/applications/' + id, body); refresh(); };
  const remove = async (id) => { await api.delete('/applications/' + id); refresh(); };
  useEffect(() => {
    if (router.query.download) api.download('/applications/' + router.query.download + '/resume', 'application_resume.pdf').catch(() => setError('Unable to download the saved resume.'));
  }, [router.query.download]);
  return <ProtectedRoute><AppShell><div className="space-y-6 max-w-7xl mx-auto"><h1 className="text-3xl font-bold">Applications</h1><p className="text-sm">Track each opportunity, the resume you sent, and when to follow up.</p>
    <div className="brutal-card p-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-4"><label className="font-semibold text-sm">Search company or role<input className="brutal-input block w-full mt-1" maxLength={200} value={search} onChange={(event) => setSearch(event.target.value)} /></label><label className="font-semibold text-sm">Stage<select className="brutal-input block w-full mt-1" value={status} onChange={(event) => setStatus(event.target.value)}>{['all', 'saved', 'applied', 'oa', 'interview', 'offer', 'rejected'].map((value) => <option key={value} value={value}>{value === 'all' ? 'All stages' : value === 'oa' ? 'Online assessment' : value}</option>)}</select></label><label className="font-semibold text-sm">Sort<select className="brutal-input block w-full mt-1" value={sort} onChange={(event) => setSort(event.target.value)}><option value="-lastUpdated">Recently updated</option><option value="company">Company</option><option value="deadline">Deadline</option><option value="followUpAt">Follow-up date</option><option value="-appliedDate">Applied date</option></select></label><label className="text-sm font-semibold flex gap-2 items-center"><input type="checkbox" checked={due} onChange={(event) => setDue(event.target.checked)} />Due or overdue within 7 days</label></div>
    {error && <p role="alert">{error}</p>}
    {apps.loading ? <p role="status">Loading applications…</p> : apps.error ? <p role="alert">{apps.error} <button className="underline" onClick={() => apps.reload()}>Retry</button></p> : <ApplicationBoard key={apps.userId} applications={apps.data || []} initialDraft={initialDraft?.userId === apps.userId ? initialDraft.value : null} onInitialDraftHandled={() => setInitialDraft(null)} onAddApplication={add} onUpdateApplication={update} onDeleteApplication={remove} />}
    {analytics.error ? <p role="alert">Application analytics could not be loaded.</p> : analytics.data && <section className="brutal-card p-5"><h2 className="font-bold text-xl mb-3">Application progress</h2><p className="text-sm">{analytics.data.totalApplications} tracked · {analytics.data.stages.interview} interviewing · {analytics.data.stages.offer} offers</p>{analytics.data.weeklyVolume.length ? <table className="w-full text-sm mt-4"><caption className="text-left font-semibold">Weekly applications</caption><thead><tr><th scope="col" className="text-left">Week starting</th><th scope="col" className="text-right">Applications</th></tr></thead><tbody>{analytics.data.weeklyVolume.map((item) => <tr key={item.week} className="border-t"><td>{item.week}</td><td className="text-right">{item.applications}</td></tr>)}</tbody></table> : <p className="text-sm mt-3">Applied dates will build your weekly history here.</p>}</section>}
  </div></AppShell></ProtectedRoute>;
}
