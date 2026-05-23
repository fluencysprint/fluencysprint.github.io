import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import ExerciseRenderer from '../components/ExerciseRenderer';
import {
  updateProgress, addDiagnosticResult, addWritingEntry,
  getResumableDiagnostic, saveResumableDiagnostic,
} from '../lib/storage';
import { recordMistake } from '../lib/scheduler';
import { nanoid } from '../lib/utils';
import { buildAdaptiveDiagnosticPlan, computePlacement, levelReadinessFromPlacement, skillScoresFromPlacement } from '../lib/placement';
import { getActiveProfile } from '../lib/profile';
import { getLanguagePack } from '../languages';
import type { DiagnosticAnswer, Exercise, ResumableDiagnosticState } from '../types';
import type { WritingAnalysisResult } from '../lib/writingAnalysis';

type Phase = 'intro' | 'resume_prompt' | 'running' | 'done';

export default function Diagnostic() {
  const navigate = useNavigate();
  const profile = getActiveProfile();
  const pack = profile ? getLanguagePack(profile.targetLanguage) : null;

  const [phase, setPhase] = useState<Phase>('intro');
  const [includeWriting, setIncludeWriting] = useState(true);
  const [diagnosticItems, setDiagnosticItems] = useState<Exercise[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<DiagnosticAnswer[]>([]);
  const startTimeRef = useRef<number>(Date.now());
  const [resumeOffer, setResumeOffer] = useState<ResumableDiagnosticState | null>(null);

  // On mount, check for a resumable diagnostic in this profile.
  useEffect(() => {
    const r = getResumableDiagnostic();
    if (r && profile && r.language === profile.targetLanguage && r.itemIds.length > 0) {
      setResumeOffer(r);
      setPhase('resume_prompt');
    }
  }, [profile?.id]);

  const allExercisesById = useMemo(() => {
    if (!pack) return new Map<string, Exercise>();
    return new Map(pack.exercises.map(e => [e.id, e]));
  }, [pack]);

  function buildAndStart(includeWritingArg: boolean) {
    if (!profile || !pack) return;
    const queue = buildAdaptiveDiagnosticPlan({
      language: profile.targetLanguage,
      selfEstimatedLevel: profile.selfEstimatedLevel,
      includeWriting: includeWritingArg,
    });
    setDiagnosticItems(queue);
    setCurrentIndex(0);
    setAnswers([]);
    startTimeRef.current = Date.now();
    setPhase('running');
    saveResumableDiagnostic({
      language: profile.targetLanguage,
      itemIds: queue.map(q => q.id),
      currentIndex: 0,
      answers: [],
      startedAt: new Date().toISOString(),
      lastSavedAt: new Date().toISOString(),
    });
  }

  function resumeFromState(state: ResumableDiagnosticState) {
    const queue = state.itemIds
      .map(id => allExercisesById.get(id))
      .filter((e): e is Exercise => !!e);
    if (queue.length === 0) {
      saveResumableDiagnostic(null);
      setPhase('intro');
      return;
    }
    setDiagnosticItems(queue);
    setCurrentIndex(Math.min(state.currentIndex, queue.length));
    setAnswers(state.answers);
    startTimeRef.current = Date.now() - (state.activeSeconds ?? 0) * 1000;
    setResumeOffer(null);
    setPhase('running');
  }

  function discardResume() {
    saveResumableDiagnostic(null);
    setResumeOffer(null);
    setPhase('intro');
  }

  function handleAnswer(params: {
    correct: boolean;
    userAnswer: string;
    accentMissing: boolean;
    confidence: 'low' | 'medium' | 'high';
    timeSpent: number;
    analysis?: WritingAnalysisResult;
  }) {
    const ex = diagnosticItems[currentIndex];
    const answer: DiagnosticAnswer = {
      exerciseId: ex.id,
      cefrLevel: ex.cefrLevel,
      skill: ex.skill,
      userAnswer: params.userAnswer,
      correct: params.correct,
      confidence: params.confidence,
      timeSpent: params.timeSpent,
      skipped: false,
    };
    const newAnswers = [...answers, answer];
    setAnswers(newAnswers);
    persistProgress(newAnswers, currentIndex + 1);

    if (!params.correct && ex.correctAnswer) {
      recordMistake({
        exerciseId: ex.id,
        prompt: ex.prompt,
        userAnswer: params.userAnswer,
        correctAnswer: ex.correctAnswer,
        explanation: ex.explanation,
        mistakeCategories: ex.mistakeCategories,
        cefrLevel: ex.cefrLevel,
        skill: ex.skill,
        confidence: params.confidence,
        timeSpent: params.timeSpent,
        estimatedSeconds: ex.estimatedSeconds,
      });
    }

    if (params.analysis && (ex.type === 'writingPrompt' || ex.type === 'registerRewrite')) {
      addWritingEntry({
        id: nanoid(),
        promptId: ex.id,
        date: new Date().toISOString(),
        text: params.userAnswer,
        durationSeconds: params.timeSpent,
        activeSeconds: params.timeSpent,
        selfScores: { selfRating: params.confidence === 'high' ? 3 : params.confidence === 'medium' ? 2 : 1 },
        weakCategories: params.analysis.suggestedFocusAreas,
        mode: 'diagnostic',
        analysisScore: params.analysis.score,
        wordCount: params.analysis.wordCount,
        rubricScores: { ...params.analysis.rubricScores } as Record<string, number>,
        cefrLevel: ex.cefrLevel,
        exampleAnswer: ex.exampleAnswer,
      });
      for (const cat of params.analysis.suggestedFocusAreas) {
        recordMistake({
          exerciseId: `writing-${ex.id}-${cat}`,
          prompt: ex.prompt.slice(0, 120),
          userAnswer: params.userAnswer.slice(0, 120),
          correctAnswer: 'See writing analysis',
          explanation: `Diagnostic writing analysis flagged: ${cat.replace(/_/g, ' ')}`,
          mistakeCategories: [cat],
          cefrLevel: ex.cefrLevel,
          skill: 'writing',
          confidence: params.confidence,
          timeSpent: params.timeSpent,
        });
      }
    }

    if (currentIndex + 1 >= diagnosticItems.length) {
      finishDiagnostic(newAnswers);
    } else {
      setCurrentIndex(currentIndex + 1);
    }
  }

  function handleSkipItem() {
    const ex = diagnosticItems[currentIndex];
    const answer: DiagnosticAnswer = {
      exerciseId: ex.id,
      cefrLevel: ex.cefrLevel,
      skill: ex.skill,
      userAnswer: '',
      correct: false,
      confidence: 'low',
      timeSpent: 0,
      skipped: true,
    };
    const newAnswers = [...answers, answer];
    setAnswers(newAnswers);
    persistProgress(newAnswers, currentIndex + 1);
    if (currentIndex + 1 >= diagnosticItems.length) {
      finishDiagnostic(newAnswers);
    } else {
      setCurrentIndex(currentIndex + 1);
    }
  }

  function persistProgress(allAnswers: DiagnosticAnswer[], nextIndex: number) {
    if (!profile) return;
    const activeSeconds = Math.round((Date.now() - startTimeRef.current) / 1000);
    saveResumableDiagnostic({
      language: profile.targetLanguage,
      itemIds: diagnosticItems.map(i => i.id),
      currentIndex: nextIndex,
      answers: allAnswers,
      startedAt: new Date(startTimeRef.current).toISOString(),
      lastSavedAt: new Date().toISOString(),
      activeSeconds,
    });
  }

  function finishDiagnostic(finalAnswers: DiagnosticAnswer[]) {
    if (!profile) return;
    const timeSpent = Math.round((Date.now() - startTimeRef.current) / 1000);
    const placement = computePlacement(profile.targetLanguage, finalAnswers);
    addDiagnosticResult({
      id: nanoid(),
      date: new Date().toISOString(),
      language: profile.targetLanguage,
      answers: finalAnswers,
      placement,
      timeSpent,
      itemCount: finalAnswers.filter(a => !a.skipped).length,
    });
    updateProgress({
      diagnosticComplete: true,
      skillScores: skillScoresFromPlacement(placement),
      levelReadiness: levelReadinessFromPlacement(placement),
    });
    saveResumableDiagnostic(null);
    setPhase('done');
    setTimeout(() => navigate('/'), 200);
  }

  if (!profile || !pack) return null;

  if (phase === 'resume_prompt' && resumeOffer) {
    const startedAt = new Date(resumeOffer.startedAt).toLocaleString();
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-indigo-900 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full">
          <div className="text-3xl mb-3">↻</div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Resume your diagnostic?</h2>
          <p className="text-sm text-slate-500 mb-6">
            You were on item {resumeOffer.currentIndex + 1} of {resumeOffer.itemIds.length}. Started {startedAt}.
          </p>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => resumeFromState(resumeOffer)}
              className="py-3 rounded-2xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700"
            >
              Resume
            </button>
            <button
              onClick={() => { saveResumableDiagnostic(null); setResumeOffer(null); setPhase('intro'); }}
              className="py-2.5 rounded-2xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50"
            >
              Restart from scratch
            </button>
            <button onClick={discardResume} className="py-2 text-slate-400 text-sm hover:text-slate-600">
              Discard and go to dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'intro') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-indigo-900 to-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-lg">
          <div className="bg-white rounded-3xl shadow-2xl p-8">
            <div className="text-center mb-6">
              <div className="text-4xl mb-3">🎯</div>
              <h1 className="text-2xl font-bold text-slate-800 mb-2">
                Adaptive {pack.metadata.label} placement
              </h1>
              <p className="text-slate-500 text-sm leading-relaxed">
                {pack.metadata.promptCopy.diagnosticIntro}
              </p>
            </div>

            <div className="bg-slate-50 rounded-2xl p-4 mb-5 space-y-2 text-sm text-slate-600">
              <div className="flex items-center gap-2"><span className="text-emerald-500">✓</span> 5–10 minutes</div>
              <div className="flex items-center gap-2"><span className="text-emerald-500">✓</span> Starts at A1 — only climbs if you show you are ready</div>
              <div className="flex items-center gap-2"><span className="text-emerald-500">✓</span> Skip any item — skips lower confidence, never inflates your level</div>
              <div className="flex items-center gap-2"><span className="text-amber-500">ℹ</span> Estimates are unofficial — not a substitute for certified testing</div>
            </div>

            <label className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3 mb-5">
              <span className="text-sm text-slate-700">
                Include a short writing prompt?
                <span className="block text-[11px] text-slate-400">Skipping is fine — productive-skill confidence will be lower.</span>
              </span>
              <input
                type="checkbox"
                checked={includeWriting}
                onChange={e => setIncludeWriting(e.target.checked)}
                className="h-5 w-5 accent-indigo-600"
              />
            </label>

            <button
              onClick={() => buildAndStart(includeWriting)}
              className="w-full py-3.5 rounded-2xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-colors mb-2"
            >
              Start diagnostic →
            </button>
            <button
              onClick={() => navigate('/')}
              className="w-full py-2.5 rounded-2xl text-slate-400 text-sm hover:text-slate-600 transition-colors"
            >
              Skip — I'll do this later
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'done') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-indigo-900 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 text-center max-w-sm w-full">
          <div className="text-5xl mb-4">📊</div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Diagnostic complete!</h2>
          <p className="text-slate-500 text-sm">Showing your placement report…</p>
        </div>
      </div>
    );
  }

  const exercise = diagnosticItems[currentIndex];
  if (!exercise) return null;
  const progress = ((currentIndex) / diagnosticItems.length) * 100;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-100 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="text-sm font-medium text-slate-500">
            Diagnostic — {currentIndex + 1} of {diagnosticItems.length}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400 capitalize">{exercise.skill.replace('_', ' ')}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${levelChip(exercise.cefrLevel)}`}>
              {exercise.cefrLevel}
            </span>
          </div>
        </div>
        <div className="max-w-2xl mx-auto mt-2">
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8">
        <ExerciseRenderer
          exercise={exercise}
          onAnswer={handleAnswer}
          onSkip={handleSkipItem}
          showTimer
        />
      </div>
    </div>
  );
}

function levelChip(level: string): string {
  switch (level) {
    case 'A1': return 'bg-emerald-100 text-emerald-700';
    case 'A2': return 'bg-emerald-100 text-emerald-700';
    case 'B1': return 'bg-sky-100 text-sky-700';
    case 'B2': return 'bg-indigo-100 text-indigo-700';
    case 'C1': return 'bg-amber-100 text-amber-700';
    default: return 'bg-slate-100 text-slate-700';
  }
}
