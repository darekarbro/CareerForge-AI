import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';
export default function useOwnedResource(url) {
  const userId = useAuthStore((state) => state.user?.id || state.user?._id), identity = userId + ':' + url;
  const active = useRef(identity); active.current = identity;
  const [state, setState] = useState({ identity, data: null, error: '', loading: true });
  const reload = useCallback(async (signal) => {
    if (!userId || !url) return;
    setState((previous) => ({ ...previous, identity, loading: true, error: '', data: previous.identity === identity ? previous.data : null }));
    try {
      const response = await api.get(url, { signal });
      if (active.current === identity && !signal?.aborted) setState({ identity, data: response.data.data, error: '', loading: false });
      return response.data.data;
    } catch (failure) {
      if (active.current === identity && !signal?.aborted) setState({ identity, data: null, loading: false, error: failure.response?.data?.message || 'Unable to load this page. Please retry.' });
    }
  }, [identity, userId, url]);
  useEffect(() => { const controller = new AbortController(); reload(controller.signal); return () => controller.abort(); }, [reload]);
  return { ...(state.identity === identity ? state : { data: null, error: '', loading: true }), userId, reload };
}
