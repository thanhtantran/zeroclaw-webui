import React, { useState, useEffect } from 'react';

function CronPage() {
  const [jobs, setJobs] = useState({ loading: true, data: null, error: null });
  const [addForm, setAddForm] = useState({
    schedule: '',
    prompt: '',
    loading: false,
    result: null,
  });

  const fetchJobs = async () => {
    setJobs({ loading: true, data: null, error: null });
    try {
      const res = await fetch('/api/cron/list');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch cron jobs');
      setJobs({ loading: false, data, error: null });
    } catch (err) {
      setJobs({ loading: false, data: null, error: err.message });
    }
  };

  const handleAddJob = async (e) => {
    e.preventDefault();
    if (!addForm.schedule.trim() || !addForm.prompt.trim()) return;

    setAddForm((prev) => ({ ...prev, loading: true, result: null }));
    try {
      const res = await fetch('/api/cron/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schedule: addForm.schedule.trim(),
          prompt: addForm.prompt.trim(),
        }),
      });
      const data = await res.json();
      setAddForm({ schedule: '', prompt: '', loading: false, result: data });
      if (res.ok && data.exitCode === 0) {
        fetchJobs();
      }
    } catch (err) {
      setAddForm((prev) => ({ ...prev, loading: false, result: { error: err.message } }));
    }
  };

  const handleRemoveJob = async (id) => {
    if (!confirm(`Remove cron job ${id}?`)) return;

    try {
      const res = await fetch(`/api/cron/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok && data.exitCode === 0) {
        fetchJobs();
      } else {
        alert(data.error || `Failed to remove job (exit code: ${data.exitCode})`);
      }
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Cron Jobs</h2>
          <button
            onClick={fetchJobs}
            disabled={jobs.loading}
            className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {jobs.loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        {jobs.error && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-300">
            {jobs.error}
          </div>
        )}

        {jobs.data && (
          <div className="space-y-2">
            {(() => {
              const raw = jobs.data.raw || '';
              // Check if it's the "No scheduled tasks" message
              const isEmptyMessage = raw.includes('No scheduled tasks yet');
              
              if (isEmptyMessage) {
                return (
                  <div className="rounded-md bg-slate-50 p-3 text-xs text-slate-500 dark:bg-slate-950 dark:text-slate-400">
                    No scheduled tasks yet.
                  </div>
                );
              }

              // Filter out instruction lines (lines that contain 'zeroclaw cron add')
              const actualJobs = jobs.data.lines?.filter(line => {
                const trimmed = line.trim();
                // Skip empty lines
                if (!trimmed) return false;
                // Skip instruction lines
                if (trimmed.includes('zeroclaw cron add')) return false;
                if (trimmed.startsWith('No scheduled tasks')) return false;
                return true;
              }) || [];

              if (actualJobs.length === 0) {
                return (
                  <div className="rounded-md bg-slate-50 p-3 text-xs text-slate-500 dark:bg-slate-950 dark:text-slate-400">
                    No scheduled tasks yet.
                  </div>
                );
              }

              return (
                <div className="space-y-1">
                  {actualJobs.map((line, idx) => {
                    const match = line.match(/^(\S+)/);
                    const id = match ? match[1] : null;
                    return (
                      <div
                        key={idx}
                        className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
                      >
                        <span className="font-mono">{line}</span>
                        {id && (
                          <button
                            onClick={() => handleRemoveJob(id)}
                            className="ml-2 rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-3 text-lg font-semibold">Add Cron Job</h2>
        <form onSubmit={handleAddJob} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium">Schedule (cron format)</label>
            <input
              type="text"
              value={addForm.schedule}
              onChange={(e) => setAddForm((prev) => ({ ...prev, schedule: e.target.value }))}
              placeholder="*/5 * * * *"
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950"
            />
            <div className="mt-1 text-xs text-slate-500">
              Example: */5 * * * * (every 5 minutes)
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Prompt</label>
            <textarea
              value={addForm.prompt}
              onChange={(e) => setAddForm((prev) => ({ ...prev, prompt: e.target.value }))}
              placeholder="Check system health"
              rows={3}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950"
            />
          </div>
          <button
            type="submit"
            disabled={addForm.loading || !addForm.schedule.trim() || !addForm.prompt.trim()}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {addForm.loading ? 'Adding...' : 'Add Job'}
          </button>
        </form>

        {addForm.result && (
          <div className="mt-3">
            {addForm.result.error ? (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-300">
                {addForm.result.error}
              </div>
            ) : (
              <div className="space-y-2">
                <div
                  className={`rounded-md p-3 text-sm ${
                    addForm.result.exitCode === 0
                      ? 'bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-300'
                      : 'bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300'
                  }`}
                >
                  {addForm.result.exitCode === 0 ? 'Job added!' : `Exit code: ${addForm.result.exitCode}`}
                </div>
                {addForm.result.stdout && (
                  <pre className="overflow-auto rounded-md bg-slate-50 p-3 text-xs dark:bg-slate-950">
                    {addForm.result.stdout}
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

export default CronPage;
