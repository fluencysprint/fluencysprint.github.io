import React from 'react';
import type { Skill, MistakeCategory } from '../types';
import { SKILL_LABELS, MISTAKE_LABELS } from '../types';
import ProgressRing from './ProgressRing';

interface Props {
  skill: Skill;
  score: number;
  dueReviews?: number;
  topMistake?: MistakeCategory;
  trend?: 'improving' | 'stable' | 'declining';
  onDrill?: () => void;
  comingSoon?: boolean;
}

export default function SkillCard({
  skill, score, dueReviews = 0, topMistake, trend = 'stable', onDrill, comingSoon,
}: Props) {
  if (comingSoon) {
    return (
      <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 flex flex-col gap-2" data-testid={`skill-${skill}`}>
        <div className="flex items-start justify-between">
          <div>
            <div className="text-sm font-semibold text-slate-700">{SKILL_LABELS[skill]}</div>
            <div className="text-xs text-slate-400 mt-0.5">Coming soon</div>
          </div>
        </div>
        <div className="text-xs text-slate-400">Not included in level scoring yet.</div>
      </div>
    );
  }
  const ringColor = score >= 70 ? '#10b981' : score >= 50 ? '#6366f1' : '#f59e0b';
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col gap-3" data-testid={`skill-${skill}`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm font-semibold text-slate-800">{SKILL_LABELS[skill]}</div>
          <div className="text-xs text-slate-400 mt-0.5">Score {score}/100</div>
        </div>
        <ProgressRing pct={score} size={56} stroke={5} color={ringColor} label={`${score}`} />
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        {dueReviews > 0 && (
          <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-medium">
            {dueReviews} due
          </span>
        )}
      </div>
      {topMistake && (
        <div className="text-xs text-slate-400 bg-slate-50 rounded-lg px-2 py-1.5">
          Top error: {MISTAKE_LABELS[topMistake]}
        </div>
      )}
      {onDrill && (
        <button
          onClick={onDrill}
          className="w-full mt-1 py-1.5 rounded-xl bg-indigo-50 text-indigo-700 text-sm font-medium hover:bg-indigo-100"
        >
          Start drill
        </button>
      )}
    </div>
  );
}
