import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { readDraft, writeDraft, removeDraft } from '../services/draftStorage';
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
export default function usePersistentDraft(resource, server) {
  const userId = useAuthStore((state) => state.user?.id || state.user?._id);
  const identity = userId + ':' + resource;
  const active = useRef(identity); active.current = identity;
  const baseline = useRef(server); baseline.current = server;
  const [state, setState] = useState({ identity: '', ready: false, value: null, baseRevision: 0, dirty: false, history: [], future: [], conflict: false });
  const [storageError, setStorageError] = useState(false);
  useEffect(() => {
    if (!server || !userId || server.userId !== userId) return;
    setState((previous) => {
      if (previous.identity === identity && previous.ready) return previous;
      const cached = readDraft(userId, resource);
      return { identity, ready: true, value: cached?.value || server.value, baseRevision: cached?.baseRevision ?? server.revision, baseValue: cached?.baseValue || (!cached || cached.baseRevision === server.revision ? server.value : undefined),
        dirty: Boolean(cached && !equal(cached.value, server.value)), history: [], future: [],
        conflict: Boolean(cached && cached.baseRevision !== server.revision) };
    });
  }, [identity, resource, server, userId]);
  useEffect(() => {
    if (!state.ready || state.identity !== identity || !userId) return;
    if (!state.dirty) { removeDraft(userId, resource); setStorageError(false); return; }
    setStorageError(!writeDraft(userId, resource, state.value, state.baseRevision, state.baseValue));
  }, [identity, resource, state.baseRevision, state.baseValue, state.dirty, state.identity, state.ready, state.value, userId]);
  const change = useCallback((value) => setState((previous) => {
    if (previous.identity !== identity || !previous.ready) return previous;
    const next = typeof value === 'function' ? value(previous.value) : value;
    if (equal(next, previous.value)) return previous;
    return { ...previous, value: next, dirty: !equal(next, baseline.current?.value), history: [...previous.history, previous.value].slice(-30), future: [] };
  }), [identity]);
  const undo = () => setState((previous) => {
    if (previous.identity !== identity || !previous.history.length) return previous;
    const value = previous.history.at(-1);
    return { ...previous, value, dirty: !equal(value, baseline.current?.value), history: previous.history.slice(0, -1), future: [previous.value, ...previous.future] };
  });
  const redo = () => setState((previous) => {
    if (previous.identity !== identity || !previous.future.length) return previous;
    const value = previous.future[0];
    return { ...previous, value, dirty: !equal(value, baseline.current?.value), history: [...previous.history, previous.value].slice(-30), future: previous.future.slice(1) };
  });
  const markSaved = useCallback((saved, submitted) => {
    if (active.current !== identity) return;
    baseline.current = saved;
    setState((previous) => {
      if (previous.identity !== identity) return previous;
      const changed = !equal(previous.value, submitted);
      return { ...previous, value: changed ? previous.value : saved.value, baseRevision: saved.revision, baseValue: saved.value, dirty: changed, conflict: false };
    });
  }, [identity]);
  const discard = () => {
    if (!baseline.current || baseline.current.userId !== userId) return;
    removeDraft(userId, resource);
    setState({ identity, ready: true, value: baseline.current.value, baseValue: baseline.current.value, baseRevision: baseline.current.revision, dirty: false, history: [], future: [], conflict: false });
  };
  const rebase = (saved, value) => {
    if (active.current !== identity) return;
    baseline.current = saved;
    setState((previous) => ({ ...previous, value, baseValue: saved.value, baseRevision: saved.revision, dirty: !equal(value, saved.value), conflict: false, history: [...previous.history, previous.value].slice(-30), future: [] }));
  };
  const markConflict = useCallback(() => setState((previous) => previous.identity === identity ? ({ ...previous, conflict: true }) : previous), [identity]);
  return { ...state, ready: state.ready && state.identity === identity, change, undo, redo, markSaved, discard, markConflict, rebase, storageError,
    canUndo: state.history.length > 0, canRedo: state.future.length > 0 };
}
