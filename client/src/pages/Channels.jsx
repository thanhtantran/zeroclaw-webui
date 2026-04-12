import React, { useState, useEffect } from 'react';

function ChannelsPage() {
  const [channels, setChannels] = useState({ loading: true, data: null, error: null });
  const [doctorResult, setDoctorResult] = useState(null);
  const [bindForm, setBindForm] = useState({ chatId: '', loading: false, result: null });

  const fetchChannels = async () => {
    setChannels({ loading: true, data: null, error: null });
    try {
      const res = await fetch('/api/channel/list');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch channels');
      setChannels({ loading: false, data, error: null });
    } catch (err) {
      setChannels({ loading: false, data: null, error: err.message });
    }
  };

  const runDoctor = async () => {
    setDoctorResult({ loading: true, data: null, error: null });
    try {
      const res = await fetch('/api/channel/doctor');
      const data = await res.json();
      setDoctorResult({ loading: false, data, error: null });
    } catch (err) {
      setDoctorResult({ loading: false, data: null, error: err.message });
    }
  };

  const handleBindTelegram = async (e) => {
    e.preventDefault();
    if (!bindForm.chatId.trim()) return;

    setBindForm((prev) => ({ ...prev, loading: true, result: null }));
    try {
      const res = await fetch('/api/channel/bind-telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: bindForm.chatId.trim() }),
      });
      const data = await res.json();
      setBindForm({ chatId: '', loading: false, result: data });
      if (res.ok && data.exitCode === 0) {
        fetchChannels();
      }
    } catch (err) {
      setBindForm((prev) => ({ ...prev, loading: false, result: { error: err.message } }));
    }
  };

  useEffect(() => {
    fetchChannels();
  }, []);

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Channels</h2>
          <button
            onClick={fetchChannels}
            disabled={channels.loading}
            className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {channels.loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        {channels.error && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-300">
            {channels.error}
          </div>
        )}

        {channels.data && (
          <pre className="overflow-auto rounded-md bg-slate-50 p-3 text-xs dark:bg-slate-950">
            {channels.data.raw || 'No channels configured'}
          </pre>
        )}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Channel Doctor</h2>
          <button
            onClick={runDoctor}
            disabled={doctorResult?.loading}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {doctorResult?.loading ? 'Running...' : 'Run Doctor'}
          </button>
        </div>

        {doctorResult?.error && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-300">
            {doctorResult.error}
          </div>
        )}

        {doctorResult?.data && (
          <div className="space-y-2">
            <pre className="overflow-auto rounded-md bg-slate-50 p-3 text-xs dark:bg-slate-950">
              {doctorResult.data.raw}
            </pre>
            {doctorResult.data.exitCode !== 0 && (
              <div className="text-xs text-amber-600 dark:text-amber-400">
                Exit code: {doctorResult.data.exitCode}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-3 text-lg font-semibold">Bind Telegram</h2>
        <form onSubmit={handleBindTelegram} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium">Chat ID</label>
            <input
              type="text"
              value={bindForm.chatId}
              onChange={(e) => setBindForm((prev) => ({ ...prev, chatId: e.target.value }))}
              placeholder="123456789"
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950"
            />
          </div>
          <button
            type="submit"
            disabled={bindForm.loading || !bindForm.chatId.trim()}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {bindForm.loading ? 'Binding...' : 'Bind'}
          </button>
        </form>

        {bindForm.result && (
          <div className="mt-3">
            {bindForm.result.error ? (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-300">
                {bindForm.result.error}
              </div>
            ) : (
              <div className="space-y-2">
                <div
                  className={`rounded-md p-3 text-sm ${
                    bindForm.result.exitCode === 0
                      ? 'bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-300'
                      : 'bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300'
                  }`}
                >
                  {bindForm.result.exitCode === 0 ? 'Success!' : `Exit code: ${bindForm.result.exitCode}`}
                </div>
                {bindForm.result.stdout && (
                  <pre className="overflow-auto rounded-md bg-slate-50 p-3 text-xs dark:bg-slate-950">
                    {bindForm.result.stdout}
                  </pre>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default ChannelsPage;
