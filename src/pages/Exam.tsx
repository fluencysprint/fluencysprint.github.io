import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ExerciseRenderer from '../components/ExerciseRenderer';
import { addSession, updateProgress, getProgress } from '../lib/storage';
import { recordMistake } from '../lib/scheduler';
import { nanoid, percentOf, shuffle } from '../lib/utils';
import { getActiveLanguagePack } from '../lib/activeLanguage';
import { getActiveProfile } from '../lib/profile';
import type { CEFRLevel, Exercise, Session } from '../types';

type Phase = 'select' | 'running' | 'results';

interface ExamConfig {
  id: string;
  title: string;
  description: string;
  itemCount: number;
  levels: CEFRLevel[];
}

function configsFor(targetLevel: CEFRLevel): ExamConfig[] {
  // Long readiness checks centered on the user's level + the level above.
  const order: CEFRLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1'];
  const idx = order.indexOf(targetLevel);
  const range = order.slice(Math.max(0, idx - 1), Math.min(order.length, idx + 2));
  return [
    {
      id: 'cefr_general',
      title: `${targetLevel} readiness check`,
      description: `Long-form practice across ${range.join(', ')} items. Estimate readiness for ${targetLevel}.`,
      itemCount: 20,
      levels: range,
    },
    {
      id: 'cefr_full',
      title: 'Full CEFR sweep',
      description: 'Items from every level — A1 through C1.',
      itemCount: 25,
      levels: order,
    },
  ];
}

function buildExamQueue(config: ExamConfig): Exercise[] {
  const pack = getActiveLanguagePack();
  const pool = pack.exercises.filter(
    e => config.levels.includes(e.cefrLevel)
      && ['multipleChoice', 'cloze', 'connectorChoice', 'collocationChoice', 'readingQuestion'].includes(e.type)
      && e.skill !== 'listening' && e.skill !== 'speaking',
  );
  return shuffle(pool).slice(0, config.itemCount);
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
  const [currentIndex, setCurrentIndex] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [attempted, setAttempted] = useState(0);
  const startRef = useRef<number>(Date.now());

  function startExam(c: ExamConfig) {
    setConfig(c);
    setQueue(buildExamQueue(c));
    setCurrentIndex(0); setCorrect(0); setAttempted(0);
    startRef.current = Date.now();
    setPhase('running');
  }

  function handleAnswer(params: {
    correct: boolean; userAnswer: string; accentMissing: boolean;
    confidence: 'low' | 'medium' | 'high'; timeSpent: number;
  }) {
    const ex = queue[currentIndex];
    setAttempted(a => a + 1);
    if (params.correct) setCorrect(c => c + 1);
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
          <div className="text-sm font-medium text-slate-500">Exam — {currentIndex + 1}/{queue.length}</div>
          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-indigo-100 text-indigo-700">{exercise.cefrLevel}</span>
        </div>
        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${(currentIndex / queue.length) * 100}%` }} />
        </div>
        <ExerciseRenderer
          exercise={exercise}
          onAnswer={handleAnswer}
          onSkip={() => {
            if (currentIndex + 1 >= queue.length) finish();
            else setCurrentIndex(i => i + 1);
          }}
          showTimer
        />
      </div>
    );
  }

  if (phase === 'results' && config) {
    const acc = percentOf(correct, attempted || 1);
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{config.title} — results</h1>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 text-center">
            <div className="text-3xl font-bold text-indigo-600">{acc}%</div>
            <div className="text-xs text-slate-400 mt-1">Accuracy</div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 text-center">
            <div className="text-3xl font-bold text-slate-800">{correct}/{attempted}</div>
            <div className="text-xs text-slate-400 mt-1">Correct</div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 text-center">
            <div className="text-3xl font-bold text-emerald-600">{queue.length}</div>
            <div className="text-xs text-slate-400 mt-1">Items</div>
          </div>
        </div>
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
        <h1 className="text-2xl font-bold text-slate-800">Long readiness check</h1>
        <p className="text-slate-400 text-sm mt-1">
          Longer sweep across multiple CEFR levels — unofficial practice.
        </p>
      </div>
      <div className="space-y-3">
        {configs.map(c => (
          <button
            key={c.id}
            onClick={() => startExam(c)}
            className="w-full text-left bg-white rounded-2xl border border-slate-100 shadow-sm p-5 hover:border-indigo-300"
          >
            <div className="text-sm font-bold text-slate-800">{c.title}</div>
            <div className="text-xs text-slate-500 mt-1">{c.description}</div>
            <div className="text-xs text-slate-400 mt-2">{c.itemCount} items · {c.levels.join(' / ')}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
