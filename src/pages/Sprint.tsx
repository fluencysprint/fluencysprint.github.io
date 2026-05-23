import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ExerciseRenderer from '../components/ExerciseRenderer';
import {
  getProgress, getDueMistakes, addSession, updateProgress, getSettings,
  getResumableSprint, saveResumableSprint,
  getRecentExerciseIds, markExercisesSeen,
} from '../lib/storage';
import { recordMistake, recordCorrectReview } from '../lib/scheduler';
import { nanoid, shuffle, percentOf } from '../lib/utils';
import { getActiveLanguagePack } from '../lib/activeLanguage';
import { getActiveProfile } from '../lib/profile';
import type { Exercise, Session, Skill, ResumableSprintState } from '../types';

type Phase = 'select' | 'resume_prompt' | 'running' | 'summary';

function buildSprintQueue(durationMins: 5 | 10 | 20): Exercise[] {
  const progress = getProgress();
  const settings = getSettings();
  const dueMistakes = getDueMistakes();
  const pack = getActiveLanguagePack();

  const objectiveTypes = new Set([
    'multipleChoice', 'cloze', 'connectorChoice',
    'collocationChoice', 'accentPractice', 'readingQuestion',
  ]);

  const allObjective = pack.exercises.filter(
    e => objectiveTypes.has(e.type) && e.skill !== 'listening' && e.skill !== 'speaking',
  );

  const recentIds = new Set(getRecentExerciseIds());

  // Helper: prefer non-recent candidates; fall back to full pool if necessary.
  function pickFresh(candidates: Exercise[], n: number): Exercise[] {
    const fresh = shuffle(candidates.filter(e => !recentIds.has(e.id)));
    if (fresh.length >= n) return fresh.slice(0, n);
    const stale = shuffle(candidates.filter(e => recentIds.has(e.id)));
    return [...fresh, ...stale].slice(0, n);
  }

  // Weak skills from past scores
  const weakSkills = (Object.entries(progress.skillScores) as [Skill, number][])
    .filter(([s]) => s !== 'listening' && s !== 'speaking')
    .sort(([, a], [, b]) => a - b)
    .slice(0, 3)
    .map(([s]) => s);

  const targetCount = durationMins === 5 ? 8 : durationMins === 10 ? 15 : 25;
  const selected: Exercise[] = [];

  const weakCount = Math.floor(targetCount * 0.5);
  const weakExercises = weakSkills.length > 0
    ? allObjective.filter(e => weakSkills.includes(e.skill))
    : allObjective;
  selected.push(...pickFresh(weakExercises, weakCount));

  const reviewCount = Math.floor(targetCount * 0.25);
  const reviewExercises = dueMistakes
    .slice(0, reviewCount)
    .map(m => pack.exercises.find(e => e.id === m.exerciseId))
    .filter((e): e is Exercise => !!e);
  selected.push(...reviewExercises);

  const used = new Set(selected.map(e => e.id));
  const remaining = allObjective.filter(e => !used.has(e.id));
  const needed = Math.max(0, targetCount - selected.length);
  selected.push(...pickFresh(remaining, needed));

  let queue = shuffle(selected);

  // Optionally include a single writing prompt per writingFrequency setting
  const shouldIncludeWriting =
    settings.writingFrequency === 'often'
      ? true
      : settings.writingFrequency === 'sometimes'
        ? Math.random() < 0.3
        : false;
  if (shouldIncludeWriting) {
    const writing = pack.exercises.find(
      e => e.type === 'writingPrompt' && e.cefrLevel === settings.targetLevel,
    ) ?? pack.exercises.find(e => e.type === 'writingPrompt');
    if (writing) queue = [...queue, writing];
  }
  return queue;
}

