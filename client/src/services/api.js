import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.download = async (url, filename) => {
  const accountToken = () => { try { return JSON.parse(localStorage.getItem('careerforge_auth') || '{}').token; } catch { return undefined; } };
  const initialToken = accountToken();
  const response = await api.get(url, { responseType: 'blob' });
  if (initialToken !== accountToken()) throw Object.assign(new Error('Download stopped because your account changed'), { name: 'AbortError' });

  const blob = new Blob([response.data], {
    type: response.headers['content-type'] || 'application/pdf',
  });

  const downloadUrl = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = downloadUrl;
  anchor.download = filename || 'download.pdf';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(downloadUrl);

  return response;
};

// Request interceptor: attach token
api.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('careerforge_auth');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          const token = parsed?.token || parsed?.state?.token;
          if (token && !config.headers.Authorization) {
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
    if (error.response?.status === 401 && (!error.response.data?.code || error.response.data.code.startsWith('SESSION_')) && typeof window !== 'undefined') {
      const isAuthPage =
        window.location.pathname.includes('/login') ||
        window.location.pathname.includes('/register') ||
        window.location.pathname === '/';

      if (!isAuthPage) {
        let current = {}; try { current = JSON.parse(localStorage.getItem('careerforge_auth') || '{}'); } catch { /* Invalid storage is cleared at initialization. */ }
        if (error.config?.headers?.Authorization === `Bearer ${current.token}`) {
          window.dispatchEvent(new Event('careerforge:unauthorized'));
          localStorage.removeItem('careerforge_auth');
          window.location.href = '/login?expired=1';
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;
