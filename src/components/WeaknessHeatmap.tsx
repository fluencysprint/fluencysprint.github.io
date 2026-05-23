import React from 'react';
import type { MistakeCategory } from '../types';
import { MISTAKE_LABELS } from '../types';

interface Props {
  mistakeCounts: Partial<Record<MistakeCategory, number>>;
}

const ALL_CATEGORIES: MistakeCategory[] = [
  'subjunctive', 'tense_choice', 'ser_estar', 'por_para', 'pronouns',
  'connector_misuse', 'weak_collocation', 'false_friend', 'weak_inference',
  'informal_register', 'weak_argument_structure', 'accent_error',
];

function heatColor(count: number, max: number): string {
  if (max === 0 || count === 0) return '#f1f5f9';
  const ratio = count / max;
  if (ratio < 0.25) return '#fef3c7';
  if (ratio < 0.5) return '#fcd34d';
  if (ratio < 0.75) return '#f97316';
  return '#ef4444';
}

function textColor(count: number, max: number): string {
  if (max === 0 || count === 0) return '#94a3b8';
  const ratio = count / max;
  return ratio >= 0.5 ? '#fff' : '#374151';
}

export default function WeaknessHeatmap({ mistakeCounts }: Props) {
  const max = Math.max(0, ...Object.values(mistakeCounts).filter((v): v is number => v !== undefined));

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
      {ALL_CATEGORIES.map(cat => {
        const count = mistakeCounts[cat] ?? 0;
        const bg = heatColor(count, max);
        const text = textColor(count, max);
        return (
          <div
            key={cat}
            className="rounded-xl p-2.5 text-center transition-all"
            style={{ backgroundColor: bg }}
          >
            <div className="text-xs font-semibold leading-tight" style={{ color: text }}>
              {MISTAKE_LABELS[cat]}
            </div>
            {count > 0 && (
              <div className="text-lg font-bold mt-0.5" style={{ color: text }}>
                {count}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
