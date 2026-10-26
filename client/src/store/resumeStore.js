import { create } from 'zustand';
import api from '../services/api';

let sessionGeneration = 0;
const initialState = () => ({
  resumes: [], activeResume: null, tailoredVersions: [], dashboardMetrics: null,
  activeJobTimeline: [], isProcessing: false, isLoading: false, error: null,
});
export const useResumeStore = create((set) => ({
  ...initialState(),
  reset: () => { sessionGeneration++; set(initialState()); },
  fetchDashboardMetrics: async () => {
    const generation = sessionGeneration;
    try {
      const response = await api.get('/resumes/dashboard');
      if (generation === sessionGeneration) set({ dashboardMetrics: response.data.data, error: null });
    } catch (error) {
      if (generation === sessionGeneration) set({ error: error.response?.data?.message || 'Unable to load dashboard' });
    }
  },
  fetchResumes: async () => {
    const generation = sessionGeneration;
    set({ isLoading: true, error: null });
    try {
      const response = await api.get('/resumes');
      if (generation === sessionGeneration) set({ resumes: response.data.data, isLoading: false });
    } catch (error) {
      if (generation === sessionGeneration) set({ error: error.message, isLoading: false });
    }
  },
  fetchResumeById: async (id) => {
    const generation = sessionGeneration;
    set({ isLoading: true, activeResume: null, error: null });
    try {
      const response = await api.get('/resumes/' + id);
      if (generation === sessionGeneration) set({ activeResume: response.data.data, isLoading: false });
      return response.data.data;
    } catch (error) {
      if (generation === sessionGeneration) set({ error: error.message, isLoading: false });
      throw error;
    }
  },
  fetchTailoredVersions: async (id) => {
    const generation = sessionGeneration;
    const response = await api.get('/resumes/' + id + '/versions');
    if (generation === sessionGeneration) set({ tailoredVersions: response.data.data });
    return response.data.data;
  },
  addTimelineEvent: (event) => set((state) => ({
    activeJobTimeline: [...state.activeJobTimeline.filter((item) => !event._id || item._id !== event._id), event].slice(-200),
  })),
  clearTimeline: () => set({ activeJobTimeline: [] }),
}));
