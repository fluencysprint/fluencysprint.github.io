import React, { useRef, useState } from 'react';
import LanguageInput from '../components/LanguageInput';
import WordCounter from '../components/WordCounter';
import WritingFeedback from '../components/WritingFeedback';
import {
  addWritingEntry, addSession, updateProgress, getProgress,
  getDraft, clearDraft, getWritingEntries,
} from '../lib/storage';
import { recordMistake } from '../lib/scheduler';
import { useActiveTime } from '../lib/activeTime';
import { analyzeWriting, type WritingAnalysisResult } from '../lib/writingAnalysis';
import { nanoid, formatDuration } from '../lib/utils';
import { getActiveLanguagePack } from '../lib/activeLanguage';
import type { WritingPromptMeta } from '../types';

type Phase = 'select' | 'writing' | 'review' | 'done';

const WRITING_DRAFT_SLOT = (id: string) => `writing.${id}`;

export default function Writing() {
  const pack = getActiveLanguagePack();
  const [phase, setPhase] = useState<Phase>('select');
  const [selectedPrompt, setSelectedPrompt] = useState<WritingPromptMeta | null>(null);
  const [text, setText] = useState('');
  const [analysis, setAnalysis] = useState<WritingAnalysisResult | null>(null);
  const [selfRating, setSelfRating] = useState<'low' | 'medium' | 'high' | null>(null);
  const [recentEntries, setRecentEntries] = useState(() => getWritingEntries().slice(-5).reverse());

  const elapsedRef = useRef<number>(0);
  const wallClockStart = useRef<number>(0);
  const writingActive = phase === 'writing';
  const { activeSeconds: activeWritingSeconds, reset: resetActive } = useActiveTime({
    enabled: writingActive, idleThresholdMs: 60_000,
  });

  function startWriting(prompt: WritingPromptMeta) {
    setSelectedPrompt(prompt);
    const draft = getDraft(WRITING_DRAFT_SLOT(prompt.id));
    setText(draft ?? '');
    setAnalysis(null);
    setSelfRating(null);
    wallClockStart.current = Date.now();
    elapsedRef.current = 0;
    resetActive();
    setPhase('writing');
  }

  function submitWriting() {
    if (!selectedPrompt) return;
    elapsedRef.current = Math.round((Date.now() - wallClockStart.current) / 1000);
    const result = analyzeWriting({
      text,
      prompt: selectedPrompt.prompt,
      languageId: pack.metadata.id,
      cefrLevel: selectedPrompt.cefrLevel,
      taskType: selectedPrompt.taskType,
      wordTargetMin: selectedPrompt.wordMin,
      wordTargetMax: selectedPrompt.wordMax,
      requiredElements: selectedPrompt.requiredElements,
    });
    setAnalysis(result);
    setPhase('review');

    addWritingEntry({
      id: nanoid(),
      promptId: selectedPrompt.id,
      date: new Date().toISOString(),
      text,
      durationSeconds: elapsedRef.current,
      activeSeconds: activeWritingSeconds,
      selfScores: {},
      weakCategories: result.suggestedFocusAreas,
      mode: selectedPrompt.mode,
      analysisScore: result.score,
      wordCount: result.wordCount,
      rubricScores: { ...result.rubricScores } as Record<string, number>,
      cefrLevel: selectedPrompt.cefrLevel,
      exampleAnswer: selectedPrompt.exampleAnswer,
    });

    for (const cat of result.suggestedFocusAreas) {
      recordMistake({
        exerciseId: `writing-${selectedPrompt.id}-${cat}`,
        prompt: selectedPrompt.prompt.slice(0, 120),
        userAnswer: text.slice(0, 120),
        correctAnswer: 'See writing analysis',
        explanation: `Writing analysis flagged: ${cat.replace(/_/g, ' ')}`,
        mistakeCategories: [cat],
        cefrLevel: selectedPrompt.cefrLevel,
        skill: 'writing',
        confidence: 'low',
        timeSpent: elapsedRef.current,
      });
    }
  }

  function handleSelfRate(rating: 'low' | 'medium' | 'high') {
    setSelfRating(rating);
  }

  function handleEdit() {
    setAnalysis(null);
    setPhase('writing');
    wallClockStart.current = Date.now();
    elapsedRef.current = 0;
    resetActive();
  }

  function finish() {
    if (!selectedPrompt) return;
    const progress = getProgress();
    addSession({
      id: nanoid(), date: new Date().toISOString(), type: 'writing',
      durationSeconds: elapsedRef.current, exercisesAttempted: 1, exercisesCorrect: 1,
      accuracy: analysis?.score ?? 0,
      skillsWorked: ['writing', 'formal_register'],
      mistakesAdded: [],
    });
    updateProgress({
      sessionCount: progress.sessionCount + 1,
      totalMinutes: progress.totalMinutes + Math.round(activeWritingSeconds / 60),
    });
    clearDraft(WRITING_DRAFT_SLOT(selectedPrompt.id));
    setRecentEntries(getWritingEntries().slice(-5).reverse());
    setPhase('done');
  }

  if (phase === 'select') {
    const grouped: Record<string, WritingPromptMeta[]> = { '5min': [], '10min': [], '20min': [] };
    for (const p of pack.writingPrompts) grouped[p.mode]?.push(p);

    return (
      <div className="space-y-6 pb-10">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Writing practice</h1>
          <p className="text-slate-400 text-sm mt-1">
            {pack.metadata.label} timed writing with rule-based analysis · skip any time
          </p>
        </div>

        {recentEntries.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <div className="text-xs text-slate-400 uppercase tracking-wide font-semibold mb-2">Recent writing</div>
            <div className="space-y-1.5">
              {recentEntries.map(e => (
                <div key={e.id} className="flex items-center justify-between text-sm">
                  <span className="text-slate-600 truncate mr-2">
                    {pack.writingPrompts.find(p => p.id === e.promptId)?.title ?? e.promptId}
                  </span>
                  <span className="text-xs text-slate-400 shrink-0">
                    {e.analysisScore ?? '—'}/100 · {e.wordCount ?? ''} words · {new Date(e.date).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {(['5min', '10min', '20min'] as const).map(mode => (
          <div key={mode}>
            <div className="text-sm font-semibold text-slate-700 mb-2">
              {mode === '5min' ? '5 minutes — micro writing'
                : mode === '10min' ? '10 minutes — structured answer'
                : '20 minutes — exam-style answer'}
            </div>
            {(grouped[mode] ?? []).length === 0 ? (
              <div className="text-xs text-slate-400 italic mb-3">No prompts in this length yet.</div>
            ) : (
              <div className="space-y-2">
                {grouped[mode].map(p => (
                  <button
                    key={p.id}
                    onClick={() => startWriting(p)}
                    className="w-full text-left bg-white rounded-2xl border border-slate-100 shadow-sm p-4 hover:border-indigo-300 hover:shadow-md transition-all"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-800">{p.title}</div>
                        <div className="text-xs text-slate-400 mt-0.5">{p.genre} · {p.wordTarget}</div>
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0 bg-indigo-100 text-indigo-700">
                        {p.cefrLevel}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-2 line-clamp-2">{p.prompt}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  if (phase === 'writing' && selectedPrompt) {
    const modeSeconds = selectedPrompt.mode === '5min' ? 300 : selectedPrompt.mode === '10min' ? 600 : 1200;
    const pct = Math.min(100, (activeWritingSeconds / modeSeconds) * 100);
    const overtime = activeWritingSeconds > modeSeconds;

    return (
      <div className="space-y-5 pb-10">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-slate-700">{selectedPrompt.title}</div>
            <div className="text-xs text-slate-400">{selectedPrompt.genre} · {selectedPrompt.cefrLevel}</div>
          </div>
          <div className={`text-sm font-mono font-bold ${overtime ? 'text-red-500' : 'text-slate-600'}`}>
            {formatDuration(activeWritingSeconds)} / {selectedPrompt.mode.replace('min', 'm')}
          </div>
        </div>

        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-1000 ${overtime ? 'bg-red-400' : 'bg-indigo-500'}`} style={{ width: `${pct}%` }} />
        </div>

        <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100">
          <div className="text-xs font-semibold text-indigo-400 uppercase tracking-wide mb-2">Task</div>
          <p className="text-sm text-slate-700 leading-relaxed">{selectedPrompt.prompt}</p>
          <div className="mt-2 text-xs text-indigo-500">💡 {selectedPrompt.tip}</div>
        </div>

        <LanguageInput
          value={text} onChange={setText}
          multiline rows={10}
          placeholder="Start writing your response…"
          draftSlot={WRITING_DRAFT_SLOT(selectedPrompt.id)}
        />

        <WordCounter
          text={text}
          min={selectedPrompt.wordMin}
          max={selectedPrompt.wordMax}
          activeSeconds={activeWritingSeconds}
        />

        <div className="flex gap-3">
          <button
            onClick={submitWriting}
            disabled={text.trim().split(/\s+/).filter(Boolean).length < 15}
            className="flex-1 py-3.5 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:opacity-40"
          >
            Submit for analysis
          </button>
          <button
            onClick={() => setPhase('select')}
            className="px-4 py-3.5 rounded-xl border border-slate-200 text-slate-500 text-sm font-medium hover:bg-slate-50"
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'review' && selectedPrompt && analysis) {
    return (
      <div className="space-y-5 pb-10">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Writing analysis</h2>
          <p className="text-slate-400 text-sm mt-1">{selectedPrompt.title}</p>
        </div>

        <WritingFeedback
          userText={text}
          analysis={analysis}
          exampleAnswer={selectedPrompt.exampleAnswer}
          onSelfRate={handleSelfRate}
          onEdit={handleEdit}
          selfRating={selfRating}
          saved
        />

        {selfRating && (
          <button
            onClick={finish}
            className="w-full py-3.5 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700"
          >
            Save &amp; finish
          </button>
        )}
      </div>
    );
  }

  if (phase === 'done') {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Writing saved!</h1>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center">
          <div className="text-4xl mb-3">✓</div>
          <div className="text-lg font-bold text-slate-800">Good work!</div>
          {analysis && (
            <p className="text-sm text-slate-500 mt-2">
              Score: <span className="font-semibold">{analysis.score}/100</span> · {analysis.bandLabel}
            </p>
          )}
        </div>
        <button
          onClick={() => setPhase('select')}
          className="w-full py-3 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700"
        >
          Practice more writing
        </button>
      </div>
    );
  }

  return null;
}
