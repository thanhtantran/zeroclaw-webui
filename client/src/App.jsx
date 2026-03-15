import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import NavBar from './components/NavBar.jsx';
import DashboardPage from './pages/Dashboard.jsx';
import ConfigPage from './pages/Config.jsx';
import DiagnosticsPage from './pages/Diagnostics.jsx';
import UpdatePage from './pages/Update.jsx';
import SkillsPage from './pages/Skills.jsx';

function App() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-slate-100">
      <main className="flex-1 pb-16 px-3 pt-3 max-w-4xl mx-auto w-full">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/config" element={<ConfigPage />} />
          <Route path="/diagnostics" element={<DiagnosticsPage />} />
          <Route path="/update" element={<UpdatePage />} />
          <Route path="/skills" element={<SkillsPage />} />
        </Routes>
      </main>
      <NavBar />
    </div>
  );
}

export default App;

