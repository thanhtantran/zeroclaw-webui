import React, { useEffect, useState, useCallback, useRef } from 'react';
import StatusBadge from '../components/StatusBadge.jsx';
import Terminal from '../components/Terminal.jsx';

function DashboardPage() {
  const [statusData, setStatusData] = useState({ loading: true, error: null, data: null });
  const [serviceStatus, setServiceStatus] = useState({ loading: true, error: null, data: null });
  const [daemonState, setDaemonState] = useState({ loading: true, error: null, data: null });
  const [restartState, setRestartState] = useState({ running: false, error: null });

  const fetchAll = useCallback(async () => {
    try {
      // ZeroClaw status
      setStatusData((prev) => ({ ...prev, loading: true, error: null }));
      const [statusRes, svcRes, daemonRes] = await Promise.all([
        fetch('/api/service/status'),
        fetch('/api/service/service-status'),
        fetch('/api/diagnostics/daemon'),
      ]);

      if (!statusRes.ok) {
        throw new Error(`Status error: ${statusRes.status}`);
      }
      if (!svcRes.ok) {
        throw new Error(`Service status error: ${svcRes.status}`);
      }
      // Daemon có thể 404 (chưa chạy) -> không coi là fatal

      const statusJson = await statusRes.json();
      const svcJson = await svcRes.json();

      setStatusData({ loading: false, error: null, data: statusJson });
      setServiceStatus({ loading: false, error: null, data: svcJson });

      if (daemonRes.ok) {
        const daemonJson = await daemonRes.json();
        setDaemonState({ loading: false, error: null, data: daemonJson });
      } else {
        setDaemonState({
          loading: false,
          error: daemonRes.status === 404 ? 'Daemon state not found' : `Daemon error: ${daemonRes.status}`,
          data: null,
        });
      }
    } catch (err) {
      setStatusData({ loading: false, error: err.message, data: null });
      setServiceStatus((prev) => ({ ...prev, loading: false, error: err.message }));
      setDaemonState((prev) => ({ ...prev, loading: false, error: err.message, data: null }));
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const id = setInterval(fetchAll, 10000);
    return () => clearInterval(id);
  }, [fetchAll]);

  const handleRestart = async () => {
    if (restartState.running) return;
    const ok = window.confirm('Restart ZeroClaw service?');
    if (!ok) return;
    setRestartState({ running: true, error: null });
    try {
      const res = await fetch('/api/service/restart', { method: 'POST' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = body.error || `Restart failed: ${res.status}`;
        setRestartState({ running: false, error: msg });
        return;
      }
      setRestartState({ running: false, error: null });
      // Sau khi restart, refresh trạng thái
      fetchAll();
    } catch (err) {
      setRestartState({ running: false, error: err.message });
    }
  };

  // Agent (CLI) state
  const agentWsRef = useRef(null);
  const [agentStatus, setAgentStatus] = useState('disconnected'); // disconnected | connecting | connected
  const [agentLog, setAgentLog] = useState('');
  const [agentInput, setAgentInput] = useState('');

  const connectAgent = () => {
    if (agentWsRef.current && agentWsRef.current.readyState === WebSocket.OPEN) return;
    setAgentStatus('connecting');

    const loc = window.location;
    const protocol = loc.protocol === 'https:' ? 'wss:' : 'ws:';

    const candidates = [`${protocol}//${loc.host}/ws/agent`];
    if (loc.port === '5173') {
      candidates.push(`${protocol}//${loc.hostname}:3000/ws/agent`);
    }

    const tryConnect = (idx) => {
      if (idx >= candidates.length) {
        setAgentStatus('disconnected');
        return;
      }

      const wsUrl = candidates[idx];
      const ws = new WebSocket(wsUrl);
      agentWsRef.current = ws;

      let opened = false;
      const openTimer = setTimeout(() => {
        if (!opened) {
          try { ws.close(); } catch (_) {}
        }
      }, 1500);

      ws.onopen = () => {
        opened = true;
        clearTimeout(openTimer);
        setAgentStatus('connected');
      };
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg.event === 'output') {
            setAgentLog((prev) => prev + String(msg.data || ''));
          } else if (msg.event === 'status') {
            setAgentStatus(String(msg.status || 'connected'));
          } else if (msg.event === 'error') {
            setAgentLog((prev) => prev + `\n[error] ${msg.error || 'Unknown error'}\n`);
          }
        } catch (e) {
          setAgentLog((prev) => prev + `\n[recv] ${ev.data}\n`);
        }
      };
      ws.onclose = () => {
        clearTimeout(openTimer);
        if (!opened) {
          agentWsRef.current = null;
          tryConnect(idx + 1);
          return;
        }
        setAgentStatus('disconnected');
        agentWsRef.current = null;
      };
      ws.onerror = () => {
        clearTimeout(openTimer);
        if (!opened) {
          try { ws.close(); } catch (_) {}
          return;
        }
        setAgentStatus('disconnected');
      };
    };

    tryConnect(0);
  };

  const disconnectAgent = () => {
    if (agentWsRef.current) {
      try { agentWsRef.current.close(); } catch (_) {}
      agentWsRef.current = null;
    }
    setAgentStatus('disconnected');
  };

  const sendAgent = () => {
    const text = String(agentInput || '').trim();
    if (!text) return;
    const ws = agentWsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      alert('Agent chưa kết nối. Hãy bấm Connect trước.');
      return;
    }
    ws.send(JSON.stringify({ type: 'input', data: text }));
    setAgentInput('');
  };

  const deriveServiceBadge = () => {
    if (statusData.loading) return { label: 'Loading…', tone: 'gray' };
    if (statusData.error) return { label: 'Error', tone: 'red' };
    if (!statusData.data) return { label: 'Unknown', tone: 'gray' };
    return { label: 'Healthy', tone: 'green' };
  };

  const deriveDaemonInfo = () => {
    if (daemonState.loading) {
      return { label: 'Loading…', uptime: '—', statusText: '—', tone: 'gray' };
    }
    if (daemonState.error) {
      return { label: 'Unavailable', uptime: '—', statusText: daemonState.error, tone: 'red' };
    }
    const d = daemonState.data || {};
    const lastHeartbeat = d.last_heartbeat || d.lastHeartbeat || d.last_seen || 'Unknown';
    const uptime = d.uptime || d.uptime_secs || d.uptime_seconds || '—';
    const status = d.status || d.state || 'OK';
    const tone = status && String(status).toLowerCase().includes('error') ? 'red' : 'green';
    return {
      label: lastHeartbeat,
      uptime,
      statusText: status,
      tone,
    };
  };

  const serviceBadge = deriveServiceBadge();
  const daemonInfo = deriveDaemonInfo();

  const provider = statusData.data?.provider || '—';
  const model = statusData.data?.model || '—';
  const workspace = statusData.data?.workspace || statusData.data?.config_path || '—';

  const serviceLines = serviceStatus.data?.lines || [];
  const serviceSummary =
    serviceLines.find((l) => /active|running|healthy/i.test(l)) || serviceLines[0] || 'No data';

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-lg font-semibold">ZeroClaw Dashboard</h1>
        <p className="text-xs text-slate-400">
          Tổng quan trạng thái dịch vụ và hệ thống.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3 text-xs md:grid-cols-4">
        <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
          <div className="text-slate-400">Service</div>
          <div className="mt-1 flex items-center justify-between">
            <span className="font-medium">ZeroClaw</span>
            <StatusBadge status={serviceBadge.label} tone={serviceBadge.tone} />
          </div>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
          <div className="text-slate-400">Provider</div>
          <div className="mt-1 text-sm font-medium truncate">{provider}</div>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
          <div className="text-slate-400">Heartbeat</div>
          <div className="mt-1 flex flex-col gap-0.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-slate-400">Daemon</span>
              <StatusBadge status={daemonInfo.statusText} tone={daemonInfo.tone} />
            </div>
            <div className="text-[11px] text-slate-300">
              Last: {daemonInfo.label}
            </div>
            <div className="text-[11px] text-slate-400">Uptime: {daemonInfo.uptime}</div>
          </div>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
          <div className="text-slate-400">Workspace</div>
          <div className="mt-1 text-[11px] font-medium break-all">{workspace}</div>
        </div>
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-slate-200">Service status</h2>
            <p className="text-[11px] text-slate-400">
              {serviceSummary}
            </p>
          </div>
          <button
            type="button"
            onClick={handleRestart}
            disabled={restartState.running}
            className="inline-flex items-center rounded-md bg-rose-600 px-3 py-1.5 text-xs font-medium text-white shadow hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {restartState.running ? 'Restarting…' : 'Restart Service'}
          </button>
        </div>
        {restartState.error && (
          <p className="text-[11px] text-rose-400">
            {restartState.error}
          </p>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-200">Recent logs</h2>
        <Terminal
          title="Service Status"
          text={serviceStatus.data?.raw || ''}
        />
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-slate-200">Agent (CLI)</h2>
            <p className="text-[11px] text-slate-400">Giao tiếp trực tiếp qua lệnh <code>zeroclaw agent</code>.</p>
          </div>
          <div className="flex items-center gap-2">
            {agentStatus !== 'connected' ? (
              <button
                type="button"
                onClick={connectAgent}
                className="rounded-md bg-emerald-600 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-emerald-500"
              >
                Connect
              </button>
            ) : (
              <button
                type="button"
                onClick={disconnectAgent}
                className="rounded-md bg-rose-600 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-rose-500"
              >
                Disconnect
              </button>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-black/80 text-slate-100">
          <textarea
            readOnly
            value={agentLog}
            placeholder={agentStatus === 'connected' ? 'Agent đã kết nối. Bắt đầu trò chuyện…' : 'Chưa kết nối agent.'}
            className="h-48 w-full resize-none bg-transparent px-3 py-2 text-xs font-mono leading-relaxed outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={agentInput}
            onChange={(e) => setAgentInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') sendAgent(); }}
            placeholder="Nhập câu hỏi…"
            className="flex-1 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100"
            disabled={agentStatus !== 'connected'}
          />
          <button
            type="button"
            onClick={sendAgent}
            disabled={agentStatus !== 'connected'}
            className="rounded-md bg-emerald-600 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Send
          </button>
        </div>
      </section>
    </div>
  );
}

export default DashboardPage;

