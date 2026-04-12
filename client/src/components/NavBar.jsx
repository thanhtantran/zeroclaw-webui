import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';

const tabs = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/service', label: 'Service' },
  { to: '/config', label: 'Config' },
  { to: '/channels', label: 'Channels' },
  { to: '/cron', label: 'Cron' },
  { to: '/auth', label: 'Auth' },
  { to: '/diagnostics', label: 'Diagnostics' },
  { to: '/update', label: 'Update' },
  { to: '/skills', label: 'Skills' },
  { to: '/memory', label: 'Memory' },
];

function NavBar() {
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('zeroclaw-theme') || 'dark';
    } catch (e) {
      return 'dark';
    }
  });

  useEffect(() => {
    const isDark = theme === 'dark';
    document.documentElement.classList.toggle('dark', isDark);
    document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
    try {
      localStorage.setItem('zeroclaw-theme', theme);
    } catch (e) {
      // ignore
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  };

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
      <div className="max-w-none w-full flex items-center gap-3 px-4 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <img
            src="/zeroclaw-logo.png"
            alt="ZeroClaw"
            className="h-8 w-8 shrink-0 rounded-md"
          />
          <div className="min-w-0">
            <div className="text-sm font-semibold leading-5 truncate">ZeroClaw Web UI</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              ZeroClaw Manager
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-x-auto">
          <div className="flex items-center justify-center gap-1 min-w-max">
            {tabs.map((tab) => (
              <NavLink
                key={tab.to}
                to={tab.to}
                className={({ isActive }) =>
                  [
                    'inline-flex items-center rounded-md px-2 py-1 text-xs font-medium transition-colors',
                    isActive
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                      : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-900/70 dark:hover:text-slate-100',
                  ].join(' ')
                }
              >
                {tab.label}
              </NavLink>
            ))}
          </div>
        </nav>

        <button
          type="button"
          onClick={toggleTheme}
          className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          aria-label="Toggle light/dark mode"
        >
          <span
            className={[
              'inline-block h-2 w-2 rounded-full',
              theme === 'dark' ? 'bg-emerald-400' : 'bg-amber-400',
            ].join(' ')}
          />
          <span>{theme === 'dark' ? 'Dark' : 'Light'}</span>
        </button>
      </div>
    </header>
  );
}

export default NavBar;

