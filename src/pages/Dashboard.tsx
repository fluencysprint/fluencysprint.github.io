import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  getProgress, getMistakes, getDueMistakes, getLatestDiagnostic, getSessions,
  getActiveProfileLastSavedAt, getEvidence,
  hasPendingMigrationNotice, dismissMigrationNotice,
} from '../lib/storage';
import { getActiveProfile } from '../lib/profile';
import { getLanguagePack } from '../languages';
import { getProficiency } from '../lib/proficiency';
import LevelPath from '../components/LevelPath';
import ProgressRing from '../components/ProgressRing';
import WeaknessHeatmap from '../components/WeaknessHeatmap';
import LevelReadinessCard from '../components/LevelReadinessCard';
import type { MistakeCategory } from '../types';
import { EVIDENCE_CONFIDENCE_LABELS } from '../types';

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
  const [noticeOpen, setNoticeOpen] = useState(hasPendingMigrationNotice());

  const pack = profile ? getLanguagePack(profile.targetLanguage) : null;
  const progress = getProgress();
  const diagnostic = getLatestDiagnostic();
  const mistakes = getMistakes();
  const dueMistakes = getDueMistakes();
  const sessions = getSessions();
  const lastSaved = getActiveProfileLastSavedAt();
  const evidence = getEvidence();
  const proficiency = getProficiency();

  if (!profile || !pack || !proficiency) return null;

  const showDiagnosticPrompt = !diagnostic && evidence.length === 0;

  const currentLevel = proficiency.currentEstimate;
  const headline = proficiency.boundary
    ? `${proficiency.currentEstimate}/${proficiency.boundary} boundary`
    : proficiency.currentEstimate;
  const confidenceLabel = EVIDENCE_CONFIDENCE_LABELS[proficiency.estimateConfidence];
  const currentRing = proficiency.readinessByLevel.find(l => l.level === currentLevel)?.readiness ?? 0;

  // Mistake category counts filtered to the active language's categories only.
  const langCategories = pack.metadata.weaknessCategories;
  const langCategorySet = new Set<MistakeCategory>(langCategories);
  const mistakeCounts: Partial<Record<MistakeCategory, number>> = {};
  for (const m of mistakes) {
    for (const cat of m.mistakeCategories) {
      if (langCategorySet.has(cat)) {
        mistakeCounts[cat] = (mistakeCounts[cat] ?? 0) + 1;
      }
    }
  }

  // Momentum (activity, not level).
  const recentSessions = sessions.slice(-5);
  const recentAccuracy = recentSessions.length > 0
    ? Math.round(recentSessions.reduce((sum, s) => sum + s.accuracy, 0) / recentSessions.length)
    : null;
  const reviewsCompleted = evidence.filter(e => e.isReview).length;

  const q = proficiency.evidenceQuality;

  function dismissNotice() {
    dismissMigrationNotice();
    setNoticeOpen(false);
  }

  return (
    <div className="space-y-6 pb-10" data-testid="dashboard">
      {noticeOpen && (
        <div className="bg-sky-50 dark:bg-sky-900/40 border border-sky-200 dark:border-sky-700 rounded-2xl p-4 flex items-start justify-between gap-3" data-testid="migration-notice">
          <div className="text-sm text-sky-900 dark:text-sky-100">
            Your progress was upgraded to a stricter scoring model. Some readiness estimates may change.
          </div>
          <button onClick={dismissNotice} className="text-sky-600 dark:text-sky-400 text-sm font-semibold shrink-0 hover:text-sky-800 dark:hover:text-sky-200">
            Dismiss
          </button>
        </div>
      )}

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Dashboard</h1>
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

      {showDiagnosticPrompt && (
        <div className="bg-indigo-50 dark:bg-indigo-900/40 border border-indigo-200 dark:border-indigo-700 rounded-2xl p-6 text-center">
          <div className="text-4xl mb-3">🎯</div>
          <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-1">Take the placement diagnostic</h3>
          <p className="text-slate-500 dark:text-slate-400 text-sm mb-4">
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

      {/* Current estimate + today */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm p-5">
          <div className="text-xs text-slate-400 uppercase tracking-wide font-semibold mb-3">CEFR estimate (evidence-based)</div>
          <div className="flex items-center gap-4">
            <ProgressRing pct={currentRing} size={72} stroke={7} color="#6366f1" label={currentLevel} />
            <div>
              <div className="text-2xl font-bold text-slate-800 dark:text-white">{headline}</div>
              <div className="text-xs text-slate-400 mt-1">{confidenceLabel}</div>
              {proficiency.nextTarget && (
                <div className="text-xs text-indigo-600 dark:text-indigo-400 font-medium mt-1">
                  Next target: {proficiency.nextTarget}
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

      {/* CEFR readiness — conservative, evidence-based */}
      <div>
        <h2 className="text-base font-bold text-slate-800 dark:text-white mb-3">CEFR readiness</h2>
        <p className="text-xs text-slate-400 mb-3">
          Based on unseen calibrated evidence. Repeated items and reviews don't raise your level.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3" data-testid="readiness-grid">
          {proficiency.readinessByLevel.map(lr => (
            <LevelReadinessCard key={lr.level} data={lr} isCurrent={lr.level === currentLevel} />
          ))}
        </div>
      </div>

      {/* Evidence quality */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm p-5" data-testid="evidence-quality">
        <div className="text-xs text-slate-400 uppercase tracking-wide font-semibold mb-3">Evidence quality</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <div className="text-xl font-bold text-emerald-600">{q.unseenCalibratedItems}</div>
            <div className="text-xs text-slate-400 mt-1">Unseen calibrated items</div>
          </div>
          <div>
            <div className="text-xl font-bold text-amber-600">{q.repeatedItems}</div>
            <div className="text-xs text-slate-400 mt-1">Repeated items</div>
          </div>
          <div>
            <div className="text-xl font-bold text-indigo-600">{q.writingSamples}</div>
            <div className="text-xs text-slate-400 mt-1">Writing samples</div>
          </div>
          <div>
            <div className="text-xl font-bold text-slate-700 dark:text-slate-200">{EVIDENCE_CONFIDENCE_LABELS[q.latestConfidence]}</div>
            <div className="text-xs text-slate-400 mt-1">Latest estimate confidence</div>
          </div>
        </div>
        {q.levelsWithInsufficientEvidence.length > 0 && (
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-3">
            Insufficient evidence at: {q.levelsWithInsufficientEvidence.join(', ')}
            {q.legacyItems > 0 && ` · ${q.legacyItems} legacy items preserved (low weight)`}
          </div>
        )}
      </div>

      {/* Recommendations + warnings */}
      {(proficiency.recommendedNextActions.length > 0 || proficiency.evidenceWarnings.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-indigo-50 dark:bg-indigo-900/40 rounded-2xl border border-indigo-200 dark:border-indigo-700 p-5">
            <div className="text-xs text-indigo-600 dark:text-indigo-400 uppercase tracking-wide font-semibold mb-2">Recommended next</div>
            <ul className="text-sm text-indigo-900 dark:text-indigo-100 space-y-1.5 leading-snug list-disc list-inside">
              {proficiency.recommendedNextActions.slice(0, 4).map((n, i) => <li key={i}>{n}</li>)}
            </ul>
          </div>
          <div className="bg-amber-50 dark:bg-amber-900/40 rounded-2xl border border-amber-200 dark:border-amber-700 p-5">
            <div className="text-xs text-amber-600 dark:text-amber-400 uppercase tracking-wide font-semibold mb-2">Evidence notes</div>
            {proficiency.evidenceWarnings.length === 0 && proficiency.bottlenecks.length === 0 ? (
              <div className="text-sm text-amber-900 dark:text-amber-100">Nothing flagged — keep building fresh evidence.</div>
            ) : (
              <ul className="text-sm text-amber-900 dark:text-amber-100 space-y-1.5 leading-snug list-disc list-inside">
                {[...proficiency.bottlenecks, ...proficiency.evidenceWarnings].slice(0, 4).map((n, i) => <li key={i}>{n}</li>)}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Review due */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm p-5 flex items-center justify-between">
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
          className="px-4 py-2.5 rounded-xl bg-red-50 dark:bg-red-900/40 text-red-600 dark:text-red-300 text-sm font-semibold hover:bg-red-100 dark:hover:bg-red-900/60 disabled:opacity-40"
        >
          Review now →
        </button>
      </div>

      {/* Momentum — activity, not proficiency */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm p-5" data-testid="momentum">
        <div className="text-xs text-slate-400 uppercase tracking-wide font-semibold mb-1">Momentum</div>
        <p className="text-xs text-slate-400 mb-3">Activity and habit — separate from your CEFR readiness.</p>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-4">
          <div className="text-center">
            <div className="text-xl font-bold text-slate-800 dark:text-white">{progress.totalMinutes}</div>
            <div className="text-xs text-slate-400 mt-1">Minutes</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-slate-800 dark:text-white">{progress.sessionCount}</div>
            <div className="text-xs text-slate-400 mt-1">Sessions</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-slate-800 dark:text-white">{progress.streakDays}</div>
            <div className="text-xs text-slate-400 mt-1">Day streak</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-slate-800 dark:text-white">{reviewsCompleted}</div>
            <div className="text-xs text-slate-400 mt-1">Reviews</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-slate-800 dark:text-white">
              {recentAccuracy !== null ? `${recentAccuracy}%` : '—'}
            </div>
            <div className="text-xs text-slate-400 mt-1">Practice acc.</div>
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
          <div key={skill} className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4">
            <div className="text-xs text-slate-400 uppercase tracking-wide font-semibold mb-1">{skill}</div>
            <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">Coming soon</div>
            <div className="text-xs text-slate-400 mt-1">Not included in your level estimate yet.</div>
          </div>
        ))}
      </div>

      {/* Heatmap */}
      {Object.keys(mistakeCounts).length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm p-5">
          <div className="text-xs text-slate-400 uppercase tracking-wide font-semibold mb-3">Weakness heatmap</div>
          <p className="text-xs text-slate-400 mb-3">Based on tracked mistakes. Red = most errors.</p>
          <WeaknessHeatmap mistakeCounts={mistakeCounts} categories={langCategories} />
        </div>
      )}

      <div className="text-center text-xs text-slate-400 pb-4">
        All CEFR estimates are unofficial. Writing scores are heuristic, not assessed by an examiner.
      </div>
    </div>
  );
}
