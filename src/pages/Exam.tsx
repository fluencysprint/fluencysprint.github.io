import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ExerciseRenderer from '../components/ExerciseRenderer';
import {
  addSession, updateProgress, getProgress,
  getRecentExerciseIds, markExercisesSeen, getEvidence,
} from '../lib/storage';
import { recordMistake } from '../lib/scheduler';
import { recordEvidence, itemFamilyOf } from '../lib/evidence';
import { buildReadinessExam } from '../lib/examSelector';
import { nanoid, percentOf } from '../lib/utils';
import { getActiveLanguagePack } from '../lib/activeLanguage';
import { getActiveProfile } from '../lib/profile';
import type { CEFRLevel, Exercise, Session } from '../types';

type Phase = 'select' | 'running' | 'results';

interface ExamConfig {
  id: string;
  title: string;
  description: string;
  itemCount: number;
  targetLevel: CEFRLevel;
}

function configsFor(targetLevel: CEFRLevel): ExamConfig[] {
  return [
    {
      id: 'cefr_general',
      title: `${targetLevel} readiness check`,
      description: `20 unseen-first items sampled across skills and levels around ${targetLevel}.`,
      itemCount: 20,
      targetLevel,
    },
    {
      id: 'cefr_full',
      title: 'Full CEFR sweep',
      description: 'A longer 25-item sweep balanced across A1 through C1.',
      itemCount: 25,
      targetLevel,
    },
  ];
}

