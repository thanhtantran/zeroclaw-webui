import React, { useEffect, useRef, useState } from 'react';
import Terminal from '../components/Terminal.jsx';

function UpdatePage() {
  const [commits, setCommits] = useState([]);
  const [checkLoading, setCheckLoading] = useState(false);
  const [checkError, setCheckError] = useState(null);

  const [pullLoading, setPullLoading] = useState(false);
  const [pullResult, setPullResult] = useState('');
  const [pullError, setPullError] = useState(null);

  const [buildStatus, setBuildStatus] = useState({ status: 'idle', exitCode: null, error: null });
  const [buildLog, setBuildLog] = useState('');
  const wsRef = useRef(null);

  const appendLog = (chunk) => {
    setBuildLog((prev) => (prev ? `${prev}${chunk}` : chunk));
  };

  const connectWebSocket = () => {
    if (wsRef.current) return;
    const loc = window.location;
    const protocol = loc.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${loc.host}/ws/build`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.event === 'log') {
          appendLog(msg.data || '');
        } else if (msg.event === 'status') {
          setBuildStatus((prev) => ({
            ...prev,
            status: msg.status || prev.status,
          }));
        }
      } catch {
        appendLog(`${event.data}\n`);
      }
    };

    ws.onclose = () => {
      wsRef.current = null;
    };
    ws.onerror = () => {
      wsRef.current = null;
    };
  };

  useEffect(() => {
    // Lấy trạng thái build hiện tại khi vào trang + kết nối WS
    const loadStatus = async () => {
      try {
        const res = await fetch('/api/update/build-status');
        const json = await res.json().catch(() => null);
        if (res.ok && json) {
          setBuildStatus({
            status: json.status || 'idle',
            exitCode: json.exitCode ?? null,
            error: json.error || null,
          });
        }
      } catch {
        // ignore
      }
    };
    loadStatus();
    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  const handleCheck = async () => {
    setCheckLoading(true);
    setCheckError(null);
    try {
      const res = await fetch('/api/update/check');
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = json?.error || `Check failed: ${res.status}`;
        setCheckError(msg);
        setCommits([]);
        return;
      }
      setCommits(json.commits || []);
    } catch (err) {
      setCheckError(err.message);
      setCommits([]);
    } finally {
      setCheckLoading(false);
    }
  };

  const handlePull = async () => {
    const ok = window.confirm('Thực hiện git pull cho ZeroClaw repository?');
    if (!ok) return;
    setPullLoading(true);
    setPullError(null);
    setPullResult('');
    try {
      const res = await fetch('/api/update/pull', { method: 'POST' });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = json?.error || `Pull failed: ${res.status}`;
        setPullError(msg);
      }
      const text = json
        ? `exitCode: ${json.exitCode}\n\nSTDOUT:\n${json.stdout || ''}\n\nSTDERR:\n${
            json.stderr || ''
          }`
        : `HTTP ${res.status}`;
      setPullResult(text);
    } catch (err) {
      setPullError(err.message);
    } finally {
      setPullLoading(false);
    }
  };

  const handleBuild = async () => {
    if (buildStatus.status === 'running') return;
    const ok = window.confirm('Bắt đầu build ZeroClaw? Quá trình có thể mất vài phút.');
    if (!ok) return;
    try {
      const res = await fetch('/api/update/build', { method: 'POST' });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = json?.error || `Build failed to start: ${res.status}`;
        appendLog(`\n[error] ${msg}\n`);
        setBuildStatus((prev) => ({ ...prev, status: 'failed', error: msg }));
        return;
      }
      setBuildLog('');
      setBuildStatus((prev) => ({ ...prev, status: 'running', error: null }));
      connectWebSocket();
    } catch (err) {
      appendLog(`\n[error] ${err.message}\n`);
      setBuildStatus((prev) => ({ ...prev, status: 'failed', error: err.message }));
    }
  };

  const buildStatusLabel = (() => {
    const s = (buildStatus.status || 'idle').toLowerCase();
    if (s === 'running') return 'Building…';
    if (s === 'success') return 'Last build: success';
    if (s === 'failed') return 'Last build: failed';
    return 'Idle';
  })();

  return (
    <div className="space-y-3">
      <header className="space-y-1">
        <h1 className="text-lg font-semibold">Update</h1>
        <p className="text-xs text-slate-400">
          Kiểm tra commit mới, git pull và build ZeroClaw.
        </p>
      </header>

      <section className="space-y-2">
        <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="space-y-0.5">
              <h2 className="text-sm font-semibold text-slate-200">Repository</h2>
              <p className="text-[11px] text-slate-400">
                Kiểm tra commit mới, pull và trigger build.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleCheck}
                disabled={checkLoading}
                className="rounded-md bg-slate-800 px-3 py-1.5 text-[11px] font-medium text-slate-100 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {checkLoading ? 'Checking…' : 'Check for Updates'}
              </button>
              <button
                type="button"
                onClick={handlePull}
                disabled={pullLoading}
                className="rounded-md bg-slate-800 px-3 py-1.5 text-[11px] font-medium text-slate-100 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {pullLoading ? 'Pulling…' : 'Pull'}
              </button>
              <button
                type="button"
                onClick={handleBuild}
                disabled={buildStatus.status === 'running'}
                className="rounded-md bg-emerald-600 px-3 py-1.5 text-[11px] font-medium text-white shadow hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {buildStatus.status === 'running' ? 'Building…' : 'Build'}
              </button>
            </div>
          </div>

          {checkError && (
            <p className="mt-2 text-[11px] text-rose-400">
              {checkError}
            </p>
          )}

          {commits.length > 0 && (
            <div className="mt-3 max-h-40 overflow-auto rounded border border-slate-800 bg-slate-950/80 p-2">
              <p className="mb-1 text-[11px] text-slate-300">
                {commits.length} commit mới trên <code>origin/main</code>:
              </p>
              <ul className="space-y-0.5 text-[11px] font-mono text-slate-200">
                {commits.map((c) => (
                  <li key={c.hash}>
                    <span className="text-slate-400">{c.hash.slice(0, 8)}</span>{' '}
                    <span>{c.summary}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {pullResult && (
            <div className="mt-3 max-h-40 overflow-auto rounded border border-slate-800 bg-black/80 p-2 text-[11px] font-mono text-slate-100">
              {pullResult}
            </div>
          )}
          {pullError && (
            <p className="mt-1 text-[11px] text-rose-400">
              {pullError}
            </p>
          )}

          <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400">
            <span>
              Build status: <span className="text-slate-200">{buildStatusLabel}</span>
              {buildStatus.exitCode !== null && (
                <span className="ml-1 text-slate-500">(exitCode: {buildStatus.exitCode})</span>
              )}
            </span>
            {buildStatus.error && (
              <span className="text-rose-400">
                {buildStatus.error}
              </span>
            )}
          </div>
        </div>

        <Terminal title="Build Log" text={buildLog} />
      </section>
    </div>
  );
}

export default UpdatePage;

