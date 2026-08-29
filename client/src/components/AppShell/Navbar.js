import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Bell, User, LogOut, Menu, Sparkles, Layers } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import NotificationsDrawer from './NotificationsDrawer';

export default function Navbar({ onToggleSidebar }) {
  const router = useRouter();
  const { user, logout, isAuthenticated } = useAuthStore();
  const [showNotifications, setShowNotifications] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-40 bg-[#f5f0e8] border-b-3 border-[#1a1a1a] px-4 lg:px-8 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={onToggleSidebar}
            className="lg:hidden p-1.5 border-2 border-[#1a1a1a] bg-white hover:bg-[#ffcc00] transition-colors"
          >
            <Menu className="w-5 h-5 text-[#1a1a1a]" />
          </button>

          <Link href="/dashboard" className="flex items-center gap-2 group">
            <div className="w-9 h-9 bg-[#1a1a1a] border-2 border-[#1a1a1a] flex items-center justify-center text-[#ffcc00] font-black text-xl shadow-brutal group-hover:bg-[#ffcc00] group-hover:text-[#1a1a1a] transition-colors">
              C
            </div>
            <div>
              <span className="font-headline font-black text-xl tracking-tight uppercase text-[#1a1a1a]">
                CareerForge<span className="text-[#0055ff]">.AI</span>
              </span>
              <span className="hidden sm:inline-block ml-2 px-1.5 py-0.2 bg-[#ffcc00] border border-[#1a1a1a] text-[10px] font-black uppercase">
                Bauhaus Engine
              </span>
            </div>
          </Link>
        </div>

        {isAuthenticated ? (
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowNotifications(true)}
              className="p-2 border-2 border-[#1a1a1a] bg-white hover:bg-[#ffcc00] shadow-brutal transition-all relative"
              title="Notifications"
            >
              <Bell className="w-5 h-5 text-[#1a1a1a]" />
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-[#e63b2e] border-2 border-[#1a1a1a] rounded-full"></span>
            </button>

            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 border-2 border-[#1a1a1a] bg-white shadow-brutal">
              <User className="w-4 h-4 text-[#0055ff]" />
              <span className="font-bold text-xs uppercase text-[#1a1a1a]">{user?.name || 'Candidate'}</span>
            </div>

            <button
              onClick={() => {
                logout();
                router.push('/login');
              }}
              className="p-2 border-2 border-[#1a1a1a] bg-white hover:bg-[#e63b2e] hover:text-white shadow-brutal transition-all"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="px-4 py-1.5 border-2 border-[#1a1a1a] bg-white font-bold text-xs uppercase hover:bg-[#eee9e0] transition-colors"
            >
              Login
            </Link>
            <Link
              href="/register"
              className="px-4 py-1.5 border-2 border-[#1a1a1a] bg-[#1a1a1a] text-white font-bold text-xs uppercase shadow-brutal hover:bg-[#ffcc00] hover:text-[#1a1a1a] transition-all"
            >
              Get Started
            </Link>
          </div>
        )}
      </header>

      <NotificationsDrawer
        isOpen={showNotifications}
        onClose={() => setShowNotifications(false)}
      />
    </>
  );
}
