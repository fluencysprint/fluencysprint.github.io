import React from 'react';

interface Props {
  pct: number;
  size?: number;
  stroke?: number;
  color?: string;
  trackColor?: string;
  label?: string;
  sublabel?: string;
}

export default function ProgressRing({
  pct,
  size = 80,
  stroke = 7,
  color = '#6366f1',
  trackColor = 'var(--ring-track)',
  label,
  sublabel,
}: Props) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  const cx = size / 2;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="progress-ring -rotate-90">
        <circle cx={cx} cy={cx} r={r} fill="none" style={{ stroke: trackColor }} strokeWidth={stroke} />
        <circle
          cx={cx} cy={cx} r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={`${circ}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      {(label || sublabel) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {label && <span className="text-sm font-bold leading-none text-slate-800 dark:text-white">{label}</span>}
          {sublabel && <span className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{sublabel}</span>}
        </div>
      )}
    </div>
  );
}
