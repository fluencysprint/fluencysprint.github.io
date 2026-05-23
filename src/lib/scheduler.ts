import type { MistakeRecord, MistakeCategory, Skill, CEFRLevel } from '../types';
import { addMistake, updateMistake, getMistakes } from './storage';
import { nanoid } from './utils';

function addDays(date: Date, days: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

export function getNextInterval(
  current: MistakeRecord,
  wasCorrect: boolean,
  confidence: 'low' | 'medium' | 'high',
  timeSpent: number,
  estimatedSeconds: number
): number {
  if (!wasCorrect) {
    return 1; // review tomorrow
  }

  const isLowConfidence = confidence === 'low';
  const isFast = timeSpent < estimatedSeconds * 0.6 && confidence === 'high';

  if (current.status === 'new' || current.status === 'learning') {
    if (isLowConfidence) return 2;
    if (isFast) return 4;
    return 3;
  }

  if (current.status === 'reviewing') {
    if (isLowConfidence) return 3;
    if (isFast) return 10;
    return 7;
  }

  // mastered-ish
  if (isLowConfidence) return 7;
  if (isFast) return 21;
  return 14;
}

export function getNextStatus(
  current: MistakeRecord,
  wasCorrect: boolean
): MistakeRecord['status'] {
  if (!wasCorrect) return 'learning';
  if (current.status === 'new') return 'learning';
  if (current.status === 'learning') return 'reviewing';
  if (current.status === 'reviewing') return 'mastered';
  return 'mastered';
}

export function recordMistake(params: {
  exerciseId: string;
  prompt: string;
  userAnswer: string;
  correctAnswer: string;
  explanation: string;
  mistakeCategories: MistakeCategory[];
  cefrLevel: CEFRLevel;
  skill: Skill;
  confidence: 'low' | 'medium' | 'high';
  timeSpent: number;
  estimatedSeconds?: number;
}): MistakeRecord {
  const existing = getMistakes().find(m => m.exerciseId === params.exerciseId);
  const today = new Date();

  if (existing) {
    const interval = 1; // reset on new mistake
    const updated: MistakeRecord = {
      ...existing,
      date: today.toISOString(),
      userAnswer: params.userAnswer,
      confidence: params.confidence,
      timeSpent: params.timeSpent,
      nextReviewDate: addDays(today, interval),
      reviewInterval: interval,
      attempts: existing.attempts + 1,
      status: 'learning',
    };
    updateMistake(existing.id, updated);
    return updated;
  }

  const record: MistakeRecord = {
    id: nanoid(),
    exerciseId: params.exerciseId,
    date: today.toISOString(),
    userAnswer: params.userAnswer,
    correctAnswer: params.correctAnswer,
    explanation: params.explanation,
    mistakeCategories: params.mistakeCategories,
    cefrLevel: params.cefrLevel,
    skill: params.skill,
    confidence: params.confidence,
    timeSpent: params.timeSpent,
    nextReviewDate: addDays(today, 1),
    reviewInterval: 1,
    attempts: 1,
    status: 'new',
    prompt: params.prompt,
  };
  addMistake(record);
  return record;
}

export function recordCorrectReview(
  mistakeId: string,
  confidence: 'low' | 'medium' | 'high',
  timeSpent: number
): void {
  const mistakes = getMistakes();
  const record = mistakes.find(m => m.id === mistakeId);
  if (!record) return;

  const interval = getNextInterval(record, true, confidence, timeSpent, 30);
  const nextStatus = getNextStatus(record, true);
  const today = new Date();

  updateMistake(mistakeId, {
    nextReviewDate: addDays(today, interval),
    reviewInterval: interval,
    status: nextStatus,
    confidence,
    timeSpent,
  });
}

export function sortMistakesByPriority(mistakes: MistakeRecord[]): MistakeRecord[] {
  const today = todayStr();
  return [...mistakes].sort((a, b) => {
    // Overdue first
    const aOverdue = a.nextReviewDate < today ? 1 : 0;
    const bOverdue = b.nextReviewDate < today ? 1 : 0;
    if (aOverdue !== bOverdue) return bOverdue - aOverdue;

    // More attempts = higher priority (persistent mistakes)
    if (a.attempts !== b.attempts) return b.attempts - a.attempts;

    // Earlier review date
    return a.nextReviewDate.localeCompare(b.nextReviewDate);
  });
}
