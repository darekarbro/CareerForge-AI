import { create } from 'zustand';
import api from '../services/api';

export const useResumeStore = create((set, get) => ({
  resumes: [],
  activeResume: null,
  tailoredVersions: [],
  dashboardMetrics: null,
  activeJobTimeline: [],
  isProcessing: false,
  isLoading: false,
  error: null,

  fetchDashboardMetrics: async () => {
    try {
      const res = await api.get('/resumes/dashboard');
      set({ dashboardMetrics: res.data.data });
    } catch (err) {
      console.error('Failed to fetch dashboard metrics:', err);
    }
  },

  fetchResumes: async () => {
    set({ isLoading: true });
    try {
      const res = await api.get('/resumes');
      set({ resumes: res.data.data, isLoading: false });
    } catch (err) {
      set({ error: err.message, isLoading: false });
    }
  },

  fetchResumeById: async (id) => {
    set({ isLoading: true });
    try {
      const res = await api.get(`/resumes/${id}`);
      set({ activeResume: res.data.data, isLoading: false });
      return res.data.data;
    } catch (err) {
      set({ error: err.message, isLoading: false });
      throw err;
    }
  },

  fetchTailoredVersions: async (resumeId) => {
    try {
      const res = await api.get(`/resumes/${resumeId}/versions`);
      set({ tailoredVersions: res.data.data });
      return res.data.data;
    } catch (err) {
      console.error('Failed to fetch tailored versions:', err);
    }
  },

  addTimelineEvent: (event) => {
    set((state) => ({
      activeJobTimeline: [...state.activeJobTimeline, event],
    }));
  },

  clearTimeline: () => {
    set({ activeJobTimeline: [] });
  },
}));