export default function Exam() {
  const navigate = useNavigate();
  const profile = getActiveProfile();
  const progress = getProgress();
  const targetLevel = (profile?.targetLevel ?? 'B1') as CEFRLevel;
  const configs = configsFor(targetLevel);

  const [phase, setPhase] = useState<Phase>('select');
  const [config, setConfig] = useState<ExamConfig | null>(null);
  const [queue, setQueue] = useState<Exercise[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const freshIdsRef = useRef<Set<string>>(new Set());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [attempted, setAttempted] = useState(0);
  const [newEvidence, setNewEvidence] = useState(0);
  const [repeatedAnswered, setRepeatedAnswered] = useState(0);
  const [sessionStartedAt, setSessionStartedAt] = useState('');
  const startRef = useRef<number>(Date.now());

  function startExam(c: ExamConfig) {
    const pack = getActiveLanguagePack();
    const evidence = getEvidence();
    const seenExerciseIds = [...new Set(evidence.map(e => e.exerciseId))];
    const seenFamilyIds = [...new Set(evidence.map(e => e.itemFamilyId))];
    const selection = buildReadinessExam({
      exercises: pack.exercises,
      targetLevel: c.targetLevel,
      count: c.itemCount,
      recentExerciseIds: getRecentExerciseIds(),
      seenExerciseIds,
      seenFamilyIds,
    });
    const seenSet = new Set(seenExerciseIds);
    const seenFamSet = new Set(seenFamilyIds);
    freshIdsRef.current = new Set(
      selection.queue
        .filter(e => !seenSet.has(e.id) && !seenFamSet.has(itemFamilyOf(e)))
        .map(e => e.id),
    );
    setConfig(c);
    setQueue(selection.queue);
    setWarnings(selection.warnings);
    setCurrentIndex(0); setCorrect(0); setAttempted(0);
    setNewEvidence(0); setRepeatedAnswered(0);
    markExercisesSeen(selection.queue.map(e => e.id));
    startRef.current = Date.now();
    setSessionStartedAt(new Date().toISOString());
    setPhase('running');
  }

  function handleAnswer(params: {
    correct: boolean; userAnswer: string; accentMissing: boolean;
    confidence: 'low' | 'medium' | 'high'; timeSpent: number;
  }) {
    const ex = queue[currentIndex];
    setAttempted(a => a + 1);
    if (params.correct) setCorrect(c => c + 1);
    if (freshIdsRef.current.has(ex.id)) setNewEvidence(n => n + 1);
    else setRepeatedAnswered(r => r + 1);

    recordEvidence({
      exercise: ex,
      languageId: profile!.targetLanguage,
      activityType: 'readiness_exam',
      correct: params.correct,
      userAnswer: params.userAnswer,
      confidence: params.confidence,
      timeSpentSeconds: params.timeSpent,
    });

    if (!params.correct && ex.correctAnswer) {
      recordMistake({
        exerciseId: ex.id, prompt: ex.prompt,
        userAnswer: params.userAnswer, correctAnswer: ex.correctAnswer,
        explanation: ex.explanation, mistakeCategories: ex.mistakeCategories,
        cefrLevel: ex.cefrLevel, skill: ex.skill,
        confidence: params.confidence, timeSpent: params.timeSpent,
        estimatedSeconds: ex.estimatedSeconds,
      });
    }
    if (currentIndex + 1 >= queue.length) finish();
    else setCurrentIndex(i => i + 1);
  }

  function handleSkip() {
    const ex = queue[currentIndex];
    recordEvidence({
      exercise: ex,
      languageId: profile!.targetLanguage,
      activityType: 'readiness_exam',
      correct: false,
      skipped: true,
      userAnswer: '',
      confidence: 'low',
      timeSpentSeconds: 0,
    });
    if (currentIndex + 1 >= queue.length) finish();
    else setCurrentIndex(i => i + 1);
  }

  function finish() {
    const timeSeconds = Math.round((Date.now() - startRef.current) / 1000);
    const acc = percentOf(correct, attempted || 1);
    const session: Session = {
      id: nanoid(), date: new Date().toISOString(), type: 'exam',
      durationSeconds: timeSeconds, exercisesAttempted: attempted + 1,
      exercisesCorrect: correct, accuracy: acc, skillsWorked: [], mistakesAdded: [],
    };
    addSession(session);
    updateProgress({
      sessionCount: progress.sessionCount + 1,
      totalMinutes: progress.totalMinutes + Math.round(timeSeconds / 60),
    });
    setPhase('results');
  }

  if (phase === 'running' && queue.length > 0) {
    const exercise = queue[currentIndex];
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium text-slate-500 dark:text-slate-400">Exam — {currentIndex + 1}/{queue.length}</div>
          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300">{exercise.cefrLevel}</span>
        </div>
        <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
          <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${(currentIndex / queue.length) * 100}%` }} />
        </div>
        <ExerciseRenderer
          exercise={exercise}
          onAnswer={handleAnswer}
          onSkip={handleSkip}
          showTimer
          choiceSeed={sessionStartedAt ? sessionStartedAt + exercise.id : undefined}
        />
      </div>
    );
  }

  if (phase === 'results' && config) {
    const acc = percentOf(correct, attempted || 1);
    const memorisedRisk = repeatedAnswered > newEvidence && newEvidence < 5;
    return (
      <div className="space-y-6" data-testid="exam-results">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">{config.title} — results</h1>
          <p className="text-slate-400 text-sm mt-1">
            Exam score reflects this attempt. New proficiency evidence is tracked separately.
          </p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm p-4 text-center">
            <div className="text-2xl font-bold text-indigo-600">{acc}%</div>
            <div className="text-xs text-slate-400 mt-1">Exam score</div>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm p-4 text-center">
            <div className="text-2xl font-bold text-slate-800 dark:text-white">{correct}/{attempted}</div>
            <div className="text-xs text-slate-400 mt-1">Correct</div>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm p-4 text-center" data-testid="exam-new-evidence">
            <div className="text-2xl font-bold text-emerald-600">{newEvidence}</div>
            <div className="text-xs text-slate-400 mt-1">New unseen evidence</div>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm p-4 text-center">
            <div className="text-2xl font-bold text-amber-600">{repeatedAnswered}</div>
            <div className="text-xs text-slate-400 mt-1">Repeated items</div>
          </div>
        </div>

        {memorisedRisk && (
          <div className="bg-amber-50 dark:bg-amber-900/40 border border-amber-200 dark:border-amber-700 rounded-2xl p-4 text-sm text-amber-900 dark:text-amber-100">
            This improves review performance, but does not add much new level evidence — most
            items were repeats. Try a fresh drill for stronger readiness signal.
          </div>
        )}

        <button
          onClick={() => navigate('/')}
          className="w-full py-3 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700"
        >
          Back to dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Long readiness check</h1>
        <p className="text-slate-400 text-sm mt-1">
          Unseen-first sweep across CEFR levels — unofficial practice. Repeated questions count
          as practice, not new proficiency evidence.
        </p>
      </div>
      {warnings.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/40 border border-amber-200 dark:border-amber-700 rounded-2xl p-3 text-xs text-amber-900 dark:text-amber-100 space-y-1">
          {warnings.map((w, i) => <div key={i}>⚠ {w}</div>)}
        </div>
      )}
      <div className="space-y-3">
        {configs.map(c => (
          <button
            key={c.id}
            onClick={() => startExam(c)}
            className="w-full text-left bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm p-5 hover:border-indigo-300 dark:hover:border-indigo-500"
          >
            <div className="text-sm font-bold text-slate-800 dark:text-white">{c.title}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{c.description}</div>
            <div className="text-xs text-slate-400 mt-2">{c.itemCount} items</div>
          </button>
        ))}
      </div>
    </div>
  );
}
