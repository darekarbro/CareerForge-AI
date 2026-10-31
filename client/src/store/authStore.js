import { create } from 'zustand';
import api from '../services/api';
import { useResumeStore } from './resumeStore';
import { disconnectSocket } from '../services/socket';
import { clearUserDrafts } from '../services/draftStorage';

let revision = 0;
const persist = (token, user) => {
  if (typeof window !== 'undefined') localStorage.setItem('careerforge_auth', JSON.stringify({ token, user }));
};
const resetPrivateState = () => { disconnectSocket(); useResumeStore.getState().reset(); };

export const useAuthStore = create((set, get) => ({
  user: null, token: null, isAuthenticated: false, isLoading: true, error: null,
  setSession: (token, user) => {
    revision++;
    if (get().token !== token) { clearUserDrafts(get().user?.id || get().user?._id); resetPrivateState(); }
    persist(token, user);
    set({ token, user, isAuthenticated: true, isLoading: false, error: null });
  },
  updateUser: (user) => {
    if (!get().token) return;
    persist(get().token, user);
    set({ user });
  },
  initialize: async () => {
    if (typeof window === 'undefined') return;
    const currentRevision = revision;
    try {
      const stored = JSON.parse(localStorage.getItem('careerforge_auth') || '{}');
      if (!stored.token) { set({ isLoading: false }); return; }
      if (get().token !== stored.token) resetPrivateState();
      set({ token: stored.token, user: stored.user, isAuthenticated: true, isLoading: false });
      try {
        const response = await api.get('/auth/me');
        if (revision === currentRevision && get().token === stored.token) get().updateUser(response.data.data);
      } catch (error) {
        if (revision !== currentRevision || get().token !== stored.token) return;
        if ([401, 403].includes(error.response?.status)) get().logout();
        else set({ error: 'The server is temporarily unavailable. Your session has been kept; retry when it reconnects.' });
      }
    } catch {
      if (revision === currentRevision) get().logout();
    }
  },
  login: async (email, password) => {
    set({ error: null });
    try {
      const response = await api.post('/auth/login', { email, password });
      get().setSession(response.data.data.token, response.data.data.user);
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.message || 'Login failed';
      set({ error: message }); return { success: false, message };
    }
  },
  register: async (data) => {
    set({ error: null });
    try {
      const response = await api.post('/auth/register', data);
      get().setSession(response.data.data.token, response.data.data.user);
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.message || 'Registration failed';
      set({ error: message }); return { success: false, message };
    }
  },
  firebaseLogin: async (idToken) => {
    set({ error: null });
    try {
      const response = await api.post('/auth/firebase', { idToken });
      get().setSession(response.data.data.token, response.data.data.user);
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.message || 'Google sign-in failed';
      set({ error: message }); return { success: false, message };
    }
  },
  logout: () => {
    revision++;
    clearUserDrafts(get().user?.id || get().user?._id);
    if (typeof window !== 'undefined') localStorage.removeItem('careerforge_auth');
    resetPrivateState();
    set({ user: null, token: null, isAuthenticated: false, isLoading: false, error: null });
  },
}));
