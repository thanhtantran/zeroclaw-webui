import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import NavBar from './components/NavBar.jsx';
import DashboardPage from './pages/Dashboard.jsx';
import ConfigPage from './pages/Config.jsx';
import DiagnosticsPage from './pages/Diagnostics.jsx';
import UpdatePage from './pages/Update.jsx';
import SkillsPage from './pages/Skills.jsx';
import MemoryPage from './pages/Memory.jsx';
import ServicePage from './pages/Service.jsx';
import ChannelsPage from './pages/Channels.jsx';
import CronPage from './pages/Cron.jsx';
import AuthPage from './pages/Auth.jsx';

function App() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 dark:bg-background dark:text-slate-100">
      <NavBar />
      <main className="flex-1 px-4 py-4 max-w-none w-full">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/service" element={<ServicePage />} />
          <Route path="/config" element={<ConfigPage />} />
          <Route path="/diagnostics" element={<DiagnosticsPage />} />
          <Route path="/update" element={<UpdatePage />} />
          <Route path="/skills" element={<SkillsPage />} />
          <Route path="/memory" element={<MemoryPage />} />
          <Route path="/channels" element={<ChannelsPage />} />
          <Route path="/cron" element={<CronPage />} />
          <Route path="/auth" element={<AuthPage />} />
        </Routes>
      </main>
      <footer className="border-t border-slate-200 bg-white/60 px-3 py-3 text-center text-[11px] text-slate-500 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-400">
        Được tạo ra with ❤ bởi{' '}
        <a
          href="https://github.com/thanhtantran"
          target="_blank"
          rel="noreferrer"
          className="font-medium text-slate-700 hover:underline dark:text-slate-200"
        >
          Tony Trần
        </a>
      </footer>
    </div>
  );
}

export default App;

