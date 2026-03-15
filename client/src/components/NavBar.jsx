import React from 'react';
import { NavLink } from 'react-router-dom';

const tabs = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/config', label: 'Config' },
  { to: '/diagnostics', label: 'Diagnostics' },
  { to: '/update', label: 'Update' },
  { to: '/skills', label: 'Skills' },
];

function NavBar() {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 border-t border-slate-800 bg-slate-950/95 backdrop-blur">
      <div className="max-w-4xl mx-auto flex items-stretch justify-between px-1 py-1">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              [
                'flex-1 flex flex-col items-center justify-center text-xs py-1.5 rounded-md mx-0.5 transition-colors',
                isActive
                  ? 'text-emerald-400 bg-slate-900'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/70',
              ].join(' ')
            }
          >
            <span className="font-medium">{tab.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

export default NavBar;

