import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { Exercise } from '../types';
import { checkAnswer, seededShuffle } from '../lib/utils';
import { getActiveLanguagePack } from '../lib/activeLanguage';
import LanguageInput from './LanguageInput';
import WordCounter from './WordCounter';
import WritingFeedback from './WritingFeedback';
import { analyzeWriting, type WritingAnalysisResult } from '../lib/writingAnalysis';
import { getSettings, getDraft, clearDraft } from '../lib/storage';
import { getActiveLanguageId } from '../lib/activeLanguage';

interface Props {
  exercise: Exercise;
  onAnswer: (params: {
    correct: boolean;
    userAnswer: string;
    accentMissing: boolean;
    confidence: 'low' | 'medium' | 'high';
    timeSpent: number;
    analysis?: WritingAnalysisResult;
  }) => void;
  onSkip?: () => void;
  showTimer?: boolean;
  /**
   * Stable seed for this attempt's choice display order.
   * Build as: sessionStartedAt + exercise.id
   * Same seed → same order (reload-safe). Omit to keep original order.
   */
  choiceSeed?: string;
}

const OBJECTIVE_TYPES = new Set([
  'multipleChoice',
  'cloze',
  'connectorChoice',
  'collocationChoice',
  'accentPractice',
  'readingQuestion',
  'listeningLikePrompt',
]);

const WRITING_TYPES = new Set(['writingPrompt', 'registerRewrite', 'sentenceTransformation']);

function inferTaskType(exercise: Exercise) {
  if (exercise.taskType) return exercise.taskType;
  const p = exercise.prompt.toLowerCase();
  if (exercise.type === 'registerRewrite') return 'register_rewrite';
  if (p.includes('correo formal') || p.includes('formal email') || p.includes('carta de motivación')) return 'formal_email';
  if (p.includes('opinion') || p.includes('opinión') || p.includes('argumenta')) return 'opinion';
  if (p.includes('informe') || p.includes('report')) return 'report';
  if (p.includes('ensayo') || p.includes('comentario')) return 'argumentative';
  return 'general';
}

