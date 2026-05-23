import React from 'react';
import { useNavigate } from 'react-router-dom';
import { getProgress, getMistakes, getLatestDiagnostic } from '../lib/storage';
import { getActiveLanguagePack } from '../lib/activeLanguage';
import ReadinessCard from '../components/ReadinessCard';
import SkillCard from '../components/SkillCard';
import type { Skill, MistakeCategory, CEFRLevel } from '../types';
import { CEFR_ORDER, SCORED_SKILLS, COMING_SOON_SKILLS } from '../types';

export default function Skills() {
  const navigate = useNavigate();
  const pack = getActiveLanguagePack();
  const progress = getProgress();
  const mistakes = getMistakes();
  const diagnostic = getLatestDiagnostic();
  const placement = diagnostic?.placement;

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
  for (const skill of SCORED_SKILLS) {
    const cats = skillMistakeCats[skill];
    if (!cats) continue;
    const top = (Object.entries(cats) as [MistakeCategory, number][]).sort((a, b) => b[1] - a[1])[0];
    if (top) skillTopMistake[skill] = top[0];
  }

  function getScore(skill: Skill): number {
    const fromProgress = progress.skillScores[skill];
    if (typeof fromProgress === 'number') return fromProgress;
    const fromPlacement = placement?.skillEstimates.find(s => s.skill === skill)?.score;
    return typeof fromPlacement === 'number' ? fromPlacement : 0;
  }

  return (
    <div className="space-y-6 pb-10">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Skill map</h1>
        <p className="text-slate-400 text-sm mt-1">{pack.metadata.label} performance by skill</p>
      </div>

      {!placement && (
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
        {SCORED_SKILLS.map(skill => (
          <SkillCard
            key={skill}
            skill={skill}
            score={getScore(skill)}
            dueReviews={skillMistakeCounts[skill] ?? 0}
            topMistake={skillTopMistake[skill]}
            onDrill={() => navigate('/sprint')}
          />
        ))}
        {COMING_SOON_SKILLS.map(skill => (
          <SkillCard key={skill} skill={skill} score={0} comingSoon />
        ))}
      </div>

      {placement && (
        <div>
          <h2 className="text-base font-bold text-slate-800 mb-3">CEFR readiness</h2>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {CEFR_ORDER.map(level => {
              const ev = placement.perLevel.find(p => p.level === level);
              return (
                <ReadinessCard
                  key={level}
                  level={level}
                  readiness={ev?.readiness ?? 0}
                  status={ev?.status ?? 'unknown'}
                  attempted={ev?.attempted ?? 0}
                  isCurrent={level === placement.estimatedLevel}
                />
              );
            })}
          </div>
          <p className="text-xs text-slate-400 mt-3">
            Unofficial self-study estimates. Listening and speaking are not scored yet.
          </p>
        </div>
      )}
    </div>
  );
}
