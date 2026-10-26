import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import ProtectedRoute from '../components/ProtectedRoute/ProtectedRoute';
import AppShell from '../components/AppShell/AppShell';
import ResumeEditor, { normalizeContent } from '../components/ResumeEditor/ResumeEditor';
import DraftToolbar from '../components/DraftToolbar/DraftToolbar';
import usePersistentDraft from '../hooks/usePersistentDraft';
import useDraftSync from '../hooks/useDraftSync';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
const decode = (profile) => ({ revision: profile.revision, value: { content: normalizeContent(profile.content),
  targetRole: profile.targetRole, experienceLevel: profile.experienceLevel, onboardingCompleted: profile.onboardingCompleted } });
export default function ProfilePage() {
  const router = useRouter(), userId = useAuthStore((state) => state.user?.id || state.user?._id);
  const [server, setServer] = useState(null), [creating, setCreating] = useState(false);
  const [resumes, setResumes] = useState([]), [importId, setImportId] = useState('');
  const draft = usePersistentDraft('career-profile', server);
  const sync = useDraftSync(draft, '/profile', decode, (saved) => {
    setServer(saved);
    const auth = useAuthStore.getState(); auth.updateUser({ ...auth.user, targetRolePreference: saved.value.targetRole });
  });
  useEffect(() => {
    const controller = new AbortController(); setServer(null); setResumes([]); setImportId('');
    if (userId) Promise.all([api.get('/profile', { signal: controller.signal }), api.get('/resumes', { signal: controller.signal })])
      .then(([profile, inventory]) => { if (!controller.signal.aborted) { setServer({ ...decode(profile.data.data), userId }); setResumes((inventory.data.data || []).filter((item) => item.processingStatus === 'COMPLETED')); } })
      .catch((failure) => { if (!controller.signal.aborted) sync.setError(failure.response?.data?.message || 'Unable to load your career profile'); });
    return () => controller.abort();
  // The request belongs to the account, not to the changing draft.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);
  const importResume = async () => {
    try { const response = await api.get('/resumes/' + importId); if (sync.current()) sync.change({ ...draft.value, content: normalizeContent(response.data.data.parsedData) }); }
    catch { if (sync.current()) sync.setError('Unable to import this resume'); }
  };
  const create = async () => {
    if (!await sync.save()) return;
    setCreating(true); sync.setError('');
    try { const response = await api.post('/profile/resumes', { title: draft.value.content.contactInfo.name + ' — Resume' }); if (sync.current()) router.push('/resume/' + response.data.data._id + '/edit'); }
    catch (failure) { if (sync.current()) sync.setError(failure.response?.data?.message || 'Unable to create a resume'); }
    finally { if (sync.current()) setCreating(false); }
  };
  return <ProtectedRoute><AppShell><div className="max-w-5xl mx-auto space-y-6">
    <header className="space-y-2"><h1 className="text-3xl font-bold">My career profile</h1><p className="text-sm text-gray-600">Keep your verified experience here. Use it to create resumes for different jobs. Changes save automatically.</p></header>
    {draft.ready ? <>
      <DraftToolbar draft={draft} saving={sync.saving} error={sync.error} onSave={sync.save} onReload={sync.reload} />
      <div className="brutal-card p-5 grid md:grid-cols-2 gap-4">
        <label className="text-sm font-semibold">Target role<input value={draft.value.targetRole} maxLength={120} onChange={(event) => sync.change({ ...draft.value, targetRole: event.target.value })} className="brutal-input w-full mt-1 text-sm" /></label>
        <label className="text-sm font-semibold">Experience level<select value={draft.value.experienceLevel} onChange={(event) => sync.change({ ...draft.value, experienceLevel: event.target.value })} className="brutal-input w-full mt-1 text-sm">
          <option value="student">Student / graduate</option><option value="early">Early career</option><option value="mid">Experienced professional</option><option value="senior">Senior / leadership</option>
        </select></label>
        {resumes.length > 0 && <div className="md:col-span-2 flex flex-wrap items-end gap-3">
          <label className="text-sm font-semibold">Import facts from a resume<select value={importId} onChange={(event) => setImportId(event.target.value)} className="brutal-input block mt-1 text-sm"><option value="">Choose a resume</option>{resumes.map((resume) => <option key={resume._id} value={resume._id}>{resume.title}</option>)}</select></label>
          <button type="button" disabled={!importId} onClick={importResume} className="border-2 border-[#1a1a1a] px-4 py-2 text-sm disabled:opacity-40">Import into draft</button>
        </div>}
      </div>
      <ResumeEditor content={draft.value.content} onChange={(content) => sync.change({ ...draft.value, content })} />
      <button type="button" onClick={create} disabled={creating || sync.saving || draft.conflict} className="brutal-btn-primary px-5 py-3 text-sm disabled:opacity-40">{creating ? 'Creating resume…' : 'Create resume from saved profile'}</button>
    </> : sync.error ? <p role="alert" className="p-4 bg-red-50">{sync.error}</p> : <p role="status" className="p-8">Loading your profile…</p>}
  </div></AppShell></ProtectedRoute>;
}
