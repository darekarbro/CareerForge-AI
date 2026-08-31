import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuthStore } from '../store/authStore';
import { ArrowRight, AlertCircle, Briefcase, Chrome, Loader2, Lock, Mail, User } from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();
  const register = useAuthStore((state) => state.register);
  const firebaseLogin = useAuthStore((state) => state.firebaseLogin);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    targetRolePreference: 'Fullstack Developer',
  });
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleRegister = async (e) => {
    e.preventDefault();
    if (formData.password.length < 6) {
      setErrorMessage('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    setErrorMessage('');

    const res = await register(formData);
    setLoading(false);

    if (res.success) {
      router.push('/dashboard');
    } else {
      setErrorMessage(res.message || 'Registration failed');
    }
  };

  const handleFirebaseGoogleSignUp = async () => {
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
          href="/login"
          className="px-3 py-1.5 border-2 border-[#1a1a1a] bg-white font-headline font-bold text-xs uppercase hover:bg-[#ffcc00] shadow-brutal transition-all"
        >
          Sign In
        </Link>
      </div>

      {/* Main Register Card */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-md bg-white border-4 border-[#1a1a1a] shadow-brutal-xl p-8 space-y-6">
          <div className="space-y-1">
            <span className="px-2 py-0.5 bg-[#0055ff] text-white border border-[#1a1a1a] font-headline font-black text-[10px] uppercase">
              Registration
            </span>
            <h2 className="font-headline font-black text-3xl uppercase tracking-tight text-[#1a1a1a]">
              Create Account
            </h2>
            <p className="text-xs text-gray-600 font-medium">
              Start building ATS-optimized resumes and mock interview scorecards.
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
            onClick={handleFirebaseGoogleSignUp}
            className="w-full border-2 border-[#1a1a1a] bg-white hover:bg-[#eaf2ff] text-[#1a1a1a] font-headline font-black uppercase text-[11px] py-3 flex items-center justify-center gap-2 shadow-brutal transition-all"
          >
            <Chrome className="w-4 h-4" />
            <span>Sign up with Google account</span>
          </button>

          <div className="relative flex items-center justify-center">
            <div className="absolute inset-x-0 top-1/2 h-px bg-[#1a1a1a]" />
            <span className="relative bg-white px-2 text-[10px] font-headline font-black uppercase tracking-[0.2em] text-gray-500">
              Or create with email
            </span>
          </div>

          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block font-headline font-bold text-xs uppercase text-[#1a1a1a] mb-1">
                Full Name
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Alex Morgan"
                  className="brutal-input w-full pl-9 text-xs"
                />
                <User className="w-4 h-4 text-gray-500 absolute left-3 top-3" />
              </div>
            </div>

            <div>
              <label className="block font-headline font-bold text-xs uppercase text-[#1a1a1a] mb-1">
                Email Address
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="alex@example.com"
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
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Minimum 6 characters"
                  className="brutal-input w-full pl-9 text-xs"
                />
                <Lock className="w-4 h-4 text-gray-500 absolute left-3 top-3" />
              </div>
            </div>

            <div>
              <label className="block font-headline font-bold text-xs uppercase text-[#1a1a1a] mb-1">
                Primary Target Role
              </label>
              <div className="relative">
                <select
                  value={formData.targetRolePreference}
                  onChange={(e) => setFormData({ ...formData, targetRolePreference: e.target.value })}
                  className="brutal-input w-full pl-9 text-xs font-bold"
                >
                  <option value="Fullstack Developer">Fullstack Developer</option>
                  <option value="Software Development Engineer (SDE)">Software Development Engineer (SDE)</option>
                  <option value="Backend Engineer">Backend Engineer</option>
                  <option value="Frontend Engineer">Frontend Engineer</option>
                  <option value="Data / ML Engineer">Data / ML Engineer</option>
                  <option value="DevOps & Cloud Engineer">DevOps & Cloud Engineer</option>
                  <option value="Product Manager">Product Manager</option>
                </select>
                <Briefcase className="w-4 h-4 text-gray-500 absolute left-3 top-3" />
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
                  <span>Creating Account...</span>
                </>
              ) : (
                <>
                  <span>Create Free Account</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="pt-2 text-center text-xs font-medium text-gray-600 border-t-2 border-[#1a1a1a]">
            Already have an account?{' '}
            <Link href="/login" className="font-bold uppercase text-[#0055ff] hover:underline">
              Sign in
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
