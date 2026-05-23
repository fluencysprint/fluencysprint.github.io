import React from 'react';
import { getWordCountStatus } from '../lib/writingAnalysis';

interface Props {
  text: string;
  min?: number;
  max?: number;
  activeSeconds?: number;
}

const STATUS_STYLES: Record<string, string> = {
  too_short: 'text-amber-600 bg-amber-50 border-amber-200',
  in_range: 'text-emerald-600 bg-emerald-50 border-emerald-200',
  too_long: 'text-red-600 bg-red-50 border-red-200',
  unknown: 'text-slate-500 bg-slate-50 border-slate-200',
};

const STATUS_LABELS: Record<string, string> = {
  too_short: 'Too short',
  in_range: 'In range',
  too_long: 'Too long',
  unknown: '',
};

function formatMins(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

export default function WordCounter({ text, min, max, activeSeconds }: Props) {
  const status = getWordCountStatus(text, min, max);
  const cls = STATUS_STYLES[status.status];
  const label = STATUS_LABELS[status.status];

  return (
    <div
      data-testid="word-counter"
      className="flex items-center justify-between text-xs gap-3"
    >
      <span className={`px-2 py-1 rounded-md border ${cls} font-medium tabular-nums`}>
        {status.label}
        {label && <span className="ml-1.5 opacity-70">· {label}</span>}
      </span>
      {typeof activeSeconds === 'number' && (
        <span className="text-slate-400 tabular-nums">
          active writing time: {formatMins(activeSeconds)}
        </span>
      )}
    </div>
  );
}
