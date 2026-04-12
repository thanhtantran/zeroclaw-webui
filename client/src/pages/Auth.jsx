import React, { useState, useEffect } from 'react';

const PROVIDERS = [
  { value: 'openai-codex', label: 'OpenAI Codex (ChatGPT)' },
  { value: 'gemini', label: 'Gemini' },
  { value: 'anthropic', label: 'Anthropic' },
];

function AuthPage() {
  const [status, setStatus] = useState({ loading: true, data: null, error: null });
  const [profiles, setProfiles] = useState({ loading: true, data: null, error: null });
  const [loginForm, setLoginForm] = useState({ provider: 'openai-codex', loading: false, result: null });
  const [pasteTokenForm, setPasteTokenForm] = useState({ 
    provider: 'anthropic', 
    token: '', 
    loading: false, 
    result: null 
  });
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

  const fetchProfiles = async () => {
    setProfiles({ loading: true, data: null, error: null });
    try {
      const res = await fetch('/api/auth/profiles');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch profiles');
      setProfiles({ loading: false, data: data.profiles, error: null });
    } catch (err) {
      setProfiles({ loading: false, data: null, error: err.message });
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!loginForm.provider) return;

    setLoginForm((prev) => ({ ...prev, loading: true, result: null }));
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: loginForm.provider }),
      });
      const data = await res.json();
      
      if (data.requiresToken) {
        setLoginForm((prev) => ({ ...prev, loading: false, result: { 
          info: data.message 
        }}));
      } else {
        setLoginForm((prev) => ({ ...prev, loading: false, result: data }));
        if (res.ok && data.exitCode === 0) {
          fetchStatus();
          fetchProfiles();
        }
      }
    } catch (err) {
      setLoginForm((prev) => ({ ...prev, loading: false, result: { error: err.message } }));
    }
  };

  const handlePasteToken = async (e) => {
    e.preventDefault();
    if (!pasteTokenForm.token.trim()) return;

    setPasteTokenForm((prev) => ({ ...prev, loading: true, result: null }));
    try {
      const res = await fetch('/api/auth/paste-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          provider: pasteTokenForm.provider,
          token: pasteTokenForm.token.trim() 
        }),
      });
      const data = await res.json();
      setPasteTokenForm({ provider: 'anthropic', token: '', loading: false, result: data });
      if (res.ok && data.exitCode === 0) {
        fetchStatus();
        fetchProfiles();
      }
    } catch (err) {
      setPasteTokenForm((prev) => ({ ...prev, loading: false, result: { error: err.message } }));
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
    fetchProfiles();
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
        <h2 className="mb-3 text-lg font-semibold">Login with Provider</h2>
        <form onSubmit={handleLogin} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium">Provider</label>
            <select
              value={loginForm.provider}
              onChange={(e) => setLoginForm((prev) => ({ ...prev, provider: e.target.value }))}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950"
            >
              {PROVIDERS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          {loginForm.provider === 'openai-codex' && (
            <div className="rounded-md bg-blue-50 p-3 text-xs dark:bg-blue-900/20">
              <div className="font-medium text-blue-800 dark:text-blue-300">OpenAI Codex (Device Code Flow)</div>
              <div className="mt-1 text-blue-700 dark:text-blue-400">
                This requires running the command in your terminal. The command will provide a link to authorize, 
                then you'll paste the callback URL back.
              </div>
            </div>
          )}

          {loginForm.provider === 'gemini' && (
            <div className="rounded-md bg-blue-50 p-3 text-xs dark:bg-blue-900/20">
              <div className="font-medium text-blue-800 dark:text-blue-300">Gemini OAuth</div>
              <div className="mt-1 text-blue-700 dark:text-blue-400">
                This requires running the command in your terminal for OAuth authentication.
              </div>
            </div>
          )}

          {loginForm.provider === 'anthropic' && (
            <div className="rounded-md bg-amber-50 p-3 text-xs dark:bg-amber-900/20">
              <div className="font-medium text-amber-800 dark:text-amber-300">Anthropic Token Setup</div>
              <div className="mt-1 text-amber-700 dark:text-amber-400">
                Anthropic uses API token authentication. Please use the "Paste Token" section below.
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loginForm.loading}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {loginForm.loading ? 'Processing...' : 'Get Instructions'}
          </button>
        </form>

        {loginForm.result && (
          <div className="mt-3">
            {loginForm.result.error ? (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-300">
                {loginForm.result.error}
              </div>
            ) : loginForm.result.info || loginForm.result.message ? (
              <div className="rounded-md bg-blue-50 p-3 text-sm text-blue-800 dark:bg-blue-900/20 dark:text-blue-300">
                {loginForm.result.info || loginForm.result.message}
              </div>
            ) : loginForm.result.requiresInteractive ? (
              <div className="space-y-2">
                <div className="rounded-md bg-blue-50 p-3 text-sm text-blue-800 dark:bg-blue-900/20 dark:text-blue-300">
                  <div className="font-medium mb-2">Run this command in your terminal:</div>
                  <code className="block rounded bg-blue-100 p-2 text-xs dark:bg-blue-950">
                    {loginForm.result.provider === 'openai-codex' 
                      ? 'zeroclaw auth login --provider openai-codex --device-code'
                      : 'zeroclaw auth login --provider gemini --profile default'}
                  </code>
                  <div className="mt-2 text-xs">
                    Follow the instructions in the terminal to complete authentication.
                  </div>
                </div>
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
        <h2 className="mb-3 text-lg font-semibold">Paste Token (Anthropic)</h2>
        <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
          For Anthropic, paste your API token here. Get your token from{' '}
          <a
            href="https://console.anthropic.com/settings/keys"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline dark:text-blue-400"
          >
            Anthropic Console
          </a>
        </p>
        <form onSubmit={handlePasteToken} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium">API Token</label>
            <input
              type="password"
              value={pasteTokenForm.token}
              onChange={(e) => setPasteTokenForm((prev) => ({ ...prev, token: e.target.value }))}
              placeholder="sk-ant-..."
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950"
            />
          </div>
          <button
            type="submit"
            disabled={pasteTokenForm.loading || !pasteTokenForm.token.trim()}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {pasteTokenForm.loading ? 'Saving...' : 'Save Token'}
          </button>
        </form>

        {pasteTokenForm.result && (
          <div className="mt-3">
            {pasteTokenForm.result.error ? (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-300">
                {pasteTokenForm.result.error}
              </div>
            ) : (
              <div className="space-y-2">
                <div
                  className={`rounded-md p-3 text-sm ${
                    pasteTokenForm.result.exitCode === 0
                      ? 'bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-300'
                      : 'bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300'
                  }`}
                >
                  {pasteTokenForm.result.exitCode === 0 ? 'Token saved successfully!' : `Exit code: ${pasteTokenForm.result.exitCode}`}
                </div>
                {pasteTokenForm.result.stdout && (
                  <pre className="overflow-auto rounded-md bg-slate-50 p-3 text-xs dark:bg-slate-950">
                    {pasteTokenForm.result.stdout}
                  </pre>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-3 text-lg font-semibold">Current Auth Profiles</h2>
        {profiles.loading ? (
          <div className="text-sm text-slate-500">Loading profiles...</div>
        ) : profiles.error ? (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-300">
            {profiles.error}
          </div>
        ) : profiles.data ? (
          <pre className="overflow-auto rounded-md bg-slate-50 p-3 text-xs dark:bg-slate-950">
            {JSON.stringify(profiles.data, null, 2)}
          </pre>
        ) : (
          <div className="text-sm text-slate-500">No profiles configured yet</div>
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
