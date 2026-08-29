import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  LayoutDashboard,
  FileUp,
  Sparkles,
  Mic,
  History,
  Compass,
  KanbanSquare,
  Settings,
  Cpu,
} from 'lucide-react';

const navItems = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Upload Resume', href: '/resume/upload', icon: FileUp },
  { label: 'Mock Interview', href: '/interview/setup', icon: Mic },
  { label: 'Interview Logs', href: '/interview/history', icon: History },
  { label: 'Job Search Hub', href: '/jobs', icon: Compass },
  { label: 'App Tracker', href: '/applications', icon: KanbanSquare },
  { label: 'AI Health & Settings', href: '/settings', icon: Settings },
];

export default function Sidebar({ isOpen, onClose }) {
  const router = useRouter();

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
        />
      )}

      <aside
        className={`fixed lg:static top-0 bottom-0 left-0 z-40 w-64 bg-[#f5f0e8] border-r-3 border-[#1a1a1a] flex flex-col justify-between transition-transform duration-200 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="p-4 space-y-6">
          <div className="p-3 bg-[#1a1a1a] text-white border-2 border-[#1a1a1a] shadow-brutal">
            <div className="flex items-center gap-2 mb-1">
              <Cpu className="w-4 h-4 text-[#ffcc00]" />
              <span className="font-headline font-black text-xs uppercase tracking-wider text-[#ffcc00]">
                Agentic Pipeline
              </span>
            </div>
            <p className="text-[11px] text-gray-300 font-medium leading-tight">
              6-Agent Orchestration Active with Offline Fallback
            </p>
          </div>

          <nav className="space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = router.pathname === item.href || (item.href !== '/dashboard' && router.pathname.startsWith(item.href));

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={`flex items-center gap-3 px-3.5 py-2.5 font-headline font-bold text-xs uppercase tracking-wider border-2 transition-all ${
                    isActive
                      ? 'bg-[#ffcc00] border-[#1a1a1a] text-[#1a1a1a] shadow-brutal translate-x-1'
                      : 'border-transparent text-[#1a1a1a] hover:bg-white hover:border-[#1a1a1a] hover:shadow-brutal'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-[#1a1a1a]' : 'text-[#0055ff]'}`} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Footer info banner */}
        <div className="p-4 border-t-3 border-[#1a1a1a] bg-white">
          <div className="text-[10px] font-bold uppercase text-gray-500 mb-1">
            CareerForge AI v1.0.0
          </div>
          <div className="text-xs font-black uppercase text-[#1a1a1a]">
            Bauhaus Edition
          </div>
        </div>
      </aside>
    </>
  );
}
