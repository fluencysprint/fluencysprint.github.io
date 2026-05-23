import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { Exercise } from '../types';
import { checkAnswer } from '../lib/utils';
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

export default function ExerciseRenderer({ exercise, onAnswer, onSkip, showTimer = true }: Props) {
  const [selected, setSelected] = useState<string>('');
  const [textInput, setTextInput] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<{ correct: boolean; accentMissing: boolean } | null>(null);
  const [analysis, setAnalysis] = useState<WritingAnalysisResult | null>(null);
  const [confidence, setConfidence] = useState<'low' | 'medium' | 'high' | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const startTimeRef = useRef<number>(Date.now());

  const settings = getSettings();

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
        <div className="bg-slate-50 rounded-xl p-4 text-sm text-slate-700 leading-relaxed border border-slate-200">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
            {readingText.title}
          </div>
          <p className="whitespace-pre-wrap">{readingText.text}</p>
        </div>
      )}

      {/* Inline listening / context */}
      {exercise.context && !readingText && (
        <div className="bg-indigo-50 rounded-xl p-4 text-sm text-slate-700 leading-relaxed border border-indigo-100">
          <div className="text-xs font-semibold text-indigo-400 uppercase tracking-wide mb-2 flex items-center gap-2">
            <span>🎧</span> Listen &amp; understand
          </div>
          <p className="whitespace-pre-wrap">{exercise.context}</p>
        </div>
      )}

      {/* Prompt */}
      <div className="text-base font-medium text-slate-800 leading-relaxed whitespace-pre-wrap">
        {exercise.prompt}
      </div>

      {/* Heuristic disclosure for subjective during diagnostic */}
      {isWriting && !submitted && (
        <div className="text-xs text-slate-400 bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
          This is a subjective task. Your answer is preserved and analyzed locally with a
          rule-based evaluator. For official scoring, use a teacher or mock exam.
        </div>
      )}

      {/* Register rewrite instructions and checklist */}
      {exercise.type === 'registerRewrite' && !submitted && (
        <div className="bg-sky-50 rounded-xl p-4 border border-sky-100 space-y-3" data-testid="rewrite-instructions">
          <div className="text-xs font-semibold text-sky-600 uppercase tracking-wide">How to answer</div>
          <ul className="space-y-1.5 text-sm text-slate-700">
            <li>• Rewrite the sentence in a more formal and professional way.</li>
            <li>• Keep the same meaning.</li>
            <li>• Use one polite sentence.</li>
            {exercise.wordTargetMin !== undefined && exercise.wordTargetMax !== undefined && (
              <li>• Expected length: {exercise.wordTargetMin}–{exercise.wordTargetMax} words.</li>
            )}
          </ul>
          {exercise.checklist && exercise.checklist.length > 0 && (
            <div className="pt-2 border-t border-sky-100">
              <div className="text-xs font-semibold text-sky-600 uppercase tracking-wide mb-2">Before you submit, check:</div>
              <ul className="space-y-1.5 text-sm text-slate-700">
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
          {exercise.choices!.map(choice => (
            <button
              key={choice}
              type="button"
              role="radio"
              aria-checked={selected === choice}
              onClick={() => setSelected(choice)}
              className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all text-sm font-medium
                ${
                  selected === choice
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-indigo-300 hover:bg-indigo-50/30'
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
              className="px-4 py-3 rounded-xl border border-slate-200 text-slate-500 text-sm font-medium hover:bg-slate-50 transition-colors"
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
            result.correct ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'
          }`}
        >
          <div
            className={`font-semibold text-sm mb-1 ${
              result.correct ? 'text-emerald-700' : 'text-red-700'
            }`}
          >
            {result.correct
              ? result.accentMissing
                ? '✓ Accepted — but remember the accent mark!'
                : '✓ Correct!'
              : `✗ Incorrect — correct answer: ${exercise.correctAnswer}`}
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">{exercise.explanation}</p>

          {isMultipleChoice && !result.correct && selected && (
            <div className="mt-2 text-xs text-red-600">Your answer: {selected}</div>
          )}

          {isMultipleChoice && (
            <div className="space-y-1.5 mt-3">
              {exercise.choices!.map(choice => {
                const isCorrect = choice === exercise.correctAnswer;
                const wasSelected = choice === selected;
                return (
                  <div
                    key={choice}
                    className={`px-3 py-2 rounded-lg text-sm
                      ${isCorrect ? 'bg-emerald-100 text-emerald-800 font-medium' : ''}
                      ${wasSelected && !isCorrect ? 'bg-red-100 text-red-700' : ''}
                      ${!isCorrect && !wasSelected ? 'text-slate-400' : ''}
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
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200" data-testid="confidence-prompt">
          <div className="text-sm font-medium text-slate-700 mb-3">How confident did you feel?</div>
          <div className="flex gap-2">
            {(['low', 'medium', 'high'] as const).map(level => (
              <button
                key={level}
                type="button"
                onClick={() => handleConfirm(level)}
                className={`flex-1 py-2 rounded-xl text-sm font-semibold capitalize transition-colors
                  ${level === 'low' ? 'bg-red-100 text-red-700 hover:bg-red-200' : ''}
                  ${level === 'medium' ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' : ''}
                  ${level === 'high' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : ''}
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
