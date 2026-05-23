import type {
  Exercise, EvidenceEvent, ActivityType, ScoringMode,
  LanguageId, MistakeCategory,
} from '../types';
import { nanoid } from './utils';
import { getActiveProfileId } from './profile';
import { getEvidence, addEvidenceEvent } from './storage';

// ─── Item calibration helpers ───────────────────────────────────────────────

/** A stable family id grouping near-duplicate items. Falls back to the id. */
export function itemFamilyOf(ex: Pick<Exercise, 'id' | 'itemFamilyId'>): string {
  return ex.itemFamilyId ?? ex.id;
}

export function itemVersionOf(ex: Pick<Exercise, 'itemVersion'>): number {
  return ex.itemVersion ?? 1;
}

const OBJECTIVE_TYPES = new Set([
  'multipleChoice', 'cloze', 'connectorChoice', 'collocationChoice',
  'readingQuestion', 'sentenceTransformation', 'accentPractice', 'punctuationPractice',
]);

const WRITING_TYPES = new Set(['writingPrompt', 'registerRewrite']);

/** A "calibrated" item is an objective, exam/diagnostic-usable question. */
export function isCalibratedItem(ex: Exercise): boolean {
  if (!OBJECTIVE_TYPES.has(ex.type)) return false;
  // Items can opt out of exam eligibility explicitly.
  if (ex.examEligible === false && ex.diagnosticEligible === false) return false;
  return true;
}

export function defaultScoringMode(ex: Exercise): ScoringMode {
  if (WRITING_TYPES.has(ex.type)) return 'heuristic_writing';
  return 'objective';
}

// ─── Evidence weighting ─────────────────────────────────────────────────────

export interface WeightInput {
  scoringMode: ScoringMode;
  isReview: boolean;
  skipped: boolean;
  seenCountBefore: number;
  confidence: 'low' | 'medium' | 'high';
  hasMetadata?: boolean;
}

/**
 * How much an observation may move a *level* estimate (0..1).
 * Repeats, reviews, low confidence, and legacy items are discounted so that
 * activity and memorisation can't masquerade as proficiency.
 */
export function computeEvidenceWeight(input: WeightInput): number {
  const { scoringMode, isReview, skipped, seenCountBefore, confidence } = input;

  // Skips carry no positive level evidence (they lower confidence elsewhere).
  if (skipped) return 0;

  // Review items help retention, never promote a level.
  if (isReview) return 0;

  // Legacy evidence is preserved but heavily discounted.
  if (scoringMode === 'legacy') {
    if (input.hasMetadata === false) return 0;
    return seenCountBefore === 0 ? 0.1 : 0.05;
  }

  // Repetition penalty (anti-memorisation).
  if (seenCountBefore >= 2) return 0.1;
  if (seenCountBefore === 1) return 0.3;

  // First, unseen attempt.
  if (scoringMode === 'heuristic_writing') return 0.7;
  if (scoringMode === 'self_rating') return 0.3;

  // Objective, first attempt — low confidence answers count for less.
  if (confidence === 'low') return 0.5;
  return 1.0;
}

// ─── Building & recording ───────────────────────────────────────────────────

export interface BuildEvidenceInput {
  profileId: string;
  exercise: Exercise;
  languageId: LanguageId;
  activityType: ActivityType;
  correct: boolean;
  skipped: boolean;
  userAnswer: string;
  confidence: 'low' | 'medium' | 'high';
  timeSpentSeconds: number;
  activeTimeSeconds?: number;
  seenCountBefore: number;
  isReview?: boolean;
  scoringMode?: ScoringMode;
  mistakeCategories?: MistakeCategory[];
  now?: string;
}

/** Pure constructor — does not touch storage. Used directly by tests. */
export function buildEvidenceEvent(input: BuildEvidenceInput): EvidenceEvent {
  const ex = input.exercise;
  const scoringMode = input.scoringMode ?? defaultScoringMode(ex);
  const isReview = input.isReview ?? input.activityType === 'review';
  const seenCountBefore = input.seenCountBefore;
  const isRepeat = seenCountBefore > 0;
  const evidenceWeight = computeEvidenceWeight({
    scoringMode, isReview, skipped: input.skipped,
    seenCountBefore, confidence: input.confidence,
  });
  return {
    id: nanoid(),
    profileId: input.profileId,
    languageId: input.languageId,
    activityType: input.activityType,
    exerciseId: ex.id,
    itemVersion: itemVersionOf(ex),
    itemFamilyId: itemFamilyOf(ex),
    skill: ex.skill,
    subskill: ex.subskill,
    cefrLevel: ex.cefrLevel,
    construct: ex.construct,
    firstAttempt: seenCountBefore === 0,
    seenCountBefore,
    correct: input.correct,
    skipped: input.skipped,
    userAnswer: input.userAnswer,
    confidence: input.confidence,
    timeSpentSeconds: input.timeSpentSeconds,
    activeTimeSeconds: input.activeTimeSeconds ?? input.timeSpentSeconds,
    mistakeCategories: input.mistakeCategories ?? ex.mistakeCategories ?? [],
    scoringMode,
    evidenceWeight,
    isRepeat,
    isReview,
    createdAt: input.now ?? new Date().toISOString(),
  };
}

export interface RecordEvidenceInput {
  exercise: Exercise;
  languageId: LanguageId;
  activityType: ActivityType;
  correct: boolean;
  skipped?: boolean;
  userAnswer: string;
  confidence: 'low' | 'medium' | 'high';
  timeSpentSeconds: number;
  activeTimeSeconds?: number;
  isReview?: boolean;
  scoringMode?: ScoringMode;
  mistakeCategories?: MistakeCategory[];
}

/** Count of prior recorded events for this exercise in the active profile. */
export function seenCountFor(exerciseId: string): number {
  return getEvidence().filter(e => e.exerciseId === exerciseId).length;
}

/**
 * Record one evidence event for the active profile. No-op (returns null) when
 * there is no active profile. Every answer/skip/submission should call this.
 */
export function recordEvidence(input: RecordEvidenceInput): EvidenceEvent | null {
  const profileId = getActiveProfileId();
  if (!profileId) return null;
  const seenCountBefore = seenCountFor(input.exercise.id);
  const event = buildEvidenceEvent({
    ...input,
    profileId,
    skipped: input.skipped ?? false,
    seenCountBefore,
  });
  addEvidenceEvent(event);
  return event;
}
