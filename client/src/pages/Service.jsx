import React, { useState, useEffect } from 'react';
import StatusBadge from '../components/StatusBadge.jsx';

function ServicePage() {
  const [serviceStatus, setServiceStatus] = useState({ loading: true, data: null, error: null });
  const [actionState, setActionState] = useState({ action: null, loading: false, result: null });

  const fetchServiceStatus = async () => {
    setServiceStatus({ loading: true, data: null, error: null });
    try {
      const res = await fetch('/api/service/service-status');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch service status');
      setServiceStatus({ loading: false, data, error: null });
    } catch (err) {
      setServiceStatus({ loading: false, data: null, error: err.message });
    }
  };

  const handleServiceAction = async (action) => {
    const confirmMessages = {
      install: 'Install ZeroClaw as a system service?',
      start: 'Start ZeroClaw service?',
      stop: 'Stop ZeroClaw service?',
      restart: 'Restart ZeroClaw service?',
    };

    if (!confirm(confirmMessages[action])) return;

    setActionState({ action, loading: true, result: null });
    try {
      const res = await fetch(`/api/service/${action}`, { method: 'POST' });
      const data = await res.json();
      setActionState({ action, loading: false, result: data });
      if (res.ok && data.exitCode === 0) {
        setTimeout(fetchServiceStatus, 2000);
      }
    } catch (err) {
      setActionState({ action, loading: false, result: { error: err.message } });
    }
  };

  useEffect(() => {
    fetchServiceStatus();
    const interval = setInterval(fetchServiceStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  const deriveServiceBadge = () => {
    if (serviceStatus.loading) return { label: 'Loading…', tone: 'gray' };
    if (serviceStatus.error) return { label: 'Error', tone: 'red' };
    if (!serviceStatus.data) return { label: 'Unknown', tone: 'gray' };
    
    const raw = serviceStatus.data.raw || '';
    if (/active|running/i.test(raw)) return { label: 'Running', tone: 'green' };
    if (/inactive|stopped/i.test(raw)) return { label: 'Stopped', tone: 'amber' };
    if (/failed|error/i.test(raw)) return { label: 'Failed', tone: 'red' };
    return { label: 'Unknown', tone: 'gray' };
  };

  const badge = deriveServiceBadge();

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Service Status</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Current status of ZeroClaw system service
            </p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={badge.label} tone={badge.tone} />
            <button
              onClick={fetchServiceStatus}
              disabled={serviceStatus.loading}
              className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {serviceStatus.loading ? 'Loading...' : 'Refresh'}
            </button>
          </div>
        </div>

        {serviceStatus.error && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-300">
            {serviceStatus.error}
          </div>
        )}

        {serviceStatus.data && (
          <pre className="overflow-auto rounded-md bg-slate-50 p-3 text-xs dark:bg-slate-950">
            {serviceStatus.data.raw || 'No service information available'}
          </pre>
        )}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-3 text-lg font-semibold">Service Management</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <button
            onClick={() => handleServiceAction('install')}
            disabled={actionState.loading && actionState.action === 'install'}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {actionState.loading && actionState.action === 'install' ? 'Installing...' : 'Install'}
          </button>
          <button
            onClick={() => handleServiceAction('start')}
            disabled={actionState.loading && actionState.action === 'start'}
            className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            {actionState.loading && actionState.action === 'start' ? 'Starting...' : 'Start'}
          </button>
          <button
            onClick={() => handleServiceAction('stop')}
            disabled={actionState.loading && actionState.action === 'stop'}
            className="rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {actionState.loading && actionState.action === 'stop' ? 'Stopping...' : 'Stop'}
          </button>
          <button
            onClick={() => handleServiceAction('restart')}
            disabled={actionState.loading && actionState.action === 'restart'}
            className="rounded-md bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
          >
            {actionState.loading && actionState.action === 'restart' ? 'Restarting...' : 'Restart'}
          </button>
        </div>

        {actionState.result && (
          <div className="mt-3">
            {actionState.result.error ? (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-300">
                {actionState.result.error}
              </div>
            ) : (
              <div className="space-y-2">
                <div
                  className={`rounded-md p-3 text-sm ${
                    actionState.result.exitCode === 0
                      ? 'bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-300'
                      : 'bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300'
                  }`}
                >
                  {actionState.result.exitCode === 0
                    ? `${actionState.action} completed successfully!`
                    : `Exit code: ${actionState.result.exitCode}`}
                </div>
                {actionState.result.stdout && (
                  <div>
                    <div className="mb-1 text-xs font-medium text-slate-600 dark:text-slate-400">
                      Output:
                    </div>
                    <pre className="overflow-auto rounded-md bg-slate-50 p-3 text-xs dark:bg-slate-950">
                      {actionState.result.stdout}
                    </pre>
                  </div>
                )}
                {actionState.result.stderr && (
                  <div>
                    <div className="mb-1 text-xs font-medium text-slate-600 dark:text-slate-400">
                      Errors:
                    </div>
                    <pre className="overflow-auto rounded-md bg-slate-50 p-3 text-xs dark:bg-slate-950">
                      {actionState.result.stderr}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-2 text-lg font-semibold">Service Commands</h2>
        <div className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
          <div>
            <span className="font-medium">Install:</span> Install ZeroClaw as a system service
            (launchd/systemd)
          </div>
          <div>
            <span className="font-medium">Start:</span> Start the ZeroClaw service
          </div>
          <div>
            <span className="font-medium">Stop:</span> Stop the ZeroClaw service
          </div>
          <div>
            <span className="font-medium">Restart:</span> Restart the ZeroClaw service
          </div>
        </div>
      </div>
    </div>
  );
}

export default ServicePage;
