import { create } from 'zustand';
import api from '../services/api';

export const useAuthStore = create((set, get) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,

  initialize: async () => {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem('careerforge_auth');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.token) {
          set({ token: parsed.token, user: parsed.user, isAuthenticated: true, isLoading: false });
          // Fetch fresh user profile
          const res = await api.get('/auth/me');
          if (res.data?.data) {
            set({ user: res.data.data });
          }
          return;
        }
      }
    } catch (e) {
      console.warn('Auth initialization error:', e.message);
    }
    set({ isLoading: false });
  },

  login: async (email, password) => {
    set({ error: null });
    try {
      const res = await api.post('/auth/login', { email, password });
      const { token, user } = res.data.data;
      set({ token, user, isAuthenticated: true, error: null });
      localStorage.setItem('careerforge_auth', JSON.stringify({ token, user }));
      return { success: true };
    } catch (err) {
      const msg = err.response?.data?.message || 'Login failed';
      set({ error: msg });
      return { success: false, message: msg };
    }
  },

  register: async ({ name, email, password, targetRolePreference }) => {
    set({ error: null });
    try {
      const res = await api.post('/auth/register', { name, email, password, targetRolePreference });
      const { token, user } = res.data.data;
      set({ token, user, isAuthenticated: true, error: null });
      localStorage.setItem('careerforge_auth', JSON.stringify({ token, user }));
      return { success: true };
    } catch (err) {
      const msg = err.response?.data?.message || 'Registration failed';
      set({ error: msg });
      return { success: false, message: msg };
    }
  },

  logout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('careerforge_auth');
    }
    set({ user: null, token: null, isAuthenticated: false, error: null });
  },
}));
