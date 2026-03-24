import React, { useEffect, useMemo, useState, useCallback } from 'react';
import Terminal from '../components/Terminal.jsx';

function MemoryPage() {
  const [stats, setStats] = useState({ loading: true, error: null, raw: '' });
  const [list, setList] = useState({ loading: true, error: null, raw: '', entries: [] });
  const [query, setQuery] = useState('');
  const [selectedKey, setSelectedKey] = useState('');
  const [selected, setSelected] = useState({ loading: false, error: null, raw: '' });

  const loadStats = useCallback(async () => {
    setStats((p) => ({ ...p, loading: true, error: null }));
    try {
      const res = await fetch('/api/memory/stats');
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || `Stats failed: ${res.status}`);
      setStats({ loading: false, error: null, raw: json?.raw || '' });
    } catch (err) {
      setStats({ loading: false, error: err.message, raw: '' });
    }
  }, []);

  const loadList = useCallback(async () => {
    setList((p) => ({ ...p, loading: true, error: null }));
    try {
      const res = await fetch('/api/memory/list');
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || `List failed: ${res.status}`);
      setList({
        loading: false,
        error: null,
        raw: json?.raw || '',
        entries: Array.isArray(json?.entries) ? json.entries : [],
      });
    } catch (err) {
      setList({ loading: false, error: err.message, raw: '', entries: [] });
    }
  }, []);

  const loadOne = useCallback(async (key) => {
    const k = String(key || '').trim();
    if (!k) return;
    setSelectedKey(k);
    setSelected({ loading: true, error: null, raw: '' });
    try {
      const res = await fetch(`/api/memory/get?key=${encodeURIComponent(k)}`);
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || `Get failed: ${res.status}`);
      setSelected({ loading: false, error: null, raw: json?.raw || '' });
    } catch (err) {
      setSelected({ loading: false, error: err.message, raw: '' });
    }
  }, []);

  useEffect(() => {
    loadStats();
    loadList();
  }, [loadStats, loadList]);

  const filteredEntries = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return list.entries || [];
    return (list.entries || []).filter((e) => String(e.key || '').toLowerCase().includes(q));
  }, [list.entries, query]);

  return (
    <div className="space-y-3">
      <header className="space-y-1">
        <h1 className="text-lg font-semibold">Memory</h1>
        <p className="text-xs text-slate-400">
          Quản lý memory entries qua <code>zeroclaw memory</code>.
        </p>
      </header>

      <section className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <div className="space-y-2 lg:col-span-1">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-200">Entries</h2>
            <button
              type="button"
              onClick={loadList}
              className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-800"
              disabled={list.loading}
            >
              {list.loading ? 'Loading…' : 'Refresh'}
            </button>
          </div>

          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search key…"
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100"
          />

          {list.error && (
            <div className="rounded-lg border border-rose-800/60 bg-rose-950/40 p-3 text-xs text-rose-200">
              {list.error}
            </div>
          )}

          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-2 text-xs">
            <div className="max-h-[60vh] overflow-auto">
              {filteredEntries.length === 0 ? (
                <div className="p-2 text-[11px] text-slate-500">No entries.</div>
              ) : (
                filteredEntries.map((e) => {
                  const isActive = e.key === selectedKey;
                  return (
                    <button
                      key={e.key}
                      type="button"
                      onClick={() => loadOne(e.key)}
                      className={[
                        'w-full text-left rounded-md px-2 py-1.5 transition-colors',
                        isActive
                          ? 'bg-emerald-500/15 text-emerald-300'
                          : 'hover:bg-slate-900/70 text-slate-200',
                      ].join(' ')}
                    >
                      <div className="text-[11px] font-medium break-all">{e.key}</div>
                      <div className="text-[10px] text-slate-500 break-all">{e.line}</div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <div className="space-y-3 lg:col-span-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-200">Stats</h2>
            <button
              type="button"
              onClick={loadStats}
              className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-800"
              disabled={stats.loading}
            >
              {stats.loading ? 'Loading…' : 'Refresh'}
            </button>
          </div>

          {stats.error && (
            <div className="rounded-lg border border-rose-800/60 bg-rose-950/40 p-3 text-xs text-rose-200">
              {stats.error}
            </div>
          )}

          <Terminal title="Memory Stats" text={stats.raw || ''} />

          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-200">Get</h2>
            <div className="text-[11px] text-slate-400 truncate">
              {selectedKey ? `key: ${selectedKey}` : 'Chọn 1 entry ở bên trái'}
            </div>
          </div>

          {selected.error && (
            <div className="rounded-lg border border-rose-800/60 bg-rose-950/40 p-3 text-xs text-rose-200">
              {selected.error}
            </div>
          )}

          <Terminal title="Memory Value" text={selected.loading ? 'Loading…' : (selected.raw || '')} />
        </div>
      </section>
    </div>
  );
}

export default MemoryPage;