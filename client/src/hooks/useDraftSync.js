import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';
import { mergePlan } from '../services/resumeTools';

// Server revisions prevent one browser tab from overwriting another tab's work.
export default function useDraftSync(draft, url, decode, onSaved, readUrl = url) {
  const userId = useAuthStore((state) => state.user?.id || state.user?._id);
  const latest = useRef(); latest.current = { draft, decode, onSaved };
  const running = useRef(null);
  const [saving, setSaving] = useState(false), [error, setError] = useState('');
  const [resolution, setResolution] = useState(null);
  const current = useCallback(() => userId === (useAuthStore.getState().user?.id || useAuthStore.getState().user?._id), [userId]);
  useEffect(() => { setError(''); setSaving(false); setResolution(null); return () => running.current?.controller.abort(); }, [userId, url]);
  const save = useCallback(async () => {
    if (running.current) return running.current.promise;
    const snapshot = latest.current.draft;
    if (!snapshot.ready || snapshot.conflict || !current()) return false;
    if (!snapshot.dirty) return true;
    const controller = new AbortController(), submitted = snapshot.value;
    setSaving(true); setError('');
    const promise = (async () => {
      try {
        const response = await api.put(url, { ...submitted, revision: snapshot.baseRevision }, { signal: controller.signal });
        if (controller.signal.aborted || !current()) return false;
        const saved = { ...latest.current.decode(response.data.data), userId };
        const caughtUp = JSON.stringify(latest.current.draft.value) === JSON.stringify(submitted);
        snapshot.markSaved(saved, submitted); latest.current.onSaved(saved, response.data.data); return caughtUp;
      } catch (failure) {
        if (controller.signal.aborted || !current()) return false;
        if (failure.response?.status === 409 && !['SELECTION_STALE', 'DUPLICATE_WORKSPACE'].includes(failure.response?.data?.code)) snapshot.markConflict();
        setError(failure.response?.data?.message || 'Unable to sync. Your local draft is still available.'); return false;
      } finally { if (running.current?.controller === controller) { running.current = null; if (current()) setSaving(false); } }
    })();
    running.current = { controller, promise }; return promise;
  }, [current, url, userId]);
  useEffect(() => {
    if (!draft.ready || !draft.dirty || draft.conflict || saving || error) return;
    const timer = setTimeout(save, 1200); return () => clearTimeout(timer);
  }, [draft.ready, draft.dirty, draft.conflict, draft.value, saving, error, save]);
  const change = (value) => { setError(''); draft.change(value); };
  const prepareResolution = async () => {
    try {
      const response = await api.get(readUrl);
      if (!current()) return;
      const saved = { ...latest.current.decode(response.data.data), userId }, local = latest.current.draft;
      setResolution({ saved, record: response.data.data, submitted: local.value, plan: mergePlan(local.baseValue, local.value, saved.value) });
    } catch (failure) { if (current()) setError(failure.response?.data?.message || 'Unable to load changes for comparison'); }
  };
  const resolve = (value) => {
    if (!current() || !resolution) return;
    if (JSON.stringify(latest.current.draft.value) !== JSON.stringify(resolution.submitted)) { setResolution(null); setError('Your local draft changed. Open conflict resolution again to include the latest edits.'); return; }
    latest.current.draft.rebase(resolution.saved, value); latest.current.onSaved(resolution.saved, resolution.record); setError(''); setResolution(null);
  };
  const reload = async () => {
    try {
      const response = await api.get(readUrl);
      if (!current()) return;
      const saved = { ...latest.current.decode(response.data.data), userId };
      latest.current.draft.markSaved(saved, latest.current.draft.value); latest.current.onSaved(saved, response.data.data); setError(''); setResolution(null);
    } catch (failure) { if (current()) setError(failure.response?.data?.message || 'Unable to load the latest saved content'); }
  };
  return { saving, error, save, reload, change, setError, current, resolution, prepareResolution, resolve };
}
