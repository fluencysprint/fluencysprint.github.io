import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  getProgress, getMistakes, getDueMistakes, getLatestDiagnostic, getSessions,
  getActiveProfileLastSavedAt,
} from '../lib/storage';
import { getActiveProfile } from '../lib/profile';
import { getLanguagePack } from '../languages';
import { placementHeadline } from '../lib/placement';
import LevelPath from '../components/LevelPath';
import ProgressRing from '../components/ProgressRing';
import WeaknessHeatmap from '../components/WeaknessHeatmap';
import ReadinessCard from '../components/ReadinessCard';
import type { MistakeCategory, CEFRLevel } from '../types';
import { CEFR_ORDER, MISTAKE_LABELS, PLACEMENT_CONFIDENCE_LABELS } from '../types';

function formatRelative(iso: string | null): string {
  if (!iso) return 'never';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 5) return 'just now';
  if (diff < 60) return `${Math.round(diff)}s ago`;
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
  return new Date(iso).toLocaleDateString();
}

export default function Dashboard() {
  const navigate = useNavigate();
  const profile = getActiveProfile();
  const pack = profile ? getLanguagePack(profile.targetLanguage) : null;
  const progress = getProgress();
  const diagnostic = getLatestDiagnostic();
  const mistakes = getMistakes();
  const dueMistakes = getDueMistakes();
  const sessions = getSessions();
  const lastSaved = getActiveProfileLastSavedAt();

  if (!profile || !pack) return null;

  const placement = diagnostic?.placement;
  const currentLevel: CEFRLevel = placement?.estimatedLevel ?? 'A1';
  const headline = placement ? placementHeadline(placement) : 'No placement yet';
  const confidenceLabel = placement ? PLACEMENT_CONFIDENCE_LABELS[placement.confidence] : '';

  const nextTarget = nextLevelAfter(currentLevel, profile.targetLevel);

  // Build mistake category counts
  const mistakeCounts: Partial<Record<MistakeCategory, number>> = {};
  for (const m of mistakes) {
    for (const cat of m.mistakeCategories) {
      mistakeCounts[cat] = (mistakeCounts[cat] ?? 0) + 1;
    }
  }

  const recentSessions = sessions.slice(-5);
  const recentAccuracy = recentSessions.length > 0
    ? Math.round(recentSessions.reduce((sum, s) => sum + s.accuracy, 0) / recentSessions.length)
    : null;

  const readinessByLevel: Partial<Record<CEFRLevel, number>> = { ...progress.levelReadiness };
  if (placement) {
    for (const ev of placement.perLevel) readinessByLevel[ev.level] = ev.readiness;
  }

  return (
    <div className="space-y-6 pb-10" data-testid="dashboard">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
          <p className="text-slate-400 text-sm mt-1">
            {pack.metadata.label}
            {profile.displayName ? ` · ${profile.displayName}` : ''} · target {profile.targetLevel}
          </p>
        </div>
        <button
          onClick={() => navigate('/sprint')}
          className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm"
        >
          ⚡ Start sprint
        </button>
      </div>

      {/* No diagnostic yet */}
      {!placement && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-6 text-center">
          <div className="text-4xl mb-3">🎯</div>
          <h3 className="text-lg font-bold text-slate-800 mb-1">Take the placement diagnostic</h3>
          <p className="text-slate-500 text-sm mb-4">
            A 5–10 minute adaptive check that starts at A1 and only goes higher if your answers support it.
          </p>
          <Link
            to="/diagnostic"
            className="inline-block px-6 py-3 rounded-xl bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700"
          >
            Start diagnostic →
          </Link>
        </div>
      )}

      {placement && (
        <>
          {/* Current level + path */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <div className="text-xs text-slate-400 uppercase tracking-wide font-semibold mb-3">Current estimate</div>
              <div className="flex items-center gap-4">
                <ProgressRing
                  pct={readinessByLevel[currentLevel] ?? 50}
                  size={72} stroke={7} color="#6366f1"
                  label={currentLevel}
                />
                <div>
                  <div className="text-2xl font-bold text-slate-800">{headline}</div>
                  <div className="text-xs text-slate-400 mt-1">{confidenceLabel}</div>
                  {nextTarget && (
                    <div className="text-xs text-indigo-600 font-medium mt-1">
                      Next target: {nextTarget}
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-4">
                <LevelPath currentLevel={currentLevel} targetLevel={profile.targetLevel} />
              </div>
            </div>

            <div className="bg-indigo-600 rounded-2xl p-5 text-white">
              <div className="text-xs text-indigo-200 uppercase tracking-wide font-semibold mb-2">Today</div>
              <div className="text-base font-bold mb-1">Daily Sprint</div>
              <div className="text-sm text-indigo-100 mb-4">
                {progress.dailyTime} minutes · adaptive to your weak areas
              </div>
              <button
                onClick={() => navigate('/sprint')}
                className="w-full py-2.5 rounded-xl bg-white text-indigo-700 font-semibold text-sm hover:bg-indigo-50"
              >
                Start today's sprint →
              </button>
            </div>
          </div>

          {/* Readiness per CEFR level (A1–C1) */}
          <div>
            <h2 className="text-base font-bold text-slate-800 mb-3">CEFR readiness</h2>
            <p className="text-xs text-slate-400 mb-3">
              Estimates based on placement evidence. Listening and speaking are not scored yet.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3" data-testid="readiness-grid">
              {CEFR_ORDER.map(level => {
                const ev = placement.perLevel.find(p => p.level === level);
                return (
                  <ReadinessCard
                    key={level}
                    level={level}
                    readiness={readinessByLevel[level] ?? 0}
                    status={ev?.status ?? 'unknown'}
                    attempted={ev?.attempted ?? 0}
                    isCurrent={level === currentLevel}
                  />
                );
              })}
            </div>
          </div>

          {/* Bottleneck + due */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-amber-50 rounded-2xl border border-amber-200 p-5">
              <div className="text-xs text-amber-600 uppercase tracking-wide font-semibold mb-2">Notes from the diagnostic</div>
              {placement.notes.length === 0 ? (
                <div className="text-sm text-amber-900">Nothing flagged — keep practicing!</div>
              ) : (
                <ul className="text-sm text-amber-900 space-y-1.5 leading-snug list-disc list-inside">
                  {placement.notes.slice(0, 4).map((n, i) => <li key={i}>{n}</li>)}
                </ul>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-400 uppercase tracking-wide font-semibold mb-1">Review due</div>
                <div className={`text-2xl font-bold ${dueMistakes.length > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                  {dueMistakes.length}
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  {dueMistakes.length === 1 ? 'item' : 'items'} to review today
                </div>
              </div>
              <button
                onClick={() => navigate('/review')}
                disabled={dueMistakes.length === 0}
                className="px-4 py-2.5 rounded-xl bg-red-50 text-red-600 text-sm font-semibold hover:bg-red-100 disabled:opacity-40"
              >
                Review now →
              </button>
            </div>
          </div>

          {/* Momentum + saved status */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="text-xs text-slate-400 uppercase tracking-wide font-semibold mb-3">Momentum</div>
            <div className="grid grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-xl font-bold text-slate-800">{progress.totalMinutes}</div>
                <div className="text-xs text-slate-400 mt-1">Minutes total</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-slate-800">{progress.sessionCount}</div>
                <div className="text-xs text-slate-400 mt-1">Sessions</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-slate-800">
                  {recentAccuracy !== null ? `${recentAccuracy}%` : '—'}
                </div>
                <div className="text-xs text-slate-400 mt-1">Recent accuracy</div>
              </div>
              <div className="text-center">
                <div className="text-xs font-bold text-emerald-600">Saved</div>
                <div className="text-xs text-slate-400 mt-1">{formatRelative(lastSaved)}</div>
              </div>
            </div>
          </div>

          {/* Listening / Speaking placeholders */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {(['listening', 'speaking'] as const).map(skill => (
              <div key={skill} className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                <div className="text-xs text-slate-400 uppercase tracking-wide font-semibold mb-1">{skill}</div>
                <div className="text-sm font-semibold text-slate-700">Coming soon</div>
                <div className="text-xs text-slate-400 mt-1">
                  Not included in your level estimate yet.
                </div>
              </div>
            ))}
          </div>

          {/* Heatmap */}
          {Object.keys(mistakeCounts).length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <div className="text-xs text-slate-400 uppercase tracking-wide font-semibold mb-3">Weakness heatmap</div>
              <p className="text-xs text-slate-400 mb-3">Based on tracked mistakes. Red = most errors.</p>
              <WeaknessHeatmap mistakeCounts={mistakeCounts} />
            </div>
          )}

          <div className="text-center text-xs text-slate-400 pb-4">
            All CEFR estimates are unofficial. Writing scores are self-rated and not assessed by an examiner.
          </div>
        </>
      )}
    </div>
  );
}

function nextLevelAfter(current: CEFRLevel, target: CEFRLevel): CEFRLevel | null {
  const ci = CEFR_ORDER.indexOf(current);
  const ti = CEFR_ORDER.indexOf(target);
  if (ci >= ti) return null;
  return CEFR_ORDER[ci + 1];
}
