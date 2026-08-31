import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuthStore } from '../store/authStore';
import { ArrowRight, AlertCircle, Chrome, Loader2, Lock, Mail } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore((state) => state.login);
  const firebaseLogin = useAuthStore((state) => state.firebaseLogin);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage('');

    const res = await login(email, password);
    setLoading(false);

    if (res.success) {
      router.push('/dashboard');
    } else {
      setErrorMessage(res.message || 'Invalid credentials');
    }
  };

  const handleFirebaseGoogleSignIn = async () => {
    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;

    if (!apiKey || !authDomain) {
      setErrorMessage('Google sign-in is not configured. Add the Firebase web config to your client .env file.');
      return;
    }

    try {
      const { initializeApp, getApps } = await import('firebase/app');
      const { getAuth, GoogleAuthProvider, signInWithPopup } = await import('firebase/auth');

      const firebaseApp = getApps().length ? getApps()[0] : initializeApp({
        apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
        authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
      });

      const auth = getAuth(firebaseApp);
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });

      const result = await signInWithPopup(auth, provider);
      const idToken = await result.user.getIdToken();
      const res = await firebaseLogin(idToken);

      if (res.success) {
        router.push('/dashboard');
      } else {
        setErrorMessage(res.message || 'Google sign-in failed');
      }
    } catch (err) {
      const message = err?.code === 'auth/popup-closed-by-user'
        ? 'Google sign-in was cancelled.'
        : err?.message || 'Google sign-in failed';
      setErrorMessage(message);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f0e8] flex flex-col justify-between selection:bg-[#ffcc00] selection:text-[#1a1a1a]">
      {/* Top Bar */}
      <div className="p-4 sm:p-6 border-b-3 border-[#1a1a1a] flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[#1a1a1a] border-2 border-[#1a1a1a] text-[#ffcc00] flex items-center justify-center font-headline font-black text-lg shadow-brutal">
            C
          </div>
          <span className="font-headline font-black text-xl uppercase tracking-tight text-[#1a1a1a]">
            CareerForge<span className="text-[#0055ff]">.AI</span>
          </span>
        </Link>
        <Link
          href="/register"
          className="px-3 py-1.5 border-2 border-[#1a1a1a] bg-white font-headline font-bold text-xs uppercase hover:bg-[#ffcc00] shadow-brutal transition-all"
        >
          Create Account
        </Link>
      </div>

      {/* Main Login Card */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-md bg-white border-4 border-[#1a1a1a] shadow-brutal-xl p-8 space-y-6">
          <div className="space-y-1">
            <span className="px-2 py-0.5 bg-[#ffcc00] border border-[#1a1a1a] font-headline font-black text-[10px] uppercase text-[#1a1a1a]">
              Auth Gateway
            </span>
            <h2 className="font-headline font-black text-3xl uppercase tracking-tight text-[#1a1a1a]">
              Sign In
            </h2>
            <p className="text-xs text-gray-600 font-medium">
              Access your resume pipeline, interview logs, and application board.
            </p>
          </div>

          {errorMessage && (
            <div className="p-3 border-2 border-[#1a1a1a] bg-[#ffdad6] text-[#93000a] text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <button
            type="button"
            onClick={handleFirebaseGoogleSignIn}
            className="w-full border-2 border-[#1a1a1a] bg-white hover:bg-[#eaf2ff] text-[#1a1a1a] font-headline font-black uppercase text-[11px] py-3 flex items-center justify-center gap-2 shadow-brutal transition-all"
          >
            <Chrome className="w-4 h-4" />
            <span>Sign in with Google account</span>
          </button>

          <div className="relative flex items-center justify-center">
            <div className="absolute inset-x-0 top-1/2 h-px bg-[#1a1a1a]" />
            <span className="relative bg-white px-2 text-[10px] font-headline font-black uppercase tracking-[0.2em] text-gray-500">
              Or continue with email
            </span>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block font-headline font-bold text-xs uppercase text-[#1a1a1a] mb-1">
                Email Address
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="brutal-input w-full pl-9 text-xs"
                />
                <Mail className="w-4 h-4 text-gray-500 absolute left-3 top-3" />
              </div>
            </div>

            <div>
              <label className="block font-headline font-bold text-xs uppercase text-[#1a1a1a] mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="brutal-input w-full pl-9 text-xs"
                />
                <Lock className="w-4 h-4 text-gray-500 absolute left-3 top-3" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="brutal-btn-primary w-full py-3 text-xs sm:text-sm flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-[#ffcc00]" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <span>Sign In To Platform</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="pt-2 text-center text-xs font-medium text-gray-600 border-t-2 border-[#1a1a1a]">
            New to CareerForge?{' '}
            <Link href="/register" className="font-bold uppercase text-[#0055ff] hover:underline">
              Create an account
            </Link>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t-2 border-[#1a1a1a] bg-[#f5f0e8] text-center text-xs text-gray-500 font-bold uppercase">
        Form Follows Function • Neo-Brutalist Architecture
      </div>
    </div>
  );
}
