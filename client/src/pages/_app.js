import React, { useEffect } from 'react';
import '../styles/globals.css';
import { useAuthStore } from '../store/authStore';

export default function MyApp({ Component, pageProps }) {
  const initialize = useAuthStore((state) => state.initialize);

  useEffect(() => {
    initialize();
  }, [initialize]);

  return <Component {...pageProps} />;
}
