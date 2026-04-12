import React, { useState, useEffect } from 'react';

function ChannelsPage() {
  const [channels, setChannels] = useState({ loading: true, data: null, error: null });
  const [doctorResult, setDoctorResult] = useState(null);
  const [telegramConfig, setTelegramConfig] = useState({ loading: true, data: null, error: null });
  const [tokenForm, setTokenForm] = useState({ botToken: '', loading: false, result: null });
  const [addUserForm, setAddUserForm] = useState({ userId: '', loading: false, result: null });
  const [replaceTokenForm, setReplaceTokenForm] = useState({ newToken: '', loading: false, result: null, showForm: false });

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

  const fetchTelegramConfig = async () => {
    setTelegramConfig({ loading: true, data: null, error: null });
    try {
      const res = await fetch('/api/channel/telegram-config');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch Telegram config');
      setTelegramConfig({ loading: false, data, error: null });
    } catch (err) {
      setTelegramConfig({ loading: false, data: null, error: err.message });
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

  const handleSaveToken = async (e) => {
    e.preventDefault();
    if (!tokenForm.botToken.trim()) return;

    setTokenForm((prev) => ({ ...prev, loading: true, result: null }));
    try {
      const res = await fetch('/api/channel/telegram-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botToken: tokenForm.botToken.trim() }),
      });
      const data = await res.json();
      
      if (res.ok) {
        setTokenForm({ botToken: '', loading: false, result: { success: true, message: data.message } });
        fetchTelegramConfig();
        fetchChannels();
      } else {
        setTokenForm((prev) => ({ ...prev, loading: false, result: { error: data.error } }));
      }
    } catch (err) {
      setTokenForm((prev) => ({ ...prev, loading: false, result: { error: err.message } }));
    }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    if (!addUserForm.userId.trim()) return;

    setAddUserForm((prev) => ({ ...prev, loading: true, result: null }));
    try {
      const res = await fetch('/api/channel/telegram-add-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: addUserForm.userId.trim() }),
      });
      const data = await res.json();
      
      if (res.ok) {
        setAddUserForm({ userId: '', loading: false, result: { success: true, message: data.message } });
        fetchTelegramConfig();
      } else {
        setAddUserForm((prev) => ({ ...prev, loading: false, result: { error: data.error } }));
      }
    } catch (err) {
      setAddUserForm((prev) => ({ ...prev, loading: false, result: { error: err.message } }));
    }
  };

  const handleRemoveUser = async (userId) => {
    if (!confirm(`Remove user ${userId} from allowed list?`)) return;

    try {
      const res = await fetch(`/api/channel/telegram-remove-user/${encodeURIComponent(userId)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      
      if (res.ok) {
        fetchTelegramConfig();
      } else {
        alert(data.error || 'Failed to remove user');
      }
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleReplaceToken = async (e) => {
    e.preventDefault();
    if (!replaceTokenForm.newToken.trim()) return;

    if (!confirm('Replace the existing Telegram bot token? This will update your configuration.')) return;

    setReplaceTokenForm((prev) => ({ ...prev, loading: true, result: null }));
    try {
      const res = await fetch('/api/channel/telegram-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botToken: replaceTokenForm.newToken.trim() }),
      });
      const data = await res.json();
      
      if (res.ok) {
        setReplaceTokenForm({ newToken: '', loading: false, result: { success: true, message: 'Token replaced successfully!' }, showForm: false });
        fetchTelegramConfig();
        fetchChannels();
      } else {
        setReplaceTokenForm((prev) => ({ ...prev, loading: false, result: { error: data.error } }));
      }
    } catch (err) {
      setReplaceTokenForm((prev) => ({ ...prev, loading: false, result: { error: err.message } }));
    }
  };

  useEffect(() => {
    fetchChannels();
    fetchTelegramConfig();
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
        <h2 className="mb-3 text-lg font-semibold">Telegram Configuration</h2>
        
        {telegramConfig.loading ? (
          <div className="text-sm text-slate-500">Loading configuration...</div>
        ) : telegramConfig.error ? (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-300">
            {telegramConfig.error}
          </div>
        ) : (
          <div className="space-y-3">
            {telegramConfig.data?.exists && telegramConfig.data?.config?.hasToken ? (
              <div className="space-y-3">
                <div className="rounded-md bg-green-50 p-3 dark:bg-green-900/20">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="text-sm font-medium text-green-800 dark:text-green-300">
                      ✓ Telegram Bot Token Configured
                    </span>
                  </div>
                  <div className="space-y-1 text-xs text-green-700 dark:text-green-400">
                    <div>Token: {telegramConfig.data.config.tokenPreview}</div>
                    <div>Enabled: {telegramConfig.data.config.enabled ? 'Yes' : 'No'}</div>
                    <div>Stream Mode: {telegramConfig.data.config.stream_mode}</div>
                  </div>
                  <button
                    onClick={() => setTokenForm((prev) => ({ ...prev, botToken: '' }))}
                    className="mt-2 text-xs text-green-700 underline hover:text-green-800 dark:text-green-400 dark:hover:text-green-300"
                  >
                    Update token
                  </button>
                </div>

                <div className="rounded-md border border-slate-200 p-3 dark:border-slate-700">
                  <h3 className="mb-2 text-sm font-medium">Allowed Users</h3>
                  <div className="mb-3 space-y-1">
                    {telegramConfig.data.config.allowed_users?.length > 0 ? (
                      telegramConfig.data.config.allowed_users.map((userId, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2 text-xs dark:bg-slate-950"
                        >
                          <span className="font-mono">{userId}</span>
                          {userId !== '*' && (
                            <button
                              onClick={() => handleRemoveUser(userId)}
                              className="ml-2 rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="text-xs text-slate-500">No users configured</div>
                    )}
                  </div>

                  <form onSubmit={handleAddUser} className="space-y-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium">Add User ID</label>
                      <input
                        type="text"
                        value={addUserForm.userId}
                        onChange={(e) => setAddUserForm((prev) => ({ ...prev, userId: e.target.value }))}
                        placeholder="123456789"
                        className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950"
                      />
                      <div className="mt-1 text-xs text-slate-500">
                        Get your user ID by messaging the bot
                      </div>
                    </div>
                    <button
                      type="submit"
                      disabled={addUserForm.loading || !addUserForm.userId.trim()}
                      className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      {addUserForm.loading ? 'Adding...' : 'Add User'}
                    </button>
                  </form>

                  {addUserForm.result && (
                    <div className="mt-2">
                      {addUserForm.result.error ? (
                        <div className="rounded-md bg-red-50 p-2 text-xs text-red-800 dark:bg-red-900/20 dark:text-red-300">
                          {addUserForm.result.error}
                        </div>
                      ) : addUserForm.result.success ? (
                        <div className="rounded-md bg-green-50 p-2 text-xs text-green-800 dark:bg-green-900/20 dark:text-green-300">
                          {addUserForm.result.message}
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <form onSubmit={handleSaveToken} className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium">Telegram Bot Token</label>
                  <input
                    type="text"
                    value={tokenForm.botToken}
                    onChange={(e) => setTokenForm((prev) => ({ ...prev, botToken: e.target.value }))}
                    placeholder="1234567890:ABCdefGHIjklMNOpqrsTUVwxyz"
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950"
                  />
                  <div className="mt-1 text-xs text-slate-500">
                    Get your bot token from{' '}
                    <a
                      href="https://t.me/BotFather"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline dark:text-blue-400"
                    >
                      @BotFather
                    </a>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={tokenForm.loading || !tokenForm.botToken.trim()}
                  className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {tokenForm.loading ? 'Saving...' : 'Save Token'}
                </button>
              </form>
            )}

            {tokenForm.result && (
              <div className="mt-3">
                {tokenForm.result.error ? (
                  <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-300">
                    {tokenForm.result.error}
                  </div>
                ) : tokenForm.result.success ? (
                  <div className="rounded-md bg-green-50 p-3 text-sm text-green-800 dark:bg-green-900/20 dark:text-green-300">
                    {tokenForm.result.message}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-3 text-lg font-semibold">Replace Telegram Bot Token</h2>
        <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
          Update your Telegram bot token if you need to change it.
        </p>

        {!replaceTokenForm.showForm ? (
          <button
            onClick={() => setReplaceTokenForm((prev) => ({ ...prev, showForm: true, result: null }))}
            className="rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
          >
            Replace Token
          </button>
        ) : (
          <form onSubmit={handleReplaceToken} className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium">New Telegram Bot Token</label>
              <input
                type="text"
                value={replaceTokenForm.newToken}
                onChange={(e) => setReplaceTokenForm((prev) => ({ ...prev, newToken: e.target.value }))}
                placeholder="1234567890:ABCdefGHIjklMNOpqrsTUVwxyz"
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
              <div className="mt-1 text-xs text-slate-500">
                Get your bot token from{' '}
                <a
                  href="https://t.me/BotFather"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline dark:text-blue-400"
                >
                  @BotFather
                </a>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={replaceTokenForm.loading || !replaceTokenForm.newToken.trim()}
                className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {replaceTokenForm.loading ? 'Replacing...' : 'Replace Token'}
              </button>
              <button
                type="button"
                onClick={() => setReplaceTokenForm({ newToken: '', loading: false, result: null, showForm: false })}
                className="rounded-md bg-slate-600 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {replaceTokenForm.result && (
          <div className="mt-3">
            {replaceTokenForm.result.error ? (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-300">
                {replaceTokenForm.result.error}
              </div>
            ) : replaceTokenForm.result.success ? (
              <div className="rounded-md bg-green-50 p-3 text-sm text-green-800 dark:bg-green-900/20 dark:text-green-300">
                {replaceTokenForm.result.message}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

export default ChannelsPage;
