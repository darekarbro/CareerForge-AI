import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import AppShell from '../../../components/AppShell/AppShell';
import ProtectedRoute from '../../../components/ProtectedRoute/ProtectedRoute';
import ResumeEditor, { normalizeContent } from '../../../components/ResumeEditor/ResumeEditor';
import DraftToolbar from '../../../components/DraftToolbar/DraftToolbar';
import usePersistentDraft from '../../../hooks/usePersistentDraft';
import useDraftSync from '../../../hooks/useDraftSync';
import { useAuthStore } from '../../../store/authStore';
import api from '../../../services/api';
const decode = (resume) => ({ revision: resume.contentRevision || 1, value: { title: resume.title, content: normalizeContent(resume.parsedData) } });
export default function ResumeEditPage() {
  const { query } = useRouter(), id = query.id, userId = useAuthStore((state) => state.user?.id || state.user?._id);
  const [server, setServer] = useState(null), [history, setHistory] = useState([]);
  const draft = usePersistentDraft('resume:' + id, server);
  const sync = useDraftSync(draft, '/resumes/' + id + '/content', decode, setServer, '/resumes/' + id);
  useEffect(() => {
    const controller = new AbortController(); setServer(null); setHistory([]);
    if (id && userId) api.get('/resumes/' + id, { signal: controller.signal }).then(({ data }) => {
      if (controller.signal.aborted) return;
      if (data.data.processingStatus !== 'COMPLETED') { sync.setError('Wait for this resume to finish processing before editing.'); return; }
      setServer({ ...decode(data.data), userId });
    }).catch((failure) => { if (!controller.signal.aborted) sync.setError(failure.response?.data?.message || 'Unable to load this resume'); });
    return () => controller.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, userId]);
  const loadHistory = async () => { try { const response = await api.get('/resumes/' + id + '/history'); if (sync.current()) setHistory(response.data.data); } catch { sync.setError('Unable to load revision history'); } };
  const restore = async (entry) => {
    if (draft.dirty || sync.saving) { sync.setError('Save the current draft before restoring a revision.'); return; }
    try {
      const response = await api.post('/resumes/' + id + '/restore', { revision: draft.baseRevision, restoreRevision: entry.revision });
      if (!sync.current()) return;
      const saved = { ...decode(response.data.data), userId }; setServer(saved); draft.markSaved(saved, draft.value); await loadHistory();
    } catch (failure) { sync.setError(failure.response?.data?.message || 'Unable to restore this revision'); }
  };
  return <ProtectedRoute><AppShell><div className="max-w-5xl mx-auto space-y-5">
    <Link href={'/resume/' + id} className="text-blue-700 underline text-sm">Back to resume</Link>
    <h1 className="text-3xl font-bold">Edit and verify your resume</h1>
    <p className="text-sm text-gray-600">Add the facts only you know: your contribution, tools used, scope and results. Changes save automatically; past revisions remain available.</p>
    {draft.ready ? <>
      <DraftToolbar draft={draft} saving={sync.saving} error={sync.error} onSave={sync.save} onReload={sync.reload} />
      <label className="block font-semibold text-sm">Resume name<input className="brutal-input block w-full mt-1" maxLength={120} value={draft.value.title} onChange={(event) => sync.change({ ...draft.value, title: event.target.value })} /></label>
      <ResumeEditor content={draft.value.content} initialSection={query.section} onChange={(content) => sync.change({ ...draft.value, content })} />
      <details className="brutal-card p-4" onToggle={(event) => { if (event.currentTarget.open) loadHistory(); }}><summary className="font-semibold cursor-pointer">Revision history</summary>
        <ul className="space-y-2 mt-3">{history.map((entry) => <li key={entry.revision} className="flex justify-between gap-3 text-sm"><span>Revision {entry.revision} · {new Date(entry.savedAt).toLocaleString()}{entry.current ? ' · Current' : ''}</span>{!entry.current && <button disabled={draft.dirty || sync.saving} onClick={() => restore(entry)} className="underline disabled:opacity-40">Restore</button>}</li>)}</ul>
      </details>
      <Link href={'/resume/' + id + '/tailor'} className="brutal-btn-primary inline-block px-5 py-3 text-sm">Tailor for a job</Link>
    </> : <p role={sync.error ? 'alert' : 'status'}>{sync.error || 'Loading your resume…'}</p>}
  </div></AppShell></ProtectedRoute>;
}
