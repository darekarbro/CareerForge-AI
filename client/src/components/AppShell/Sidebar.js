import React, { useEffect, useRef } from 'react';
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
  { label: 'My profile', href: '/profile', icon: FileUp },
  { label: 'My resumes', href: '/resumes', icon: FileUp },
  { label: 'Evidence library', href: '/evidence', icon: FileUp },
  { label: 'Resume copilot', href: '/copilot', icon: Sparkles },
  { label: 'Job workspaces', href: '/workspaces', icon: Compass },
  { label: 'Interview practice', href: '/interview/setup', icon: Mic },
  { label: 'Practice history', href: '/interview/history', icon: History },
  { label: 'Find jobs', href: '/jobs', icon: Compass },
  { label: 'Applications', href: '/applications', icon: KanbanSquare },
  { label: 'Activity', href: '/activity', icon: History },
  { label: 'Settings', href: '/settings', icon: Settings },
  { label: 'Account & privacy', href: '/account', icon: Settings },
];

export default function Sidebar({ isOpen, onClose }) {
  const router = useRouter();
  const panel = useRef();
  useEffect(() => {
    if (!isOpen || window.innerWidth >= 1024) return;
    const previous = document.activeElement, overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden'; panel.current?.querySelector('button,a')?.focus();
    const keydown = (event) => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab') return;
      const items = [...panel.current.querySelectorAll('button,a[href]')], first = items[0], last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', keydown);
    return () => { document.removeEventListener('keydown', keydown); document.body.style.overflow = overflow; previous?.focus?.(); };
  }, [isOpen, onClose]);

  return (
    <>
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
        />
      )}

      <aside
        ref={panel} id="main-navigation" aria-label="Main navigation"
        className={`fixed lg:sticky top-0 left-0 z-40 w-64 h-dvh overflow-y-auto flex-shrink-0 flex flex-col justify-between border-r-3 border-[#1a1a1a] bg-[var(--panel-bg)] text-[var(--text-main)] transition-transform duration-200 ease-in-out lg:top-[72px] lg:h-[calc(100vh-72px)] lg:overflow-y-auto ${
          isOpen ? 'translate-x-0' : 'hidden lg:flex lg:translate-x-0'
        }`}
      >
        <div className="p-4 space-y-6">
          <button type="button" onClick={onClose} className="lg:hidden border-2 px-3 py-2 text-sm">Close navigation</button>
          <div className="p-3 bg-[#1a1a1a] text-white border-2 border-[#1a1a1a] shadow-brutal">
            <div className="flex items-center gap-2 mb-1">
              <Cpu className="w-4 h-4 text-[#ffcc00]" />
              <span className="font-headline font-black text-xs uppercase tracking-wider text-[#ffcc00]">
                Your career workspace
              </span>
            </div>
            <p className="text-[11px] text-gray-300 font-medium leading-tight">
              Build a resume, prepare for interviews and track your next move.
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
                  className={`flex items-center gap-3 px-3.5 py-2.5 font-headline font-bold text-sm border-2 transition-all ${
                    isActive
                      ? 'bg-[#ffcc00] border-[#1a1a1a] text-[#1a1a1a] shadow-brutal translate-x-1'
                      : 'border-transparent text-[var(--text-main)] hover:bg-[var(--surface-strong)] hover:border-[#1a1a1a] hover:shadow-brutal'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-[#1a1a1a]' : 'text-[#0055ff]'}`} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="p-4 border-t-3 border-[#1a1a1a] bg-[var(--surface-elevated)]">
          <div className="text-[10px] font-bold uppercase text-[var(--text-muted)] mb-1">
            CareerForge AI v1.0.0
          </div>
          <div className="text-xs font-black uppercase text-[var(--text-main)]">
            Bauhaus Edition
          </div>
        </div>
      </aside>
    </>
  );
}
