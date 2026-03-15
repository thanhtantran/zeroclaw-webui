import React, { useCallback, useEffect, useMemo, useState } from 'react';

const iconForStatus = (status) => {
  if (status === 'ok') return '✅';
  if (status === 'warning') return '⚠️';
  if (status === 'error') return '❌';
  return '•';
};

function DiagnosticsPage() {
  const [doctor, setDoctor] = useState({ loading: false, error: null, data: null });
  const [channelDoc, setChannelDoc] = useState({ loading: false, error: null, data: null });
  const [daemon, setDaemon] = useState({ loading: false, error: null, data: null });

  const runDoctor = useCallback(async () => {
    setDoctor({ loading: true, error: null, data: null });
    try {
      const res = await fetch('/api/diagnostics/doctor');
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = json?.error || `Doctor failed: ${res.status}`;
        setDoctor({ loading: false, error: msg, data: null });
        return;
      }
      setDoctor({ loading: false, error: null, data: json });
    } catch (err) {
      setDoctor({ loading: false, error: err.message, data: null });
    }
  }, []);

  const runChannelDoctor = useCallback(async () => {
    setChannelDoc({ loading: true, error: null, data: null });
    try {
      const res = await fetch('/api/diagnostics/channel');
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = json?.error || `Channel doctor failed: ${res.status}`;
        setChannelDoc({ loading: false, error: msg, data: null });
        return;
      }
      setChannelDoc({ loading: false, error: null, data: json });
    } catch (err) {
      setChannelDoc({ loading: false, error: err.message, data: null });
    }
  }, []);

  const loadDaemon = useCallback(async () => {
    setDaemon({ loading: true, error: null, data: null });
    try {
      const res = await fetch('/api/diagnostics/daemon');
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = json?.error || `Daemon state failed: ${res.status}`;
        setDaemon({ loading: false, error: msg, data: null });
        return;
      }
      setDaemon({ loading: false, error: null, data: json });
    } catch (err) {
      setDaemon({ loading: false, error: err.message, data: null });
    }
  }, []);

  useEffect(() => {
    runDoctor();
    runChannelDoctor();
    loadDaemon();
  }, [runDoctor, runChannelDoctor, loadDaemon]);

  const daemonJsonPretty = useMemo(() => {
    if (!daemon.data) return '';
    try {
      return JSON.stringify(daemon.data, null, 2);
    } catch {
      return '';
    }
  }, [daemon.data]);

  const heartbeatStatus = useMemo(() => {
    if (!daemon.data || !daemon.data.components) return null;
    const heartbeat = daemon.data.components.heartbeat;
    if (!heartbeat) return null;
    const lastOkStr = heartbeat.last_ok || heartbeat.updated_at;
    if (!lastOkStr) return null;
    const lastOkMs = Date.parse(lastOkStr);
    if (Number.isNaN(lastOkMs)) return null;
    const now = Date.now();
    const diffMs = now - lastOkMs;
    const diffMinutes = diffMs / 60000;
    const tooOld = diffMinutes > 5;
    return {
      lastOk: lastOkStr,
      diffMinutes: diffMinutes.toFixed(1),
      tooOld,
      status: heartbeat.status || 'ok',
    };
  }, [daemon.data]);

  return (
    <div className="space-y-3">
      <header className="space-y-1">
        <h1 className="text-lg font-semibold">Diagnostics</h1>
        <p className="text-xs text-slate-400">
          Chạy kiểm tra sức khỏe hệ thống và xem trạng thái daemon.
        </p>
      </header>

      {/* Doctor panel */}
      <section className="space-y-2 rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-xs">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-slate-200">ZeroClaw Doctor</h2>
            <p className="text-[11px] text-slate-400">
              Chạy <code>zeroclaw doctor</code> để kiểm tra cấu hình và môi trường.
            </p>
          </div>
          <button
            type="button"
            onClick={runDoctor}
            disabled={doctor.loading}
            className="rounded-md bg-slate-800 px-3 py-1.5 text-[11px] font-medium text-slate-100 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {doctor.loading ? 'Running…' : 'Run'}
          </button>
        </div>
        {doctor.error && (
          <p className="text-[11px] text-rose-400 mt-1">
            {doctor.error}
          </p>
        )}
        {doctor.data && (
          <div className="mt-2 max-h-64 overflow-auto rounded border border-slate-800 bg-slate-950/80 p-2 text-[11px]">
            {doctor.data.summary && (
              <p className="mb-1 text-[11px] text-slate-300">
                Summary: {doctor.data.summary}
              </p>
            )}
            {Object.entries(doctor.data.sections || {}).map(([section, checks]) => (
              <div key={section} className="mt-1">
                <div className="text-[11px] font-semibold text-slate-200">
                  [{section}]
                </div>
                <ul className="ml-2 mt-0.5 space-y-0.5">
                  {checks.map((c, idx) => (
                    <li key={idx} className="flex items-start gap-1">
                      <span className="mt-[1px]">
                        {iconForStatus(c.status)}
                      </span>
                      <span className="text-slate-200">
                        {c.label}
                        {c.detail && (
                          <span className="text-slate-400">: {c.detail}</span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Channel Doctor panel */}
      <section className="space-y-2 rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-xs">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-slate-200">Channel Doctor</h2>
            <p className="text-[11px] text-slate-400">
              Kiểm tra sức khỏe các kênh (Discord, Telegram, ...).
            </p>
          </div>
          <button
            type="button"
            onClick={runChannelDoctor}
            disabled={channelDoc.loading}
            className="rounded-md bg-slate-800 px-3 py-1.5 text-[11px] font-medium text-slate-100 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {channelDoc.loading ? 'Running…' : 'Run'}
          </button>
        </div>
        {channelDoc.error && (
          <p className="text-[11px] text-rose-400 mt-1">
            {channelDoc.error}
          </p>
        )}
        {channelDoc.data && (
          <div className="mt-2 max-h-40 overflow-auto rounded border border-slate-800 bg-slate-950/80 p-2 text-[11px]">
            {channelDoc.data.summary && (
              <p className="mb-1 text-[11px] text-slate-300">
                Summary: {channelDoc.data.summary}
              </p>
            )}
            <ul className="space-y-0.5">
              {(channelDoc.data.channels || []).map((c, idx) => (
                <li key={idx} className="flex items-start gap-1">
                  <span className="mt-[1px]">
                    {c.icon || iconForStatus(c.status)}
                  </span>
                  <span className="text-slate-200">
                    <span className="font-semibold">{c.name}</span>{' '}
                    <span className="text-slate-400">{c.detail}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* Daemon State panel */}
      <section className="space-y-2 rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-xs">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-slate-200">Daemon State</h2>
            <p className="text-[11px] text-slate-400">
              Trạng thái hiện tại của daemon và các component.
            </p>
          </div>
          <button
            type="button"
            onClick={loadDaemon}
            disabled={daemon.loading}
            className="rounded-md bg-slate-800 px-3 py-1.5 text-[11px] font-medium text-slate-100 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {daemon.loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
        {daemon.error && (
          <p className="text-[11px] text-rose-400 mt-1">
            {daemon.error}
          </p>
        )}

        {heartbeatStatus && (
          <div
            className={[
              'mt-2 rounded border px-2 py-1.5 text-[11px]',
              heartbeatStatus.tooOld
                ? 'border-amber-500/70 bg-amber-950/40 text-amber-100'
                : 'border-emerald-500/60 bg-emerald-950/20 text-emerald-100',
            ].join(' ')}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold">
                Heartbeat {heartbeatStatus.tooOld ? 'stale' : 'healthy'}
              </span>
              <span className="font-mono">
                {heartbeatStatus.diffMinutes} min ago
              </span>
            </div>
            <div className="mt-0.5 text-[10px]">
              Last OK: {heartbeatStatus.lastOk} (status: {heartbeatStatus.status})
            </div>
          </div>
        )}

        {daemonJsonPretty && (
          <pre className="mt-2 max-h-64 overflow-auto rounded border border-slate-800 bg-black/80 p-2 text-[11px] font-mono text-slate-100">
            {daemonJsonPretty}
          </pre>
        )}
      </section>
    </div>
  );
}

export default DiagnosticsPage;


