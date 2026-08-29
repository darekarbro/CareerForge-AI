import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: attach token
api.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('careerforge_auth');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          const token = parsed?.token || parsed?.state?.token;
          if (token) {
            config.headers.Authorization = `Bearer ${token}`;
          }
        } catch (e) {
          // ignore parse error
        }
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: handle 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      const isAuthPage =
        window.location.pathname.includes('/login') ||
        window.location.pathname.includes('/register') ||
        window.location.pathname === '/';

      if (!isAuthPage) {
        localStorage.removeItem('careerforge_auth');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
