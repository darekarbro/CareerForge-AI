import React, { useState } from 'react';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import Link from 'next/link';
import { useAuthStore } from '../../store/authStore';

export default function AppShell({ children, noSidebar = false }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const user = useAuthStore((state) => state.user);

  return (
    <div className="min-h-screen bg-[var(--bg-main)] text-[var(--text-main)] flex flex-col selection:bg-[#ffcc00] selection:text-[#1a1a1a] transition-colors duration-200">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <Navbar sidebarOpen={sidebarOpen} onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
      <div className="flex-1 flex lg:items-start">
        {!noSidebar && (
          <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        )}
        <main id="main-content" tabIndex={-1} className="flex-1 min-w-0 w-full max-w-7xl mx-auto p-4 lg:p-8 overflow-y-visible">
          {user && !user.emailVerifiedAt && <div role="status" className="border-2 border-black bg-yellow-100 text-black p-4 mb-6 text-sm">Verify your email to start AI processing. <Link href="/account" className="underline font-bold">Manage verification and AI sharing</Link></div>}
          {children}
        </main>
      </div>
    </div>
  );
}
