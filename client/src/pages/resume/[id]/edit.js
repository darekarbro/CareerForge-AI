import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import AppShell from '../../../components/AppShell/AppShell';
import ProtectedRoute from '../../../components/ProtectedRoute/ProtectedRoute';
import ResumeEditor, { normalizeContent } from '../../../components/ResumeEditor/ResumeEditor';
import DraftToolbar from '../../../components/DraftToolbar/DraftToolbar';
import RevisionHistory from '../../../components/ResumeEditor/RevisionHistory';
import SourceComparison from '../../../components/ResumeEditor/SourceComparison';
import usePersistentDraft from '../../../hooks/usePersistentDraft';
import useDraftSync from '../../../hooks/useDraftSync';
import { defaultPresentation } from '../../../services/resumeTools';
import { useAuthStore } from '../../../store/authStore';
import api from '../../../services/api';
const decode = (resume) => ({ revision: resume.contentRevision || 1, value: { title: resume.title, content: normalizeContent(resume.parsedData), revisionName: resume.revisionName || 'Verified resume', presentation: resume.presentation || defaultPresentation() } });
export default function ResumeEditPage() {
  const { query } = useRouter(), id = query.id, userId = useAuthStore((state) => state.user?.id || state.user?._id);
  const [server, setServer] = useState(null), [source, setSource] = useState(null), [loadingSource, setLoadingSource] = useState(false);
  const draft = usePersistentDraft('resume:' + id, server);
  const sync = useDraftSync(draft, '/resumes/' + id + '/content', decode, setServer, '/resumes/' + id);
  useEffect(() => {
    const controller = new AbortController(); setServer(null); setSource(null);
    if (id && userId) api.get('/resumes/' + id, { signal: controller.signal }).then(({ data }) => {
      if (controller.signal.aborted) return;
      if (data.data.processingStatus !== 'COMPLETED') { sync.setError('Wait for this resume to finish processing before editing.'); return; }
      setServer({ ...decode(data.data), userId });
    }).catch((failure) => { if (!controller.signal.aborted) sync.setError(failure.response?.data?.message || 'Unable to load this resume'); });
    if (id && userId && query.source === '1') api.get('/resumes/' + id + '/import-review', { signal: controller.signal }).then((res) => { if (!controller.signal.aborted) setSource(res.data.data); }).catch((err) => { if (!controller.signal.aborted) sync.setError(err.response?.data?.message || 'Unable to load the original source.'); });
    return () => controller.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, userId, query.source]);
  async function loadSource() { setLoadingSource(true); try { const res = await api.get('/resumes/' + id + '/import-review'); if (sync.current()) setSource(res.data.data); } catch (err) { if (sync.current()) sync.setError(err.response?.data?.message || 'Unable to load the source.'); } finally { if (sync.current()) setLoadingSource(false); } }
  return <ProtectedRoute><AppShell><div className="max-w-5xl mx-auto space-y-5">
    <Link href={'/resume/' + id} className="text-blue-700 underline text-sm">Back to resume</Link><h1 className="text-3xl font-bold">Edit and verify your resume</h1>
    <p className="text-sm text-gray-600">Add facts only you know: your contribution, tools, scope and results. Compare the original, review date and duplicate warnings, then save when accurate.</p>
    {draft.ready ? <>
      <DraftToolbar draft={draft} saving={sync.saving} error={sync.error} onSave={sync.save} onReload={sync.reload} onResolve={sync.prepareResolution} resolution={sync.resolution} onResolved={sync.resolve} />
      <div className="grid sm:grid-cols-2 gap-4"><label className="block font-semibold text-sm">Resume name<input disabled={draft.conflict} className="brutal-input block w-full mt-1" maxLength={120} value={draft.value.title} onChange={(event) => sync.change({ ...draft.value, title: event.target.value })} /></label><label className="block font-semibold text-sm">Name this revision<input disabled={draft.conflict} className="brutal-input block w-full mt-1" maxLength={100} value={draft.value.revisionName} onChange={(event) => sync.change({ ...draft.value, revisionName: event.target.value })} /></label></div>
      <Link className="underline text-blue-800 text-sm block" href={'/copilot?resume=' + id}>Open evidence-backed resume copilot</Link>
      <button type="button" disabled={loadingSource} onClick={loadSource} className="border-2 px-4 py-2 text-sm">{loadingSource ? 'Loading original source…' : 'Compare with original source'}</button>
      {source && <SourceComparison review={source} />}
      <ResumeEditor content={draft.value.content} disabled={draft.conflict} issues={source?.issues || []} initialSection={query.section} presentation={draft.value.presentation} onPresentationChange={(presentation) => sync.change({ ...draft.value, presentation })} onChange={(content) => sync.change({ ...draft.value, content })} />
      <RevisionHistory url={'/resumes/' + id + '/history'} restoreUrl={'/resumes/' + id + '/restore'} revision={draft.baseRevision} disabled={draft.dirty || sync.saving || draft.conflict} onRestored={(record) => { const saved = { ...decode(record), userId }; draft.markSaved(saved, draft.value); setServer(saved); }} />
      <Link href={'/resume/' + id + '/tailor'} className="brutal-btn-primary inline-block px-5 py-3 text-sm">Tailor for a job</Link>
    </> : <div><p role={sync.error ? 'alert' : 'status'}>{sync.error || 'Loading your resume…'}</p>{sync.error && <button type="button" onClick={() => window.location.reload()} className="underline">Retry loading resume</button>}</div>}
  </div></AppShell></ProtectedRoute>;
}
