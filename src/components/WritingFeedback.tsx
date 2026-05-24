import React, { useMemo, useState } from 'react';
import type { WritingAnalysisResult, DetectedIssue } from '../lib/writingAnalysis';

interface Props {
  userText: string;
  analysis: WritingAnalysisResult;
  exampleAnswer?: string;
  onSelfRate?: (rating: 'low' | 'medium' | 'high') => void;
  onEdit?: () => void;
  selfRating?: 'low' | 'medium' | 'high' | null;
  saved?: boolean;
}

const BAND_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  below_target: { bg: 'bg-red-50 dark:bg-red-900/40', text: 'text-red-700 dark:text-red-300', border: 'border-red-200 dark:border-red-700' },
  near_target: { bg: 'bg-amber-50 dark:bg-amber-900/40', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-200 dark:border-amber-700' },
  target_developing: { bg: 'bg-indigo-50 dark:bg-indigo-900/40', text: 'text-indigo-700 dark:text-indigo-300', border: 'border-indigo-200 dark:border-indigo-700' },
  target_strong: { bg: 'bg-emerald-50 dark:bg-emerald-900/40', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-200 dark:border-emerald-700' },
};

const RUBRIC_LABELS: Record<string, string> = {
  taskCompletion: 'Task completion',
  grammarControl: 'Grammar control',
  vocabularyRange: 'Vocabulary range',
  coherence: 'Coherence',
  formalRegister: 'Formal register',
  connectors: 'Connectors',
  accentsPunctuation: 'Accents & punctuation',
};

const SEVERITY_STYLES: Record<DetectedIssue['severity'], { dot: string; pill: string }> = {
  high: { dot: 'bg-red-500', pill: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-700' },
  medium: { dot: 'bg-amber-500', pill: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700' },
  low: { dot: 'bg-slate-400', pill: 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600' },
};

function HighlightedText({ text, highlights }: { text: string; highlights: string[] }) {
  const segments = useMemo(() => {
    if (highlights.length === 0) return [{ chunk: text, highlight: false }];
    // Build a regex of all unique, non-empty highlights, escaped.
    const unique = Array.from(new Set(highlights.filter(Boolean)));
    if (unique.length === 0) return [{ chunk: text, highlight: false }];
    const escaped = unique
      .map(h => h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .filter(Boolean);
    if (escaped.length === 0) return [{ chunk: text, highlight: false }];
    const re = new RegExp(`(${escaped.join('|')})`, 'gi');
    const parts = text.split(re);
    return parts.map(part => ({
      chunk: part,
      highlight: unique.some(h => h.toLowerCase() === part.toLowerCase()),
    }));
  }, [text, highlights]);

  return (
    <p className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
      {segments.map((seg, i) =>
        seg.highlight ? (
          <mark
            key={i}
            className="bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-amber-200 rounded px-0.5 underline decoration-amber-400 decoration-2 underline-offset-2"
          >
            {seg.chunk}
          </mark>
        ) : (
          <React.Fragment key={i}>{seg.chunk}</React.Fragment>
        ),
      )}
    </p>
  );
}

export default function WritingFeedback({
  userText,
  analysis,
  exampleAnswer,
  onSelfRate,
  onEdit,
  selfRating,
  saved,
}: Props) {
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle');
  const bandColor = BAND_COLORS[analysis.estimatedBand];

  const issueHighlights = analysis.detectedIssues
    .map(i => i.matchedText)
    .filter((s): s is string => !!s);

  async function copyAnswer() {
    try {
      await navigator.clipboard.writeText(userText);
      setCopyState('copied');
      setTimeout(() => setCopyState('idle'), 1500);
    } catch {
      // Fallback: select range
    }
  }

  return (
    <div className="space-y-5" data-testid="writing-feedback">
      {/* Heuristic disclosure */}
      <div className="text-xs text-slate-400 leading-relaxed">
        Automatic writing feedback is heuristic and rule-based. For official scoring, use a
        teacher or an official mock exam.
      </div>

      {/* Top summary */}
      <div className={`rounded-2xl border p-5 ${bandColor.bg} ${bandColor.border}`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className={`text-xs font-semibold uppercase tracking-wide ${bandColor.text}`}>
              Writing analysis
            </div>
            <div className={`text-3xl font-bold mt-1 ${bandColor.text}`}>{analysis.score}/100</div>
            <div className={`text-sm font-medium mt-0.5 ${bandColor.text}`}>{analysis.bandLabel}</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-500">words</div>
            <div className="text-xl font-bold text-slate-800 dark:text-white tabular-nums">{analysis.wordCount}</div>
            <div className="text-xs text-slate-400 mt-1">
              {analysis.sentenceCount} sentence{analysis.sentenceCount === 1 ? '' : 's'}
              {analysis.paragraphCount > 1 ? ` · ${analysis.paragraphCount} paragraphs` : ''}
            </div>
          </div>
        </div>
      </div>

      {/* Rubric */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm p-5">
        <div className="text-xs text-slate-400 uppercase tracking-wide font-semibold mb-3">
          Rubric scores
        </div>
        <div className="space-y-2.5">
          {Object.entries(analysis.rubricScores).map(([key, value]) => (
            <div key={key}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-slate-600 dark:text-slate-300">{RUBRIC_LABELS[key]}</span>
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 tabular-nums">{value}/5</span>
              </div>
              <div className="h-1.5 bg-slate-100 dark:bg-slate-600 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500
                    ${value >= 4 ? 'bg-emerald-500' : value >= 3 ? 'bg-indigo-500' : value >= 2 ? 'bg-amber-500' : 'bg-red-500'}`}
                  style={{ width: `${(value / 5) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Strengths */}
      {analysis.detectedStrengths.length > 0 && (
        <div className="bg-emerald-50 dark:bg-emerald-900/40 rounded-2xl border border-emerald-200 dark:border-emerald-700 p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300 mb-2">
            What worked
          </div>
          <ul className="space-y-1.5">
            {analysis.detectedStrengths.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-emerald-900 dark:text-emerald-100">
                <span className="text-emerald-500 mt-0.5">✓</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Issues */}
      {analysis.detectedIssues.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">
            What to fix ({analysis.detectedIssues.length})
          </div>
          <ul className="space-y-3">
            {analysis.detectedIssues.map(issue => {
              const sev = SEVERITY_STYLES[issue.severity];
              return (
                <li key={issue.id} className="flex items-start gap-3">
                  <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${sev.dot}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-slate-800 dark:text-white">{issue.message}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded border ${sev.pill}`}>
                        {issue.severity}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{issue.suggestion}</div>
                    {issue.matchedText && (
                      <code className="inline-block mt-1 text-xs bg-amber-50 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 px-1.5 py-0.5 rounded">
                        "{issue.matchedText}"
                      </code>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Missing requirements */}
      {analysis.missingRequirements.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/40 rounded-2xl border border-amber-200 dark:border-amber-700 p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300 mb-2">
            Missing required elements
          </div>
          <ul className="space-y-1.5">
            {analysis.missingRequirements.map((req, i) => (
              <li key={i} className="text-sm text-amber-900 dark:text-amber-100">• {req}</li>
            ))}
          </ul>
        </div>
      )}

      {/* User's answer with highlights */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Your answer
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={copyAnswer}
              className="text-xs px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
            >
              {copyState === 'copied' ? '✓ Copied' : 'Copy'}
            </button>
            {onEdit && (
              <button
                type="button"
                onClick={onEdit}
                className="text-xs px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors"
              >
                Edit & resubmit
              </button>
            )}
          </div>
        </div>
        <HighlightedText text={userText} highlights={issueHighlights} />
      </div>

      {/* Example answer */}
      {exampleAnswer && (
        <div className="bg-slate-50 dark:bg-slate-700 rounded-2xl border border-slate-200 dark:border-slate-600 p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
            Example answer
          </div>
          <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">{exampleAnswer}</p>
        </div>
      )}

      {/* Next recommendation */}
      <div className="bg-indigo-50 dark:bg-indigo-900/40 rounded-2xl border border-indigo-200 dark:border-indigo-700 p-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400 mb-1">
          Next recommended drill
        </div>
        <div className="text-sm text-slate-800 dark:text-slate-100">{analysis.nextPracticeRecommendation}</div>
      </div>

      {/* Save status */}
      {saved && (
        <div className="text-center text-xs text-emerald-600 font-medium">
          ✓ Saved to writing history
        </div>
      )}

      {/* Self-rate */}
      {onSelfRate && selfRating === null && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm p-5" data-testid="self-rate-prompt">
          <div className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-3">
            How would you rate your own response?
          </div>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => onSelfRate('low')}
              className="py-2.5 rounded-xl text-sm font-semibold bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/60 transition-colors"
            >
              Needs work
            </button>
            <button
              type="button"
              onClick={() => onSelfRate('medium')}
              className="py-2.5 rounded-xl text-sm font-semibold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/60 transition-colors"
            >
              Mostly good
            </button>
            <button
              type="button"
              onClick={() => onSelfRate('high')}
              className="py-2.5 rounded-xl text-sm font-semibold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900/60 transition-colors"
            >
              Strong
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
