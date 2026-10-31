import React, { useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import '../styles/globals.css';
import { useAuthStore } from '../store/authStore';

export default function MyApp({ Component, pageProps }) {
  const { pathname } = useRouter();
  const titles = { '/': 'Build your career', '/evidence': 'Career evidence library', '/copilot': 'Evidence-backed copilot', '/profile': 'Career profile', '/dashboard': 'Dashboard', '/workspaces': 'Job workspaces', '/workspaces/[id]': 'Job preparation', '/resume/[id]/edit': 'Verify resume facts', '/resume/[id]/tailor': 'Review tailored resume', '/account': 'Account and privacy', '/activity': 'Processing activity', '/applications': 'Applications', '/interview/setup': 'Set up interview practice', '/interview/session/[id]': 'Interview practice' };
  const title = titles[pathname] || pathname.split('/').filter(Boolean).map((part) => part.replace(/-/g, ' ')).filter((part) => !part.startsWith('[')).join(' · ') || 'Career workspace';
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

  return <><Head><title>{title + ' | CareerForge AI'}</title></Head><Component {...pageProps} /></>;
}
