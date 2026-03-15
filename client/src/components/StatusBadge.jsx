import React from 'react';

const colorMap = {
  green: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/60',
  red: 'bg-rose-500/15 text-rose-300 border-rose-500/60',
  yellow: 'bg-amber-500/15 text-amber-300 border-amber-500/60',
  gray: 'bg-slate-500/15 text-slate-300 border-slate-500/60',
};

function StatusBadge({ status = 'unknown', tone = 'gray' }) {
  const cls = colorMap[tone] || colorMap.gray;
  return (
    <span
      className={[
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium',
        cls,
      ].join(' ')}
    >
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-current" />
      <span>{status}</span>
    </span>
  );
}

export default StatusBadge;

