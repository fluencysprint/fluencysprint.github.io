import React, { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { getActiveProfile } from '../lib/profile';
import { getLanguagePack } from '../languages';
import { onSaveStatus, type SaveStatus } from '../lib/storageAdapter';

function SaveIndicator() {
  const [status, setStatus] = useState<SaveStatus>({ kind: 'idle' });
  useEffect(() => onSaveStatus(setStatus), []);
  if (status.kind === 'idle') return null;
  const label =
    status.kind === 'saving' ? 'Saving...' :
    status.kind === 'saved' ? 'Saved' :
    status.kind === 'error' ? 'Save failed' : null;
  if (!label) return null;
  const color =
    status.kind === 'error' ? 'text-red-500' :
    status.kind === 'saving' ? 'text-slate-400 dark:text-slate-500' : 'text-emerald-500';
  return (
    <span className={`text-[10px] font-medium ${color}`} data-testid="save-indicator">
      {label}
    </span>
  );
}

const navItems = [
  { to: '/', label: 'Home', icon: '⌂', exact: true },
  { to: '/sprint', label: 'Sprint', icon: '⚡' },
  { to: '/skills', label: 'Skills', icon: '◎' },
  { to: '/review', label: 'Review', icon: '↻' },
  { to: '/writing', label: 'Write', icon: '✎' },
  { to: '/listening', label: 'Listen', icon: '🎧' },
  { to: '/speaking', label: 'Speak', icon: '◉' },
  { to: '/exam', label: 'Exam', icon: '☑' },
  { to: '/settings', label: 'Settings', icon: '⚙' },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const profile = getActiveProfile();
  const pack = profile ? getLanguagePack(profile.targetLanguage) : null;
  const tagline = pack?.metadata.promptCopy.coachTagline ?? 'A1 → C1 coach';

  const navLink = (item: (typeof navItems)[0], mobile = false) => (
    <NavLink
      key={item.to}
      to={item.to}
      end={item.exact}
      onClick={() => mobile && setMobileOpen(false)}
      className={({ isActive }) =>
        `flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-colors
        ${isActive
          ? 'bg-indigo-600 text-white'
          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-800 dark:hover:text-white'
        }
        ${mobile ? 'w-full' : ''}`
      }
    >
      <span className="text-base leading-none">{item.icon}</span>
      <span>{item.label}</span>
    </NavLink>
  );

  const isFullscreen = ['/diagnostic', '/onboarding'].some(p => location.pathname.startsWith(p));

  if (isFullscreen) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
        {children}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-52 shrink-0 bg-white dark:bg-slate-800 border-r border-slate-100 dark:border-slate-700 pt-6 pb-4 px-3 gap-1">
        <div className="px-3 mb-5">
          <div className="text-base font-bold text-slate-800 dark:text-white">Fluency Sprint</div>
          <div className="text-xs text-slate-400 dark:text-slate-400 leading-snug">{pack?.metadata.label ?? ''} · A1 → C1</div>
          {profile && (
            <div
              className="mt-1.5 text-xs text-indigo-600 dark:text-indigo-400 font-medium truncate"
              title={profile.displayName ? `${pack?.metadata.label} · ${profile.displayName}` : pack?.metadata.label}
            >
              {profile.displayName ? profile.displayName : 'Default profile'}
            </div>
          )}
          <div className="mt-1"><SaveIndicator /></div>
        </div>
        {navItems.map(item => navLink(item))}
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 px-4 mobile-header-safe flex items-center justify-between">
        <div className="min-w-0 flex-1 mr-2">
          <div className="flex items-center gap-2">
            <div className="text-sm font-bold text-slate-800 dark:text-white">Fluency Sprint</div>
            <SaveIndicator />
          </div>
          {profile && (
            <div className="text-[10px] text-indigo-600 dark:text-indigo-400 truncate" title={profile.displayName ?? pack?.metadata.label}>
              {pack?.metadata.label ?? ''}
              {profile.displayName ? ` · ${profile.displayName}` : ''}
            </div>
          )}
        </div>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
        >
          {mobileOpen ? '✕' : '☰'}
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-30" onClick={() => setMobileOpen(false)}>
          <div className="absolute inset-y-0 left-0 w-56 bg-white dark:bg-slate-800 shadow-xl pt-16 px-3 pb-4" onClick={e => e.stopPropagation()}>
            {navItems.map(item => navLink(item, true))}
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 min-w-0 md:pt-0 pt-14">
        <div className="max-w-4xl mx-auto px-4 py-6">
          {children}
        </div>
      </main>
    </div>
  );
}
