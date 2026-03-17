import React, { useEffect, useMemo, useState } from 'react';

function SkillsPage() {
  const [installed, setInstalled] = useState({ loading: false, error: null, items: [] });
  const [available, setAvailable] = useState({ loading: false, error: null, skills: [] });
  const [installing, setInstalling] = useState(null); // name đang cài

  const loadInstalled = async () => {
    setInstalled((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const res = await fetch('/api/skills/installed');
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = json?.error || `Load installed failed: ${res.status}`;
        setInstalled({ loading: false, error: msg, items: [] });
        return;
      }
      setInstalled({ loading: false, error: null, items: json.items || [] });
    } catch (err) {
      setInstalled({ loading: false, error: err.message, items: [] });
    }
  };

  const loadAvailable = async () => {
    setAvailable((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const res = await fetch('/api/skills/available');
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = json?.error || `Load available failed: ${res.status}`;
        setAvailable({ loading: false, error: msg, skills: [] });
        return;
      }
      setAvailable({ loading: false, error: null, skills: json.skills || [] });
    } catch (err) {
      setAvailable({ loading: false, error: err.message, skills: [] });
    }
  };

  useEffect(() => {
    loadInstalled();
    loadAvailable();
  }, []);

  const installedNames = useMemo(
    () =>
      new Set(
        (installed.items || [])
          .map((s) => {
            if (typeof s === 'string') return s;
            if (s && typeof s === 'object' && s.name) return s.name;
            return null;
          })
          .filter(Boolean),
      ),
    [installed.items],
  );

  const handleInstall = async (name) => {
    if (!name || installing) return;
    const ok = window.confirm(`Cài đặt skill "${name}"?`);
    if (!ok) return;
    setInstalling(name);
    try {
      const res = await fetch('/api/skills/install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = json?.error || `Install failed: ${res.status}`;
        alert(msg);
        return;
      }
      alert(`Đã cài đặt skill "${name}" (exitCode: ${json.exitCode})`);
      loadInstalled();
    } catch (err) {
      alert(err.message);
    } finally {
      setInstalling(null);
    }
  };

  return (
    <div className="space-y-3">
      <header className="space-y-1">
        <h1 className="text-lg font-semibold">Skills</h1>
        <p className="text-xs text-slate-400">
          Quản lý skill đã cài và skill có sẵn trong <code>/home/admin/open-skills</code>.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {/* Installed column */}
        <section className="space-y-2 rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-xs">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-slate-200">Đã cài đặt</h2>
              <p className="text-[11px] text-slate-400">
                Danh sách skill hiện đang active trong ZeroClaw.
              </p>
            </div>
            <button
              type="button"
              onClick={loadInstalled}
              disabled={installed.loading}
              className="rounded-md bg-slate-800 px-2 py-1 text-[11px] text-slate-100 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {installed.loading ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>

          {installed.error && (
            <p className="text-[11px] text-rose-400 mt-1">
              {installed.error}
            </p>
          )}

          <div className="mt-2 max-h-72 overflow-auto rounded border border-slate-800 bg-slate-950/80 p-2">
            {installed.items.length === 0 && !installed.loading && !installed.error && (
              <p className="text-[11px] text-slate-500">
                Chưa có skill nào được cài đặt.
              </p>
            )}
            {installed.items.length > 0 && (
              <ul className="space-y-0.5 text-[11px]">
                {installed.items.map((s) => {
                  const line = typeof s === 'string' ? s : s.raw || JSON.stringify(s);
                  const key = typeof s === 'string' ? s : s?.name || s?.raw || line;
                  return (
                    <li key={key} className="font-mono text-slate-200">
                      {line}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        {/* Available column */}
        <section className="space-y-2 rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-xs">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-slate-200">Có sẵn (open-skills)</h2>
              <p className="text-[11px] text-slate-400">
                Skill phát hiện trong thư mục <code>/home/admin/open-skills</code>.
              </p>
            </div>
            <button
              type="button"
              onClick={loadAvailable}
              disabled={available.loading}
              className="rounded-md bg-slate-800 px-2 py-1 text-[11px] text-slate-100 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {available.loading ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>

          {available.error && (
            <p className="text-[11px] text-rose-400 mt-1">
              {available.error}
            </p>
          )}

          <div className="mt-2 max-h-72 overflow-auto space-y-2">
            {available.skills.length === 0 && !available.loading && !available.error && (
              <p className="text-[11px] text-slate-500">
                Không tìm thấy skill nào trong open-skills/.
              </p>
            )}
            {available.skills.map((skill) => {
              const isInstalled = installedNames.has(skill.name);
              const meta = skill.metadata || {};
              const title = meta.title || skill.name;
              const description =
                meta.description ||
                meta.summary ||
                (skill.readme ? skill.readme.split('\n')[0] : '');

              return (
                <div
                  key={skill.name}
                  className="rounded border border-slate-800 bg-slate-950/80 p-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-[11px] font-semibold text-slate-100">
                        {title}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        <span className="font-mono text-slate-500">{skill.name}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleInstall(skill.name)}
                      disabled={isInstalled || installing === skill.name}
                      className="rounded-md bg-emerald-600 px-2 py-0.5 text-[10px] font-medium text-white shadow hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isInstalled
                        ? 'Installed'
                        : installing === skill.name
                          ? 'Installing…'
                          : 'Install'}
                    </button>
                  </div>
                  {description && (
                    <p className="mt-1 text-[11px] text-slate-300 line-clamp-3">
                      {description}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

export default SkillsPage;


