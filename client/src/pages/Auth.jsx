import React, { useState, useEffect } from 'react';

function AuthPage() {
  const [status, setStatus] = useState({ loading: true, data: null, error: null });
  const [loginForm, setLoginForm] = useState({ provider: '', loading: false, result: null });
  const [useForm, setUseForm] = useState({
    provider: '',
    profile: '',
    loading: false,
    result: null,
  });

  const fetchStatus = async () => {
    setStatus({ loading: true, data: null, error: null });
    try {
      const res = await fetch('/api/auth/status');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch auth status');
      setStatus({ loading: false, data, error: null });
    } catch (err) {
      setStatus({ loading: false, data: null, error: err.message });
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!loginForm.provider.trim()) return;

    setLoginForm((prev) => ({ ...prev, loading: true, result: null }));
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: loginForm.provider.trim() }),
      });
      const data = await res.json();
      setLoginForm({ provider: '', loading: false, result: data });
      if (res.ok && data.exitCode === 0) {
        fetchStatus();
      }
    } catch (err) {
      setLoginForm((prev) => ({ ...prev, loading: false, result: { error: err.message } }));
    }
  };

  const handleUse = async (e) => {
    e.preventDefault();
    if (!useForm.provider.trim() || !useForm.profile.trim()) return;

    setUseForm((prev) => ({ ...prev, loading: true, result: null }));
    try {
      const res = await fetch('/api/auth/use', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: useForm.provider.trim(),
          profile: useForm.profile.trim(),
        }),
      });
      const data = await res.json();
      setUseForm({ provider: '', profile: '', loading: false, result: data });
      if (res.ok && data.exitCode === 0) {
        fetchStatus();
      }
    } catch (err) {
      setUseForm((prev) => ({ ...prev, loading: false, result: { error: err.message } }));
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Auth Status</h2>
          <button
            onClick={fetchStatus}
            disabled={status.loading}
            className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {status.loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        {status.error && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-300">
            {status.error}
          </div>
        )}

        {status.data && (
          <pre className="overflow-auto rounded-md bg-slate-50 p-3 text-xs dark:bg-slate-950">
            {status.data.raw || 'No auth information available'}
          </pre>
        )}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-3 text-lg font-semibold">Login</h2>
        <form onSubmit={handleLogin} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium">Provider</label>
            <input
              type="text"
              value={loginForm.provider}
              onChange={(e) => setLoginForm((prev) => ({ ...prev, provider: e.target.value }))}
              placeholder="anthropic, openai, etc."
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950"
            />
          </div>
          <button
            type="submit"
            disabled={loginForm.loading || !loginForm.provider.trim()}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {loginForm.loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        {loginForm.result && (
          <div className="mt-3">
            {loginForm.result.error ? (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-300">
                {loginForm.result.error}
              </div>
            ) : (
              <div className="space-y-2">
                <div
                  className={`rounded-md p-3 text-sm ${
                    loginForm.result.exitCode === 0
                      ? 'bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-300'
                      : 'bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300'
                  }`}
                >
                  {loginForm.result.exitCode === 0 ? 'Login successful!' : `Exit code: ${loginForm.result.exitCode}`}
                </div>
                {loginForm.result.stdout && (
                  <pre className="overflow-auto rounded-md bg-slate-50 p-3 text-xs dark:bg-slate-950">
                    {loginForm.result.stdout}
                  </pre>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-3 text-lg font-semibold">Use Profile</h2>
        <form onSubmit={handleUse} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium">Provider</label>
            <input
              type="text"
              value={useForm.provider}
              onChange={(e) => setUseForm((prev) => ({ ...prev, provider: e.target.value }))}
              placeholder="anthropic, openai, etc."
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Profile</label>
            <input
              type="text"
              value={useForm.profile}
              onChange={(e) => setUseForm((prev) => ({ ...prev, profile: e.target.value }))}
              placeholder="default, work, etc."
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950"
            />
          </div>
          <button
            type="submit"
            disabled={useForm.loading || !useForm.provider.trim() || !useForm.profile.trim()}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {useForm.loading ? 'Switching...' : 'Use Profile'}
          </button>
        </form>

        {useForm.result && (
          <div className="mt-3">
            {useForm.result.error ? (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-300">
                {useForm.result.error}
              </div>
            ) : (
              <div className="space-y-2">
                <div
                  className={`rounded-md p-3 text-sm ${
                    useForm.result.exitCode === 0
                      ? 'bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-300'
                      : 'bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300'
                  }`}
                >
                  {useForm.result.exitCode === 0 ? 'Profile switched!' : `Exit code: ${useForm.result.exitCode}`}
                </div>
                {useForm.result.stdout && (
                  <pre className="overflow-auto rounded-md bg-slate-50 p-3 text-xs dark:bg-slate-950">
                    {useForm.result.stdout}
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

export default AuthPage;
