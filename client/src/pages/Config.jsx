import React, { useEffect, useMemo, useState } from 'react';
import TOML from 'smol-toml';
import CodeMirror from '@uiw/react-codemirror';
// TOML syntax highlighting removed - package @codemirror/lang-toml doesn't exist

const TOOLTIP_CLASS =
  'ml-1 cursor-help text-[10px] rounded-full border border-slate-600 px-1 text-slate-300';

function Field({ label, tooltip, children }) {
  return (
    <label className="block text-xs">
      <span className="flex items-center gap-1 text-slate-300">
        {label}
        {tooltip && <span className={TOOLTIP_CLASS}>?</span>}
      </span>
      {tooltip && <div className="mt-0.5 text-[10px] text-slate-500">{tooltip}</div>}
      <div className="mt-1">{children}</div>
    </label>
  );
}

function ConfigPage() {
  const [mode, setMode] = useState('form'); // 'form' | 'raw'
  const [rawText, setRawText] = useState('');
  const [parsed, setParsed] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [backups, setBackups] = useState([]);
  const [backupsLoading, setBackupsLoading] = useState(false);
  const [backupsError, setBackupsError] = useState(null);

  // Form state for các field quan trọng
  const [form, setForm] = useState({
    api_key: '',
    default_provider: '',
    default_model: '',
    default_temperature: 0.7,
    observability_backend: '',
    autonomy_level: '',
    autonomy_workspace_only: false,
    heartbeat_enabled: true,
    heartbeat_interval_minutes: 60,
    gateway_port: 42617,
    gateway_host: '127.0.0.1',
    gateway_allow_public_bind: false,
    memory_backend: 'sqlite',
    memory_auto_save: true,
  });
  const [formErrors, setFormErrors] = useState({});

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const res = await fetch('/api/config');
        if (!res.ok) {
          throw new Error(`Failed to load config: ${res.status}`);
        }
        const text = await res.text();
        setRawText(text);
        try {
          const obj = TOML.parse(text);
          setParsed(obj);
          hydrateFormFromToml(obj);
        } catch (err) {
          setLoadError(`TOML parse error: ${err.message}`);
        }
      } catch (err) {
        setLoadError(err.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const hydrateFormFromToml = (obj) => {
    if (!obj || typeof obj !== 'object') return;
    setForm((prev) => ({
      ...prev,
      api_key: obj.api_key ?? '',
      default_provider: obj.default_provider ?? '',
      default_model: obj.default_model ?? '',
      default_temperature: obj.default_temperature ?? 0.7,
      observability_backend: obj.observability?.backend ?? 'none',
      autonomy_level: obj.autonomy?.level ?? 'full',
      autonomy_workspace_only: obj.autonomy?.workspace_only ?? false,
      heartbeat_enabled: obj.heartbeat?.enabled ?? true,
      heartbeat_interval_minutes: obj.heartbeat?.interval_minutes ?? 60,
      gateway_port: obj.gateway?.port ?? 42617,
      gateway_host: obj.gateway?.host ?? '127.0.0.1',
      gateway_allow_public_bind: obj.gateway?.allow_public_bind ?? false,
      memory_backend: obj.memory?.backend ?? 'sqlite',
      memory_auto_save: obj.memory?.auto_save ?? true,
    }));
  };

  const validateForm = () => {
    const errors = {};
    if (!form.default_provider) errors.default_provider = 'Bắt buộc.';
    if (!form.default_model) errors.default_model = 'Bắt buộc.';
    const t = Number(form.default_temperature);
    if (Number.isNaN(t) || t < 0 || t > 2) {
      errors.default_temperature = '0.0 – 2.0';
    }
    const port = Number(form.gateway_port);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      errors.gateway_port = '1 – 65535';
    }
    const iv = Number(form.heartbeat_interval_minutes);
    if (!Number.isInteger(iv) || iv <= 0) {
      errors.heartbeat_interval_minutes = '> 0';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const buildTomlFromForm = () => {
    const base = parsed && typeof parsed === 'object' ? { ...parsed } : {};
    base.api_key = form.api_key;
    base.default_provider = form.default_provider;
    base.default_model = form.default_model;
    base.default_temperature = Number(form.default_temperature);

    base.observability = {
      ...(base.observability || {}),
      backend: form.observability_backend,
    };

    base.autonomy = {
      ...(base.autonomy || {}),
      level: form.autonomy_level,
      workspace_only: Boolean(form.autonomy_workspace_only),
    };

    base.heartbeat = {
      ...(base.heartbeat || {}),
      enabled: Boolean(form.heartbeat_enabled),
      interval_minutes: Number(form.heartbeat_interval_minutes),
    };

    base.gateway = {
      ...(base.gateway || {}),
      port: Number(form.gateway_port),
      host: form.gateway_host,
      allow_public_bind: Boolean(form.gateway_allow_public_bind),
    };

    base.memory = {
      ...(base.memory || {}),
      backend: form.memory_backend,
      auto_save: Boolean(form.memory_auto_save),
    };

    return TOML.stringify(base);
  };

  const handleSave = async () => {
    if (mode === 'form') {
      if (!validateForm()) return;
    } else {
      try {
        TOML.parse(rawText);
      } catch (err) {
        setSaveError(`TOML parse error: ${err.message}`);
        return;
      }
    }
    const ok = window.confirm('Ghi đè config.toml với thay đổi hiện tại?');
    if (!ok) return;
    setSaving(true);
    setSaveError(null);
    try {
      const bodyText = mode === 'form' ? buildTomlFromForm() : rawText;
      const res = await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        body: bodyText,
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = json?.detail || json?.error || `Save failed: ${res.status}`;
        setSaveError(msg);
        return;
      }
      setSaveError(null);
      setRawText(bodyText);
      try {
        const obj = TOML.parse(bodyText);
        setParsed(obj);
        hydrateFormFromToml(obj);
      } catch (e) {
        // ignore
      }
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const loadBackups = async () => {
    setBackupsLoading(true);
    setBackupsError(null);
    try {
      const res = await fetch('/api/config/backups');
      if (!res.ok) throw new Error(`Load backups failed: ${res.status}`);
      const json = await res.json();
      setBackups(json.backups || []);
    } catch (err) {
      setBackupsError(err.message);
    } finally {
      setBackupsLoading(false);
    }
  };

  const handleRestore = async (filename) => {
    const ok = window.confirm(`Restore từ backup "${filename}"? Thay đổi hiện tại sẽ mất.`);
    if (!ok) return;
    try {
      const res = await fetch(`/api/config/restore/${encodeURIComponent(filename)}`, {
        method: 'POST',
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = json?.detail || json?.error || `Restore failed: ${res.status}`;
        alert(msg);
        return;
      }
      // Sau restore, reload config
      window.location.reload();
    } catch (err) {
      alert(err.message);
    }
  };

  const backupsSorted = useMemo(
    () =>
      (backups || []).slice().sort((a, b) => {
        const ta = new Date(a.mtime).getTime();
        const tb = new Date(b.mtime).getTime();
        return tb - ta;
      }),
    [backups],
  );

  return (
    <div className="space-y-3">
      <header className="space-y-1">
        <h1 className="text-lg font-semibold">Config</h1>
        <p className="text-xs text-slate-400">
          Chỉnh sửa cấu hình <code>config.toml</code> cho ZeroClaw.
        </p>
      </header>

      {loading && (
        <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-xs text-slate-400">
          Đang tải config...
        </div>
      )}
      {loadError && (
        <div className="rounded-lg border border-rose-800/60 bg-rose-950/40 p-3 text-xs text-rose-200">
          {loadError}
        </div>
      )}

      {!loading && !loadError && (
        <>
          <div className="flex items-center justify-between gap-2 text-xs">
            <div className="inline-flex items-center rounded-full border border-slate-700 bg-slate-950/60 p-0.5">
              <button
                type="button"
                onClick={() => setMode('form')}
                className={[
                  'px-3 py-1 rounded-full',
                  mode === 'form' ? 'bg-slate-800 text-emerald-300' : 'text-slate-400',
                ].join(' ')}
              >
                Form Mode
              </button>
              <button
                type="button"
                onClick={() => setMode('raw')}
                className={[
                  'px-3 py-1 rounded-full',
                  mode === 'raw' ? 'bg-slate-800 text-emerald-300' : 'text-slate-400',
                ].join(' ')}
              >
                Raw Mode
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={loadBackups}
                className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-800"
              >
                Backup History
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="rounded-md bg-emerald-600 px-3 py-1.5 text-[11px] font-medium text-white shadow hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
          {saveError && (
            <p className="text-[11px] text-rose-400">
              {saveError}
            </p>
          )}

          {mode === 'form' && (
            <div className="space-y-4 rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-xs">
              <section className="space-y-2">
                <h2 className="text-sm font-semibold text-slate-200">General</h2>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <Field
                    label="API key"
                    tooltip="API key cho provider mặc định. Để trống nếu dùng biến môi trường."
                  >
                    <input
                      type="password"
                      className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
                      value={form.api_key}
                      onChange={(e) => setForm((f) => ({ ...f, api_key: e.target.value }))}
                    />
                  </Field>
                  <Field
                    label="Default provider"
                    tooltip="Tên provider mặc định (vd: qwen-intl, openai, anthropic...)."
                  >
                    <input
                      type="text"
                      className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
                      value={form.default_provider}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, default_provider: e.target.value }))
                      }
                    />
                    {formErrors.default_provider && (
                      <p className="mt-0.5 text-[10px] text-rose-400">
                        {formErrors.default_provider}
                      </p>
                    )}
                  </Field>
                  <Field
                    label="Default model"
                    tooltip="Model mặc định dùng cho câu hỏi thông thường."
                  >
                    <input
                      type="text"
                      className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
                      value={form.default_model}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, default_model: e.target.value }))
                      }
                    />
                    {formErrors.default_model && (
                      <p className="mt-0.5 text-[10px] text-rose-400">
                        {formErrors.default_model}
                      </p>
                    )}
                  </Field>
                  <Field
                    label="Default temperature"
                    tooltip="Độ sáng tạo của model. 0.0 (deterministic) – 2.0 (sáng tạo)."
                  >
                    <input
                      type="number"
                      min="0"
                      max="2"
                      step="0.1"
                      className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
                      value={form.default_temperature}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, default_temperature: e.target.value }))
                      }
                    />
                    {formErrors.default_temperature && (
                      <p className="mt-0.5 text-[10px] text-rose-400">
                        {formErrors.default_temperature}
                      </p>
                    )}
                  </Field>
                </div>
              </section>

              <section className="space-y-2">
                <h2 className="text-sm font-semibold text-slate-200">Autonomy & Observability</h2>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <Field
                    label="Autonomy level"
                    tooltip="Mức độ tự động: full / ask / manual."
                  >
                    <select
                      className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
                      value={form.autonomy_level}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, autonomy_level: e.target.value }))
                      }
                    >
                      <option value="full">full</option>
                      <option value="ask">ask</option>
                      <option value="manual">manual</option>
                    </select>
                  </Field>
                  <Field
                    label="Workspace only"
                    tooltip="Nếu bật, lệnh shell chỉ được chạy trong workspace."
                  >
                    <div className="flex items-center gap-2">
                      <input
                        id="autonomy_workspace_only"
                        type="checkbox"
                        className="h-3 w-3 rounded border-slate-700 bg-slate-900"
                        checked={form.autonomy_workspace_only}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            autonomy_workspace_only: e.target.checked,
                          }))
                        }
                      />
                      <label
                        htmlFor="autonomy_workspace_only"
                        className="text-[11px] text-slate-300"
                      >
                        Chỉ cho phép thao tác trong workspace
                      </label>
                    </div>
                  </Field>
                  <Field
                    label="Observability backend"
                    tooltip="Đích ghi log/trace: none, file, opentelemetry..."
                  >
                    <input
                      type="text"
                      className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
                      value={form.observability_backend}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, observability_backend: e.target.value }))
                      }
                    />
                  </Field>
                </div>
              </section>

              <section className="space-y-2">
                <h2 className="text-sm font-semibold text-slate-200">Runtime & Heartbeat</h2>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <Field
                    label="Heartbeat enabled"
                    tooltip="Gửi heartbeat định kỳ để theo dõi daemon."
                  >
                    <div className="flex items-center gap-2">
                      <input
                        id="heartbeat_enabled"
                        type="checkbox"
                        className="h-3 w-3 rounded border-slate-700 bg-slate-900"
                        checked={form.heartbeat_enabled}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, heartbeat_enabled: e.target.checked }))
                        }
                      />
                      <label
                        htmlFor="heartbeat_enabled"
                        className="text-[11px] text-slate-300"
                      >
                        Bật heartbeat
                      </label>
                    </div>
                  </Field>
                  <Field
                    label="Heartbeat interval (minutes)"
                    tooltip="Tần suất gửi heartbeat."
                  >
                    <input
                      type="number"
                      min="1"
                      className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
                      value={form.heartbeat_interval_minutes}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, heartbeat_interval_minutes: e.target.value }))
                      }
                    />
                    {formErrors.heartbeat_interval_minutes && (
                      <p className="mt-0.5 text-[10px] text-rose-400">
                        {formErrors.heartbeat_interval_minutes}
                      </p>
                    )}
                  </Field>
                </div>
              </section>

              <section className="space-y-2">
                <h2 className="text-sm font-semibold text-slate-200">Gateway</h2>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <Field label="Host" tooltip="Địa chỉ bind cho gateway (thường 127.0.0.1).">
                    <input
                      type="text"
                      className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
                      value={form.gateway_host}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, gateway_host: e.target.value }))
                      }
                    />
                  </Field>
                  <Field label="Port" tooltip="Cổng HTTP cho gateway.">
                    <input
                      type="number"
                      min="1"
                      max="65535"
                      className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
                      value={form.gateway_port}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, gateway_port: e.target.value }))
                      }
                    />
                    {formErrors.gateway_port && (
                      <p className="mt-0.5 text-[10px] text-rose-400">
                        {formErrors.gateway_port}
                      </p>
                    )}
                  </Field>
                  <Field
                    label="Allow public bind"
                    tooltip="Nếu bật, cho phép bind 0.0.0.0 (tiềm ẩn rủi ro bảo mật)."
                  >
                    <div className="flex items-center gap-2">
                      <input
                        id="gateway_allow_public_bind"
                        type="checkbox"
                        className="h-3 w-3 rounded border-slate-700 bg-slate-900"
                        checked={form.gateway_allow_public_bind}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            gateway_allow_public_bind: e.target.checked,
                          }))
                        }
                      />
                      <label
                        htmlFor="gateway_allow_public_bind"
                        className="text-[11px] text-slate-300"
                      >
                        Cho phép bind public
                      </label>
                    </div>
                  </Field>
                </div>
              </section>

              <section className="space-y-2">
                <h2 className="text-sm font-semibold text-slate-200">Memory</h2>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <Field
                    label="Backend"
                    tooltip="Backend lưu trữ memory: sqlite, postgres, qdrant..."
                  >
                    <input
                      type="text"
                      className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
                      value={form.memory_backend}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, memory_backend: e.target.value }))
                      }
                    />
                  </Field>
                  <Field
                    label="Auto save"
                    tooltip="Tự động lưu memory sau mỗi session."
                  >
                    <div className="flex items-center gap-2">
                      <input
                        id="memory_auto_save"
                        type="checkbox"
                        className="h-3 w-3 rounded border-slate-700 bg-slate-900"
                        checked={form.memory_auto_save}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, memory_auto_save: e.target.checked }))
                        }
                      />
                      <label htmlFor="memory_auto_save" className="text-[11px] text-slate-300">
                        Bật auto-save
                      </label>
                    </div>
                  </Field>
                </div>
              </section>

              <p className="text-[10px] text-slate-500">
                Các trường nâng cao (cost, channels, skills, security, ...) vẫn được giữ nguyên
                trong file TOML và có thể chỉnh trong Raw Mode.
              </p>
            </div>
          )}

          {mode === 'raw' && (
            <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-1 text-xs">
              <CodeMirror
                value={rawText}
                height="480px"
                theme="dark"
                extensions={[]}
                onChange={(value) => setRawText(value)}
              />
            </div>
          )}

          {backupsLoading && (
            <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-2 text-[11px] text-slate-300">
              Đang tải backup...
            </div>
          )}
          {backupsError && (
            <div className="rounded-lg border border-rose-800/60 bg-rose-950/40 p-2 text-[11px] text-rose-200">
              {backupsError}
            </div>
          )}
          {!backupsLoading && backupsSorted.length > 0 && (
            <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-[11px]">
              <div className="mb-1 flex items-center justify-between">
                <h2 className="text-xs font-semibold text-slate-200">Backup history</h2>
                <span className="text-[10px] text-slate-500">
                  {backupsSorted.length} bản backup
                </span>
              </div>
              <div className="max-h-60 overflow-auto">
                <table className="w-full border-collapse text-left text-[11px]">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400">
                      <th className="py-1 pr-2">Filename</th>
                      <th className="py-1 pr-2">Modified</th>
                      <th className="py-1 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {backupsSorted.map((b) => (
                      <tr key={b.filename} className="border-b border-slate-900">
                        <td className="py-1 pr-2 font-mono text-[10px] text-slate-200">
                          {b.filename}
                        </td>
                        <td className="py-1 pr-2 text-slate-300">
                          {b.mtime ? new Date(b.mtime).toLocaleString() : '—'}
                        </td>
                        <td className="py-1 text-right">
                          <button
                            type="button"
                            onClick={() => handleRestore(b.filename)}
                            className="rounded-md border border-slate-700 bg-slate-900 px-2 py-0.5 text-[10px] text-slate-100 hover:bg-slate-800"
                          >
                            Restore
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default ConfigPage;


