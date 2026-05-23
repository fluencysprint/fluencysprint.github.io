import React from 'react';
import type { CEFRLevel, LevelReadiness } from '../types';
import { READINESS_BAND_LABELS } from '../types';

const LEVEL_COLORS: Record<CEFRLevel, string> = {
  A1: '#10b981',
  A2: '#22c55e',
  B1: '#0ea5e9',
  B2: '#6366f1',
  C1: '#f59e0b',
};

const BAND_STYLES: Record<LevelReadiness['band'], string> = {
  insufficient: 'text-slate-500 bg-slate-100',
  early_signal: 'text-amber-700 bg-amber-50',
  developing: 'text-sky-700 bg-sky-50',
  likely_ready: 'text-indigo-700 bg-indigo-50',
  strong: 'text-emerald-700 bg-emerald-50',
};

interface Props {
  data: LevelReadiness;
  isCurrent?: boolean;
}

export default function LevelReadinessCard({ data, isCurrent }: Props) {
  const color = LEVEL_COLORS[data.level];
  const ringPct = Math.max(0, Math.min(100, data.readiness));
  const noEvidence = data.unseenItems === 0 && data.repeatedItems === 0;

  return (
    <div
      className={`bg-white rounded-2xl border p-3 ${isCurrent ? 'border-indigo-300 shadow-md' : 'border-slate-100 shadow-sm'}`}
      data-testid={`level-readiness-${data.level}`}
    >
      <div className="flex items-center justify-between mb-2">
        <span
          className="inline-block px-2 py-0.5 rounded-full text-xs font-bold text-white"
          style={{ backgroundColor: color }}
        >
          {data.level}
        </span>
        <div className="text-sm font-bold text-slate-700 tabular-nums">{ringPct}%</div>
      </div>
      <div className={`text-[11px] inline-block px-2 py-0.5 rounded-full ${BAND_STYLES[data.band]} font-medium`}>
        {READINESS_BAND_LABELS[data.band]}
      </div>
      <div className="text-[11px] text-slate-400 mt-1">
        {noEvidence
          ? 'no evidence'
          : `${data.unseenItems} unseen, ${data.repeatedItems} repeated`}
      </div>
      {data.gatedBy && (
        <div className="text-[10px] text-amber-600 mt-1">Capped by {data.gatedBy}</div>
      )}
    </div>
  );
}
