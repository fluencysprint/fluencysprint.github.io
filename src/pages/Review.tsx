import React, { useEffect, useState } from 'react';
import { getMistakes, getDueMistakes, getOverdueMistakes } from '../lib/storage';
import { recordCorrectReview, recordMistake, sortMistakesByPriority } from '../lib/scheduler';
import { recordEvidence } from '../lib/evidence';
import { getActiveLanguagePack } from '../lib/activeLanguage';
import { getActiveProfile } from '../lib/profile';
import ExerciseRenderer from '../components/ExerciseRenderer';
import type { MistakeRecord, MistakeCategory } from '../types';
import { MISTAKE_LABELS } from '../types';

type Filter = 'all' | 'due' | 'overdue' | MistakeCategory;
type Phase = 'list' | 'reviewing' | 'done';

export default function Review() {
  const pack = getActiveLanguagePack();
  const [phase, setPhase] = useState<Phase>('list');
  const [, setFilter] = useState<Filter>('due');
  const [queue, setQueue] = useState<MistakeRecord[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [reviewedCount, setReviewedCount] = useState(0);
  const [allMistakes, setAllMistakes] = useState<MistakeRecord[]>([]);
  // Stable seed for choice order within this review session.
  const [sessionStartedAt] = useState(() => new Date().toISOString());

  useEffect(() => {
    setAllMistakes(getMistakes());
  }, [phase]);

  const dueMistakes = getDueMistakes();
  const overdueMistakes = getOverdueMistakes();
  const nonMasteredMistakes = allMistakes.filter(m => m.status !== 'mastered');

  const langCategorySet = new Set<MistakeCategory>(pack.metadata.weaknessCategories);
  const catCounts: Partial<Record<MistakeCategory, number>> = {};
  for (const m of nonMasteredMistakes) {
    for (const cat of m.mistakeCategories) {
      if (langCategorySet.has(cat)) {
        catCounts[cat] = (catCounts[cat] ?? 0) + 1;
      }
    }
  }
  const topCats = (Object.entries(catCounts) as [MistakeCategory, number][])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  function startReview(items: MistakeRecord[]) {
    if (items.length === 0) return;
    setQueue(sortMistakesByPriority(items));
    setCurrentIndex(0);
    setReviewedCount(0);
    setPhase('reviewing');
  }

  function handleAnswer(params: {
    correct: boolean; userAnswer: string; accentMissing: boolean;
    confidence: 'low' | 'medium' | 'high'; timeSpent: number;
  }) {
    const record = queue[currentIndex];
    const ex = pack.exercises.find(e => e.id === record.exerciseId);
    const profile = getActiveProfile();
    if (ex && profile) {
      // Review evidence helps retention but carries zero level-promotion weight.
      recordEvidence({
        exercise: ex,
        languageId: profile.targetLanguage,
        activityType: 'review',
        correct: params.correct,
        userAnswer: params.userAnswer,
        confidence: params.confidence,
        timeSpentSeconds: params.timeSpent,
        isReview: true,
      });
    }
    if (params.correct) {
      recordCorrectReview(record.id, params.confidence, params.timeSpent);
    } else if (ex) {
      recordMistake({
        exerciseId: record.exerciseId,
        prompt: record.prompt,
        userAnswer: params.userAnswer,
        correctAnswer: record.correctAnswer,
        explanation: record.explanation,
        mistakeCategories: record.mistakeCategories,
        cefrLevel: record.cefrLevel,
        skill: record.skill,
        confidence: params.confidence,
        timeSpent: params.timeSpent,
        estimatedSeconds: ex.estimatedSeconds,
      });
    }

    setReviewedCount(c => c + 1);
    if (currentIndex + 1 >= queue.length) setPhase('done');
    else setCurrentIndex(i => i + 1);
  }

  if (phase === 'reviewing') {
    const record = queue[currentIndex];
    const exercise = pack.exercises.find(e => e.id === record.exerciseId);
    if (!exercise) {
      setCurrentIndex(i => i + 1);
      return null;
    }
    const reviewExercise = { ...exercise, prompt: record.prompt || exercise.prompt };

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium text-slate-500">
            Review — {currentIndex + 1}/{queue.length}
          </div>
          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-indigo-100 text-indigo-700">
            {exercise.cefrLevel}
          </span>
        </div>
        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${(currentIndex / queue.length) * 100}%` }} />
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-xs text-amber-700">
          You've missed this item {record.attempts}× before
        </div>
        <ExerciseRenderer
          exercise={reviewExercise}
          onAnswer={handleAnswer}
          onSkip={() => {
            if (currentIndex + 1 >= queue.length) setPhase('done');
            else setCurrentIndex(i => i + 1);
          }}
          showTimer
          choiceSeed={sessionStartedAt + record.exerciseId}
        />
      </div>
    );
  }

  if (phase === 'done') {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Review complete</h1>
          <p className="text-slate-400 text-sm mt-1">Items reviewed: {reviewedCount}</p>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center">
          <div className="text-4xl mb-3">✓</div>
          <div className="text-lg font-bold text-slate-800">Good work!</div>
        </div>
        <button
          onClick={() => setPhase('list')}
          className="w-full py-3 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700"
        >
          Back to review list
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Mistake review</h1>
        <p className="text-slate-400 text-sm mt-1">Spaced repetition over your tracked mistakes</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-red-50 rounded-2xl p-3 text-center border border-red-100">
          <div className="text-2xl font-bold text-red-600">{overdueMistakes.length}</div>
          <div className="text-xs text-red-400">Overdue</div>
        </div>
        <div className="bg-amber-50 rounded-2xl p-3 text-center border border-amber-100">
          <div className="text-2xl font-bold text-amber-600">{dueMistakes.length}</div>
          <div className="text-xs text-amber-400">Due today</div>
        </div>
        <div className="bg-slate-50 rounded-2xl p-3 text-center border border-slate-100">
          <div className="text-2xl font-bold text-slate-600">{nonMasteredMistakes.length}</div>
          <div className="text-xs text-slate-400">Total active</div>
        </div>
      </div>

      <div className="space-y-2">
        {dueMistakes.length > 0 && (
          <button onClick={() => startReview(dueMistakes)} className="w-full py-3 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700">
            Review {dueMistakes.length} due item{dueMistakes.length > 1 ? 's' : ''} →
          </button>
        )}
        {dueMistakes.length === 0 && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center text-sm text-emerald-700">
            ✓ No items due right now. Check back tomorrow.
          </div>
        )}
        <button
          onClick={() => startReview(nonMasteredMistakes)}
          disabled={nonMasteredMistakes.length === 0}
          className="w-full py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 disabled:opacity-40"
        >
          Review all active mistakes
        </button>
      </div>

      {topCats.length > 0 && (
        <div>
          <div className="text-xs text-slate-400 uppercase tracking-wide font-semibold mb-3">By category</div>
          <div className="grid grid-cols-2 gap-2">
            {topCats.map(([cat, count]) => {
              const items = nonMasteredMistakes.filter(m => m.mistakeCategories.includes(cat));
              return (
                <button
                  key={cat}
                  onClick={() => { setFilter(cat); startReview(items); }}
                  className="text-left px-3 py-2.5 rounded-xl bg-white border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50"
                >
                  <div className="text-sm font-medium text-slate-700">{MISTAKE_LABELS[cat]}</div>
                  <div className="text-xs text-slate-400 mt-0.5">{count}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {nonMasteredMistakes.length === 0 && (
        <div className="text-center py-12">
          <div className="text-4xl mb-3">🎉</div>
          <div className="text-lg font-bold text-slate-700">No active mistakes!</div>
          <p className="text-sm text-slate-400 mt-1">Keep practicing to build your review queue.</p>
        </div>
      )}
    </div>
  );
}
