import React from 'react';
import type { CEFRLevel, LevelEvidenceStatus } from '../types';
import { LEVEL_STATUS_LABELS } from '../types';

interface Props {
  level: CEFRLevel;
  readiness: number;
  status: LevelEvidenceStatus;
  attempted: number;
  isCurrent?: boolean;
}

const LEVEL_COLORS: Record<CEFRLevel, string> = {
  A1: '#10b981',
  A2: '#22c55e',
  B1: '#0ea5e9',
  B2: '#6366f1',
  C1: '#f59e0b',
};

const STATUS_STYLES: Record<LevelEvidenceStatus, string> = {
  unknown: 'text-slate-500 bg-slate-100 dark:bg-slate-700 dark:text-slate-400',
  not_yet: 'text-red-700 bg-red-50 dark:bg-red-950/40 dark:text-red-300',
  emerging: 'text-amber-700 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-200',
  developing: 'text-indigo-700 bg-indigo-50 dark:bg-indigo-900/40 dark:text-indigo-300',
  strong: 'text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300',
};

export default function ReadinessCard({ level, readiness, status, attempted, isCurrent }: Props) {
  const color = LEVEL_COLORS[level];
  const ringPct = Math.max(0, Math.min(100, readiness));

  return (
    <div
      className={`bg-white dark:bg-slate-800 rounded-2xl border p-3 ${isCurrent ? 'border-indigo-300 dark:border-indigo-500 shadow-md' : 'border-slate-100 dark:border-slate-700 shadow-sm'}`}
      data-testid={`readiness-${level}`}
    >
      <div className="flex items-center justify-between mb-2">
        <span
          className="inline-block px-2 py-0.5 rounded-full text-xs font-bold text-white"
          style={{ backgroundColor: color }}
        >
          {level}
        </span>
        <div className="text-sm font-bold text-slate-700 dark:text-slate-200 tabular-nums">{ringPct}%</div>
      </div>
      <div className={`text-[11px] inline-block px-2 py-0.5 rounded-full ${STATUS_STYLES[status]} font-medium`}>
        {LEVEL_STATUS_LABELS[status]}
      </div>
      <div className="text-[11px] text-slate-400 mt-1">
        {attempted > 0 ? `${attempted} item${attempted === 1 ? '' : 's'}` : 'no evidence'}
      </div>
    </div>
  );
}
