import React from 'react';
import { useNavigate } from 'react-router-dom';
import { getMistakes, getEvidence } from '../lib/storage';
import { getActiveLanguagePack } from '../lib/activeLanguage';
import { getProficiency } from '../lib/proficiency';
import LevelReadinessCard from '../components/LevelReadinessCard';
import ProgressRing from '../components/ProgressRing';
import type { Skill, MistakeCategory } from '../types';
import { SKILL_LABELS, COMING_SOON_SKILLS } from '../types';

export default function Skills() {
  const navigate = useNavigate();
  const pack = getActiveLanguagePack();
  const mistakes = getMistakes();
  const evidence = getEvidence();
  const proficiency = getProficiency();

  if (!proficiency) return null;

  const skillMistakeCounts: Partial<Record<Skill, number>> = {};
  const skillTopMistake: Partial<Record<Skill, MistakeCategory>> = {};
  const skillMistakeCats: Partial<Record<Skill, Record<MistakeCategory, number>>> = {};
  for (const m of mistakes) {
    if (m.status === 'mastered') continue;
    skillMistakeCounts[m.skill] = (skillMistakeCounts[m.skill] ?? 0) + 1;
    if (!skillMistakeCats[m.skill]) skillMistakeCats[m.skill] = {} as Record<MistakeCategory, number>;
    for (const cat of m.mistakeCategories) {
      skillMistakeCats[m.skill]![cat] = (skillMistakeCats[m.skill]![cat] ?? 0) + 1;
    }
  }
  for (const skill of Object.keys(skillMistakeCats) as Skill[]) {
    const cats = skillMistakeCats[skill];
    if (!cats) continue;
    const top = (Object.entries(cats) as [MistakeCategory, number][]).sort((a, b) => b[1] - a[1])[0];
    if (top) skillTopMistake[skill] = top[0];
  }

  const hasEvidence = evidence.length > 0;

  return (
    <div className="space-y-6 pb-10">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Skill map</h1>
        <p className="text-slate-400 text-sm mt-1">
          {pack.metadata.label} — proficiency evidence vs. practice score
        </p>
      </div>

      {!hasEvidence && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-5 text-center">
          <p className="text-sm text-slate-600 mb-3">Take the placement diagnostic to populate your skill estimates.</p>
          <button
            onClick={() => navigate('/diagnostic')}
            className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700"
          >
            Start diagnostic
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {proficiency.readinessBySkill.map(s => {
          const notEnough = s.proficiency === null;
          const ringColor = (s.proficiency ?? 0) >= 70 ? '#10b981' : (s.proficiency ?? 0) >= 50 ? '#6366f1' : '#f59e0b';
          return (
            <div key={s.skill} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col gap-3" data-testid={`skill-${s.skill}`}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-sm font-semibold text-slate-800">{SKILL_LABELS[s.skill]}</div>
                  {notEnough ? (
                    <div className="text-xs text-slate-400 mt-0.5">Not enough data</div>
                  ) : (
                    <div className="text-xs text-slate-400 mt-0.5">Proficiency {s.proficiency}/100</div>
                  )}
                </div>
                {!notEnough && (
                  <ProgressRing pct={s.proficiency ?? 0} size={56} stroke={5} color={ringColor} label={`${s.proficiency}`} />
                )}
              </div>
              <div className="text-xs text-slate-500">
                Practice score: {s.practiceScore !== null ? `${s.practiceScore}%` : '—'}
              </div>
              <div className="text-[11px] text-slate-400">
                {s.unseenItems} unseen, {s.repeatedItems} repeated
                {skillMistakeCounts[s.skill] ? ` · ${skillMistakeCounts[s.skill]} due` : ''}
              </div>
              {skillTopMistake[s.skill] && (
                <div className="text-xs text-slate-400 bg-slate-50 rounded-lg px-2 py-1.5">
                  Top error: {skillTopMistake[s.skill]}
                </div>
              )}
              <button
                onClick={() => navigate('/sprint')}
                className="w-full mt-1 py-1.5 rounded-xl bg-indigo-50 text-indigo-700 text-sm font-medium hover:bg-indigo-100"
              >
                Start drill
              </button>
            </div>
          );
        })}
        {COMING_SOON_SKILLS.map(skill => (
          <div key={skill} className="bg-slate-50 rounded-2xl border border-slate-200 p-4 flex flex-col gap-2" data-testid={`skill-${skill}`}>
            <div className="text-sm font-semibold text-slate-700">{SKILL_LABELS[skill]}</div>
            <div className="text-xs text-slate-400">Coming soon — not included in level scoring yet.</div>
          </div>
        ))}
      </div>

      <div>
        <h2 className="text-base font-bold text-slate-800 mb-3">CEFR readiness</h2>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {proficiency.readinessByLevel.map(lr => (
            <LevelReadinessCard key={lr.level} data={lr} isCurrent={lr.level === proficiency.currentEstimate} />
          ))}
        </div>
        <p className="text-xs text-slate-400 mt-3">
          Unofficial self-study estimates. Listening and speaking are not scored yet.
        </p>
      </div>
    </div>
  );
}
