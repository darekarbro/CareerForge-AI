import React, { useEffect } from 'react';
import '../styles/globals.css';
import { useAuthStore } from '../store/authStore';

export default function MyApp({ Component, pageProps }) {
  const initialize = useAuthStore((state) => state.initialize);

  useEffect(() => {
    const invalidate = () => useAuthStore.getState().logout(false);
    const check = () => {
      const token = useAuthStore.getState().token;
      if (!token) return;
      try {
        const { exp } = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
        if (exp * 1000 <= Date.now()) { invalidate(); window.location.assign('/login?expired=1'); }
      } catch { /* Opaque test tokens have no client expiry; the API still authenticates every request. */ }
    };
    const storage = (event) => { if (event.key === 'careerforge_auth') { if (!event.newValue) invalidate(); else initialize(); } };
    window.addEventListener('careerforge:unauthorized', invalidate);
    window.addEventListener('storage', storage);
    window.addEventListener('focus', check);
    const timer = setInterval(check, 1000);
    initialize();
    return () => { clearInterval(timer); window.removeEventListener('careerforge:unauthorized', invalidate); window.removeEventListener('storage', storage); window.removeEventListener('focus', check); };
  }, [initialize]);

  return <Component {...pageProps} />;
}
