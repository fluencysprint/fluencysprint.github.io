import { describe, it, expect } from 'vitest';
import { computeRecommendations, planSprint } from '../recommendations';
import { estimateProficiency } from '../proficiency';
import { computeEvidenceWeight } from '../evidence';
import { getLanguagePack } from '../../languages';
import type { EvidenceEvent, CEFRLevel } from '../../types';

let seq = 0;
function objEvent(level: CEFRLevel, correct: boolean): EvidenceEvent {
  seq += 1;
  return {
    id: `e${seq}`, profileId: 'p', languageId: 'spanish', activityType: 'sprint',
    exerciseId: `x${seq}`, itemVersion: 1, itemFamilyId: `f${seq}`,
    skill: 'grammar', cefrLevel: level, firstAttempt: true, seenCountBefore: 0,
    correct, skipped: false, userAnswer: '', confidence: 'high',
    timeSpentSeconds: 10, activeTimeSeconds: 10, mistakeCategories: [],
    scoringMode: 'objective',
    evidenceWeight: computeEvidenceWeight({ scoringMode: 'objective', isReview: false, skipped: false, seenCountBefore: 0, confidence: 'high' }),
    isRepeat: false, isReview: false, createdAt: new Date().toISOString(),
  };
}

describe('recommendations engine', () => {
  it('suggests filling an evidence gap when sample size is too low (test 37)', () => {
    const est = estimateProficiency('spanish', [objEvent('A2', 1)]); // almost nothing
    const recs = computeRecommendations({
      estimate: est, dueReviewCount: 0, topMistakeCategories: [], writingFrequency: 'sometimes',
    });
    expect(recs.some(r => /evidence|drill|unseen/i.test(r))).toBe(true);
  });

  it('flags due reviews', () => {
    const recs = computeRecommendations({
      estimate: null, dueReviewCount: 3, topMistakeCategories: [], writingFrequency: 'never',
    });
    expect(recs.some(r => /review/i.test(r))).toBe(true);
  });
});

describe('adaptive sprint planner', () => {
  it('English sprint uses only English items (test 45)', () => {
    const pack = getLanguagePack('english');
    const plan = planSprint({
      exercises: pack.exercises, count: 15, estimate: null,
      dueMistakeExerciseIds: [], recentExerciseIds: [], targetLevel: 'B1',
    });
    expect(plan.queue.every(e => e.id.startsWith('en-'))).toBe(true);
  });

  it('Spanish sprint uses no English items (test 46)', () => {
    const pack = getLanguagePack('spanish');
    const plan = planSprint({
      exercises: pack.exercises, count: 15, estimate: null,
      dueMistakeExerciseIds: [], recentExerciseIds: [], targetLevel: 'B1',
    });
    expect(plan.queue.some(e => e.id.startsWith('en-'))).toBe(false);
  });

  it('produces the requested number of unique items', () => {
    const pack = getLanguagePack('spanish');
    const plan = planSprint({
      exercises: pack.exercises, count: 10, estimate: null,
      dueMistakeExerciseIds: [], recentExerciseIds: [], targetLevel: 'B1',
    });
    expect(plan.queue.length).toBe(10);
    expect(new Set(plan.queue.map(e => e.id)).size).toBe(10);
  });
});
