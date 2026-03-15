import React from 'react';

function Terminal({ title = 'Output', text = '' }) {
  const lines = typeof text === 'string' ? text.split('\n') : [];

  return (
    <div className="rounded-lg border border-slate-800 bg-black/80 text-slate-100 shadow-inner">
      <div className="flex items-center justify-between border-b border-slate-800 px-3 py-1.5 text-xs text-slate-400">
        <span className="flex items-center gap-1">
          <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          <span className="font-medium">{title}</span>
        </span>
      </div>
      <div className="max-h-80 overflow-auto px-3 py-2 text-xs font-mono leading-relaxed whitespace-pre-wrap">
        {lines.length === 0 ? (
          <span className="text-slate-500">No output yet.</span>
        ) : (
          lines.map((line, idx) => (
            <div key={idx}>{line || '\u00A0'}</div>
          ))
        )}
      </div>
    </div>
  );
}

export default Terminal;