export default function Sprint() {
  const navigate = useNavigate();
  const profile = getActiveProfile();
  const pack = getActiveLanguagePack();

  const [phase, setPhase] = useState<Phase>('select');
  const [durationMins, setDurationMins] = useState<5 | 10 | 20>(10);
  const [queue, setQueue] = useState<Exercise[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [attempted, setAttempted] = useState(0);
  const [mistakesAdded, setMistakesAdded] = useState<string[]>([]);
  const [skillsWorked, setSkillsWorked] = useState<Set<Skill>>(new Set());
  const [resumeOffer, setResumeOffer] = useState<ResumableSprintState | null>(null);
  const startRef = useRef<number>(Date.now());
  const settings = getSettings();
  const progress = getProgress();

  useEffect(() => {
    const r = getResumableSprint();
    if (r && profile && r.language === profile.targetLanguage && r.itemIds.length > 0) {
      setResumeOffer(r);
      setPhase('resume_prompt');
    }
  }, [profile?.id]);

  function startSprint() {
    if (!profile) return;
    const q = buildSprintQueue(durationMins);
    setQueue(q);
    setCurrentIndex(0); setCorrect(0); setAttempted(0);
    setMistakesAdded([]); setSkillsWorked(new Set());
    startRef.current = Date.now();
    markExercisesSeen(q.map(e => e.id));
    setPhase('running');
    saveResumableSprint({
      language: profile.targetLanguage,
      itemIds: q.map(e => e.id),
      currentIndex: 0, correct: 0, attempted: 0,
      mistakesAdded: [], skillsWorked: [],
      durationMins,
      startedAt: new Date().toISOString(),
      lastSavedAt: new Date().toISOString(),
    });
  }

  function resumeFromState(state: ResumableSprintState) {
    const q = state.itemIds
      .map(id => pack.exercises.find(e => e.id === id))
      .filter((e): e is Exercise => !!e);
    if (q.length === 0) { saveResumableSprint(null); setResumeOffer(null); setPhase('select'); return; }
    setQueue(q);
    setCurrentIndex(Math.min(state.currentIndex, q.length));
    setCorrect(state.correct);
    setAttempted(state.attempted);
    setMistakesAdded(state.mistakesAdded);
    setSkillsWorked(new Set(state.skillsWorked));
    setDurationMins(state.durationMins);
    startRef.current = Date.now();
    setResumeOffer(null);
    setPhase('running');
  }

  function persistSprintProgress(nextIndex: number, c: number, a: number, m: string[], sk: Set<Skill>) {
    if (!profile) return;
    saveResumableSprint({
      language: profile.targetLanguage,
      itemIds: queue.map(e => e.id),
      currentIndex: nextIndex, correct: c, attempted: a,
      mistakesAdded: m, skillsWorked: [...sk],
      durationMins,
      startedAt: new Date(startRef.current).toISOString(),
      lastSavedAt: new Date().toISOString(),
    });
  }

  function handleAnswer(params: {
    correct: boolean; userAnswer: string; accentMissing: boolean;
    confidence: 'low' | 'medium' | 'high'; timeSpent: number;
  }) {
    const ex = queue[currentIndex];
    const newAttempted = attempted + 1;
    const newCorrect = correct + (params.correct ? 1 : 0);
    const newSkills = new Set([...skillsWorked, ex.skill]);
    let newMistakes = mistakesAdded;
    setAttempted(newAttempted); setCorrect(newCorrect); setSkillsWorked(newSkills);

    const dueMistake = getDueMistakes().find(m => m.exerciseId === ex.id);
    if (dueMistake) {
      if (params.correct) {
        recordCorrectReview(dueMistake.id, params.confidence, params.timeSpent);
      } else {
        recordMistake({
          exerciseId: ex.id, prompt: ex.prompt,
          userAnswer: params.userAnswer,
          correctAnswer: ex.correctAnswer ?? '',
          explanation: ex.explanation,
          mistakeCategories: ex.mistakeCategories,
          cefrLevel: ex.cefrLevel, skill: ex.skill,
          confidence: params.confidence, timeSpent: params.timeSpent,
          estimatedSeconds: ex.estimatedSeconds,
        });
      }
    } else if (!params.correct && ex.correctAnswer) {
      const record = recordMistake({
        exerciseId: ex.id, prompt: ex.prompt,
        userAnswer: params.userAnswer,
        correctAnswer: ex.correctAnswer,
        explanation: ex.explanation,
        mistakeCategories: ex.mistakeCategories,
        cefrLevel: ex.cefrLevel, skill: ex.skill,
        confidence: params.confidence, timeSpent: params.timeSpent,
        estimatedSeconds: ex.estimatedSeconds,
      });
      newMistakes = [...mistakesAdded, record.id];
      setMistakesAdded(newMistakes);
    }

    const nextIndex = currentIndex + 1;
    persistSprintProgress(nextIndex, newCorrect, newAttempted, newMistakes, newSkills);
    if (nextIndex >= queue.length) finishSprint(newCorrect, newAttempted, newMistakes, newSkills);
    else setCurrentIndex(nextIndex);
  }

  function finishSprint(c: number, a: number, m: string[], sk: Set<Skill>) {
    const timeSeconds = Math.round((Date.now() - startRef.current) / 1000);
    const acc = percentOf(c, a || 1);
    const session: Session = {
      id: nanoid(), date: new Date().toISOString(), type: 'sprint',
      durationSeconds: timeSeconds, exercisesAttempted: a,
      exercisesCorrect: c, accuracy: acc, skillsWorked: [...sk], mistakesAdded: m,
    };
    addSession(session);
    updateProgress({
      sessionCount: progress.sessionCount + 1,
      totalMinutes: progress.totalMinutes + Math.round(timeSeconds / 60),
      totalAttempted: (progress.totalAttempted ?? 0) + a,
      totalCorrect: (progress.totalCorrect ?? 0) + c,
    });
    saveResumableSprint(null);
    setPhase('summary');
  }

  if (!profile) return null;

  if (phase === 'resume_prompt' && resumeOffer) {
    return (
      <div className="space-y-4">
        <div className="bg-white border border-slate-100 rounded-2xl p-6">
          <h2 className="text-lg font-bold text-slate-800 mb-2">Resume your sprint?</h2>
          <p className="text-sm text-slate-500 mb-4">
            You were on item {resumeOffer.currentIndex + 1} of {resumeOffer.itemIds.length}.
          </p>
          <div className="flex gap-2">
            <button onClick={() => resumeFromState(resumeOffer)} className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700">Resume</button>
            <button onClick={() => { saveResumableSprint(null); setResumeOffer(null); setPhase('select'); }} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50">Restart</button>
            <button onClick={() => { saveResumableSprint(null); setResumeOffer(null); navigate('/'); }} className="px-3 py-2.5 text-slate-400 text-sm">Discard</button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'select') {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Daily Sprint</h1>
          <p className="text-slate-400 text-sm mt-1">
            {pack.metadata.label} · adaptive to your weak areas
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
          <div className="text-sm font-semibold text-slate-700">Choose duration:</div>
          <div className="grid grid-cols-3 gap-3">
            {([5, 10, 20] as const).map(mins => (
              <button
                key={mins}
                onClick={() => setDurationMins(mins)}
                className={`py-3 rounded-xl border-2 text-sm font-semibold transition-all
                  ${durationMins === mins
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                    : 'border-slate-200 text-slate-600 hover:border-indigo-200'
                  }`}
              >
                {mins} min
              </button>
            ))}
          </div>

          <div className="pt-2 text-sm text-slate-500 space-y-1">
            <div>~50% from your weakest skill areas</div>
            <div>~25% due mistake reviews</div>
            <div>~25% mixed practice</div>
            <div className="text-xs text-slate-400 pt-1">
              Writing prompt is included <strong>{settings.writingFrequency}</strong>. Change in Settings.
            </div>
          </div>

          <button
            onClick={startSprint}
            className="w-full py-3.5 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-colors"
          >
            Start sprint →
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'running') {
    const exercise = queue[currentIndex];
    if (!exercise) return null;
    const pct = (currentIndex / queue.length) * 100;
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium text-slate-500">Sprint — {currentIndex + 1}/{queue.length}</div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 capitalize">{exercise.skill.replace('_', ' ')}</span>
            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-indigo-100 text-indigo-700">
              {exercise.cefrLevel}
            </span>
          </div>
        </div>
        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
        <ExerciseRenderer
          exercise={exercise}
          onAnswer={handleAnswer}
          onSkip={() => {
            const nextIndex = currentIndex + 1;
            persistSprintProgress(nextIndex, correct, attempted, mistakesAdded, skillsWorked);
            if (nextIndex >= queue.length) finishSprint(correct, attempted, mistakesAdded, skillsWorked);
            else setCurrentIndex(nextIndex);
          }}
          showTimer={settings.showTimers}
        />
      </div>
    );
  }

  // summary
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Sprint complete!</h1>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 text-center">
          <div className="text-3xl font-bold text-indigo-600">{percentOf(correct, attempted || 1)}%</div>
          <div className="text-xs text-slate-400 mt-1">Accuracy</div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 text-center">
          <div className="text-3xl font-bold text-slate-800">{attempted}</div>
          <div className="text-xs text-slate-400 mt-1">Items</div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 text-center">
          <div className="text-3xl font-bold text-emerald-600">{Math.round((Date.now() - startRef.current) / 60000)}m</div>
          <div className="text-xs text-slate-400 mt-1">Time</div>
        </div>
      </div>
      <div className="flex gap-3">
        <button
          onClick={() => setPhase('select')}
          className="flex-1 py-3 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700"
        >
          Another sprint
        </button>
        <button
          onClick={() => navigate('/')}
          className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50"
        >
          Dashboard
        </button>
      </div>
    </div>
  );
}
