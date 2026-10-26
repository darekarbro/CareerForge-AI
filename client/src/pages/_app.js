import React, { useEffect } from 'react';
import '../styles/globals.css';
import { useAuthStore } from '../store/authStore';

export default function MyApp({ Component, pageProps }) {
  const initialize = useAuthStore((state) => state.initialize);

  useEffect(() => {
    const invalidate = () => useAuthStore.getState().logout();
    window.addEventListener('careerforge:unauthorized', invalidate);
    initialize();
    return () => window.removeEventListener('careerforge:unauthorized', invalidate);
  }, [initialize]);

  return <Component {...pageProps} />;
}
