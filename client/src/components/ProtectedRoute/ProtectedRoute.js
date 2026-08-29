import React, { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuthStore } from '../../store/authStore';
import { Loader2 } from 'lucide-react';

export default function ProtectedRoute({ children }) {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuthStore();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f5f0e8] flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-3 border-[#1a1a1a] bg-[#ffcc00] shadow-brutal flex items-center justify-center animate-spin">
          <Loader2 className="w-6 h-6 text-[#1a1a1a]" />
        </div>
        <span className="font-headline font-black uppercase text-sm tracking-wider">
          Initializing CareerForge...
        </span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return children;
}