export default function ExerciseRenderer({ exercise, onAnswer, onSkip, showTimer = true, choiceSeed }: Props) {
  const [selected, setSelected] = useState<string>('');
  const [textInput, setTextInput] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<{ correct: boolean; accentMissing: boolean } | null>(null);
  const [analysis, setAnalysis] = useState<WritingAnalysisResult | null>(null);
  const [confidence, setConfidence] = useState<'low' | 'medium' | 'high' | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const startTimeRef = useRef<number>(Date.now());

  const settings = getSettings();

  // Stable shuffled order for this attempt. Never mutates exercise.choices.
  const displayChoices = useMemo(() => {
    if (!exercise.choices || exercise.choices.length === 0) return [];
    if (!choiceSeed) return exercise.choices;
    return seededShuffle(exercise.choices, choiceSeed);
  }, [exercise.choices, choiceSeed]);

  const isObjective = OBJECTIVE_TYPES.has(exercise.type);
  const isWriting = WRITING_TYPES.has(exercise.type);
  const isMultipleChoice = !!exercise.choices && exercise.choices.length > 0;
  const draftSlot = isWriting ? `ex.${exercise.id}` : undefined;

  // Reset all per-exercise state whenever a new exercise is rendered.
  useEffect(() => {
    setSelected('');
    setSubmitted(false);
    setResult(null);
    setAnalysis(null);
    setConfidence(null);
    setElapsed(0);
    startTimeRef.current = Date.now();

    // Restore writing draft if present
    if (draftSlot) {
      const stored = getDraft(draftSlot);
      setTextInput(stored ?? '');
    } else {
      setTextInput('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercise.id]);

  useEffect(() => {
    if (!showTimer || submitted) return;
    const interval = setInterval(
      () => setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000)),
      500,
    );
    return () => clearInterval(interval);
  }, [showTimer, submitted, exercise.id]);

  const readingText = exercise.readingTextId
    ? getActiveLanguagePack().readingTexts.find(rt => rt.id === exercise.readingTextId) ?? null
    : null;
  const canSubmit = isMultipleChoice ? selected.length > 0 : textInput.trim().length > 0;

  const taskType = useMemo(() => inferTaskType(exercise), [exercise]);

  const handleSubmit = useCallback(() => {
    if (submitted) return;
    const userAnswer = isMultipleChoice ? selected : textInput.trim();
    if (!userAnswer) return;

    let res: { correct: boolean; accentMissing: boolean };
    if (exercise.correctAnswer) {
      res = checkAnswer(
        userAnswer,
        exercise.correctAnswer,
        exercise.acceptableAnswers,
        settings.accentMode,
      );
    } else {
      res = { correct: true, accentMissing: false };
    }

    setResult(res);

    if (isWriting) {
      const a = analyzeWriting({
        text: userAnswer,
        prompt: exercise.prompt,
        languageId: getActiveLanguageId(),
        cefrLevel: exercise.cefrLevel,
        taskType,
        wordTargetMin: exercise.wordTargetMin,
        wordTargetMax: exercise.wordTargetMax,
        requiredElements: exercise.requiredElements,
      });
      setAnalysis(a);
    }

    setSubmitted(true);
  }, [submitted, isMultipleChoice, selected, textInput, exercise, settings.accentMode, isWriting, taskType]);

  const handleConfirm = useCallback(
    (conf: 'low' | 'medium' | 'high') => {
      setConfidence(conf);
      const userAnswer = isMultipleChoice ? selected : textInput.trim();
      const res = result ?? { correct: true, accentMissing: false };
      const timeSpent = Math.max(1, Math.round((Date.now() - startTimeRef.current) / 1000));
      // Clear draft once successfully submitted and rated
      if (draftSlot) clearDraft(draftSlot);
      onAnswer({ ...res, userAnswer, confidence: conf, timeSpent, analysis: analysis ?? undefined });
    },
    [isMultipleChoice, selected, textInput, result, onAnswer, analysis, draftSlot],
  );

  function handleEdit() {
    setSubmitted(false);
    setResult(null);
    setAnalysis(null);
    startTimeRef.current = Date.now();
  }

  // Enter shortcut: only for objective items, only with valid answer, never from textareas.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Enter' || e.shiftKey || e.metaKey || e.ctrlKey || e.altKey) return;
      if (submitted) return;
      if (!isObjective) return;
      if (!canSubmit) return;
      const target = e.target as HTMLElement | null;
      if (target?.tagName === 'BUTTON' && target.dataset.role === 'check-answer') return;
      e.preventDefault();
      handleSubmit();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isObjective, submitted, canSubmit, handleSubmit]);

  const timerColor = elapsed > exercise.estimatedSeconds * 1.5 ? 'text-red-500' : 'text-slate-400';

  return (
    <div className="space-y-5" data-testid="exercise-renderer">
      {/* Timer */}
      {showTimer && (
        <div className={`text-xs font-mono ${timerColor} text-right`} data-testid="exercise-timer">
          {elapsed}s / ~{exercise.estimatedSeconds}s
        </div>
      )}

      {/* Reading text */}
      {readingText && (
        <div className="bg-slate-50 dark:bg-slate-700 rounded-xl p-4 text-sm text-slate-700 dark:text-slate-200 leading-relaxed border border-slate-200 dark:border-slate-600">
          <div className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-2">
            {readingText.title}
          </div>
          <p className="whitespace-pre-wrap">{readingText.text}</p>
        </div>
      )}

      {/* Inline listening / context */}
      {exercise.context && !readingText && (
        <div className="bg-indigo-50 dark:bg-indigo-900/40 rounded-xl p-4 text-sm text-slate-700 dark:text-slate-200 leading-relaxed border border-indigo-100 dark:border-indigo-800">
          <div className="text-xs font-semibold text-indigo-400 dark:text-indigo-300 uppercase tracking-wide mb-2 flex items-center gap-2">
            <span>🎧</span> Listen &amp; understand
          </div>
          <p className="whitespace-pre-wrap">{exercise.context}</p>
        </div>
      )}

      {/* Prompt */}
      <div className="text-base font-medium text-slate-800 dark:text-slate-100 leading-relaxed whitespace-pre-wrap">
        {exercise.prompt}
      </div>

      {/* Heuristic disclosure for subjective during diagnostic */}
      {isWriting && !submitted && (
        <div className="text-xs text-slate-400 bg-slate-50 dark:bg-slate-700 rounded-lg px-3 py-2 border border-slate-100 dark:border-slate-600">
          This is a subjective task. Your answer is preserved and analyzed locally with a
          rule-based evaluator. For official scoring, use a teacher or mock exam.
        </div>
      )}

      {/* Register rewrite instructions and checklist */}
      {exercise.type === 'registerRewrite' && !submitted && (
        <div className="bg-sky-50 dark:bg-sky-900/40 rounded-xl p-4 border border-sky-100 dark:border-sky-800 space-y-3" data-testid="rewrite-instructions">
          <div className="text-xs font-semibold text-sky-600 dark:text-sky-400 uppercase tracking-wide">How to answer</div>
          <ul className="space-y-1.5 text-sm text-slate-700 dark:text-slate-200">
            <li>• Rewrite the sentence in a more formal and professional way.</li>
            <li>• Keep the same meaning.</li>
            <li>• Use one polite sentence.</li>
            {exercise.wordTargetMin !== undefined && exercise.wordTargetMax !== undefined && (
              <li>• Expected length: {exercise.wordTargetMin}–{exercise.wordTargetMax} words.</li>
            )}
          </ul>
          {exercise.checklist && exercise.checklist.length > 0 && (
            <div className="pt-2 border-t border-sky-100 dark:border-sky-800">
              <div className="text-xs font-semibold text-sky-600 dark:text-sky-400 uppercase tracking-wide mb-2">Before you submit, check:</div>
              <ul className="space-y-1.5 text-sm text-slate-700 dark:text-slate-200">
                {exercise.checklist.map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-sky-400 shrink-0">□</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Multiple choice */}
      {isMultipleChoice && !submitted && (
        <div className="space-y-2" role="radiogroup" aria-label="Answer choices">
          {displayChoices.map(choice => (
            <button
              key={choice}
              type="button"
              role="radio"
              aria-checked={selected === choice}
              onClick={() => setSelected(choice)}
              className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all text-sm font-medium
                ${
                  selected === choice
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-200'
                    : 'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:border-indigo-300 dark:hover:border-indigo-500 hover:bg-indigo-50/30 dark:hover:bg-indigo-900/20'
                }`}
            >
              {choice}
            </button>
          ))}
        </div>
      )}

      {/* Cloze / text input (objective) */}
      {!isMultipleChoice && isObjective && !submitted && (
        <LanguageInput
          value={textInput}
          onChange={setTextInput}
          placeholder="Type your answer..."
          autoFocus
        />
      )}

      {/* Subjective writing area */}
      {isWriting && !submitted && (
        <div className="space-y-2">
          <LanguageInput
            value={textInput}
            onChange={setTextInput}
            placeholder="Write your answer..."
            multiline
            rows={8}
            draftSlot={draftSlot}
          />
          <WordCounter
            text={textInput}
            min={exercise.wordTargetMin}
            max={exercise.wordTargetMax}
            activeSeconds={showTimer ? elapsed : undefined}
          />
        </div>
      )}

      {/* Submit row */}
      {!submitted && (
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            data-role="check-answer"
            className="flex-1 py-3 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {isWriting ? 'Submit for analysis' : 'Check answer'}
          </button>
          {onSkip && (
            <button
              type="button"
              onClick={onSkip}
              className="px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              Skip
            </button>
          )}
        </div>
      )}

      {/* Subjective feedback */}
      {submitted && isWriting && analysis && (
        <WritingFeedback
          userText={textInput.trim()}
          analysis={analysis}
          exampleAnswer={exercise.exampleAnswer}
          onSelfRate={handleConfirm}
          onEdit={handleEdit}
          selfRating={confidence}
          saved
        />
      )}

      {/* Objective feedback */}
      {submitted && isObjective && result && (
        <div
          data-testid="exercise-feedback"
          className={`rounded-xl p-4 ${
            result.correct ? 'bg-emerald-50 dark:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-700' : 'bg-red-50 dark:bg-red-900/40 border border-red-200 dark:border-red-700'
          }`}
        >
          <div
            className={`font-semibold text-sm mb-1 ${
              result.correct ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'
            }`}
          >
            {result.correct
              ? result.accentMissing
                ? '✓ Accepted — but remember the accent mark!'
                : '✓ Correct!'
              : `✗ Incorrect — correct answer: ${exercise.correctAnswer}`}
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{exercise.explanation}</p>

          {isMultipleChoice && !result.correct && selected && (
            <div className="mt-2 text-xs text-red-600 dark:text-red-400">Your answer: {selected}</div>
          )}

          {isMultipleChoice && (
            <div className="space-y-1.5 mt-3">
              {displayChoices.map(choice => {
                const isCorrect = choice === exercise.correctAnswer;
                const wasSelected = choice === selected;
                return (
                  <div
                    key={choice}
                    className={`px-3 py-2 rounded-lg text-sm
                      ${isCorrect ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200 font-medium' : ''}
                      ${wasSelected && !isCorrect ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300' : ''}
                      ${!isCorrect && !wasSelected ? 'text-slate-400 dark:text-slate-500' : ''}
                    `}
                  >
                    {isCorrect ? '✓ ' : wasSelected ? '✗ ' : ''}
                    {choice}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Confidence (objective only) */}
      {submitted && isObjective && confidence === null && (
        <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700" data-testid="confidence-prompt">
          <div className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-3">How confident did you feel?</div>
          <div className="flex gap-2">
            {(['low', 'medium', 'high'] as const).map(level => (
              <button
                key={level}
                type="button"
                onClick={() => handleConfirm(level)}
                className={`flex-1 py-2 rounded-xl text-sm font-semibold capitalize transition-colors
                  ${level === 'low' ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/60' : ''}
                  ${level === 'medium' ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/60' : ''}
                  ${level === 'high' ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900/60' : ''}
                `}
              >
                {level}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
