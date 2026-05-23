import { describe, it, expect, beforeEach } from 'vitest';
import {
  computeEvidenceWeight, buildEvidenceEvent, recordEvidence, seenCountFor,
} from '../evidence';
import { resetAllAppData, createProfile } from '../profile';
import { refreshActiveProfileCache, getEvidence } from '../storage';
import type { Exercise, ActivityType } from '../../types';

const mcExercise: Exercise = {
  id: 'es-test-01', type: 'multipleChoice', skill: 'grammar', cefrLevel: 'B1',
  prompt: '...', choices: ['a', 'b'], correctAnswer: 'a', explanation: 'because',
  mistakeCategories: ['tense_choice'], tags: ['t'], estimatedSeconds: 15, difficulty: 2,
  accentSensitive: false, keyboardHelp: false, itemFamilyId: 'fam-1', construct: 'verb tense',
};

const writingExercise: Exercise = {
  ...mcExercise, id: 'es-test-w1', type: 'writingPrompt', skill: 'writing',
};

function ensureProfile() {
  resetAllAppData();
  refreshActiveProfileCache();
  createProfile({
    targetLanguage: 'spanish', selfEstimatedLevel: 'B1', targetLevel: 'C1', dailyTime: 10,
  });
  refreshActiveProfileCache();
}

describe('evidence weighting', () => {
  it('gives a first-attempt unseen objective item full weight (test 5 baseline)', () => {
    expect(computeEvidenceWeight({
      scoringMode: 'objective', isReview: false, skipped: false,
      seenCountBefore: 0, confidence: 'high',
    })).toBe(1.0);
  });

  it('discounts repeated items: 1× → 0.3, 2+× → 0.1 (test 5)', () => {
    const once = computeEvidenceWeight({ scoringMode: 'objective', isReview: false, skipped: false, seenCountBefore: 1, confidence: 'high' });
    const twice = computeEvidenceWeight({ scoringMode: 'objective', isReview: false, skipped: false, seenCountBefore: 2, confidence: 'high' });
    expect(once).toBe(0.3);
    expect(twice).toBe(0.1);
    expect(once).toBeLessThan(1.0);
    expect(twice).toBeLessThan(once);
  });

  it('low-confidence correct answers count less (test 12)', () => {
    const low = computeEvidenceWeight({ scoringMode: 'objective', isReview: false, skipped: false, seenCountBefore: 0, confidence: 'low' });
    expect(low).toBe(0.5);
    expect(low).toBeLessThan(1.0);
  });

  it('review items carry zero level-promotion weight (test 6)', () => {
    expect(computeEvidenceWeight({ scoringMode: 'objective', isReview: true, skipped: false, seenCountBefore: 0, confidence: 'high' })).toBe(0);
  });

  it('skips carry zero weight', () => {
    expect(computeEvidenceWeight({ scoringMode: 'objective', isReview: false, skipped: true, seenCountBefore: 0, confidence: 'high' })).toBe(0);
  });

  it('writing heuristic does not dominate objective (test 41)', () => {
    const writing = computeEvidenceWeight({ scoringMode: 'heuristic_writing', isReview: false, skipped: false, seenCountBefore: 0, confidence: 'high' });
    const objective = computeEvidenceWeight({ scoringMode: 'objective', isReview: false, skipped: false, seenCountBefore: 0, confidence: 'high' });
    expect(writing).toBe(0.7);
    expect(writing).toBeLessThan(objective);
  });

  it('legacy evidence is preserved but heavily discounted (test 14)', () => {
    expect(computeEvidenceWeight({ scoringMode: 'legacy', isReview: false, skipped: false, seenCountBefore: 0, confidence: 'high' })).toBe(0.1);
    expect(computeEvidenceWeight({ scoringMode: 'legacy', isReview: false, skipped: false, seenCountBefore: 0, confidence: 'high', hasMetadata: false })).toBe(0);
  });
});

describe('evidence event construction', () => {
  it('marks repeats by seenCountBefore', () => {
    const ev = buildEvidenceEvent({
      profileId: 'p', exercise: mcExercise, languageId: 'spanish', activityType: 'sprint',
      correct: true, skipped: false, userAnswer: 'a', confidence: 'high',
      timeSpentSeconds: 10, seenCountBefore: 1,
    });
    expect(ev.isRepeat).toBe(true);
    expect(ev.firstAttempt).toBe(false);
    expect(ev.itemFamilyId).toBe('fam-1');
  });

  it('writing submissions get heuristic_writing scoring mode (test 39)', () => {
    const ev = buildEvidenceEvent({
      profileId: 'p', exercise: writingExercise, languageId: 'spanish', activityType: 'writing',
      correct: true, skipped: false, userAnswer: 'texto largo', confidence: 'medium',
      timeSpentSeconds: 120, seenCountBefore: 0,
    });
    expect(ev.scoringMode).toBe('heuristic_writing');
    expect(ev.evidenceWeight).toBe(0.7);
  });
});

describe('recordEvidence stores per-profile evidence', () => {
  beforeEach(ensureProfile);

  it.each<ActivityType>(['diagnostic', 'sprint', 'readiness_exam', 'writing'])(
    'every %s answer creates an evidence event (tests 1-4)',
    (activityType) => {
      const before = getEvidence().length;
      recordEvidence({
        exercise: activityType === 'writing' ? writingExercise : mcExercise,
        languageId: 'spanish', activityType, correct: true,
        userAnswer: 'a', confidence: 'high', timeSpentSeconds: 10,
      });
      const after = getEvidence();
      expect(after.length).toBe(before + 1);
      expect(after[after.length - 1].activityType).toBe(activityType);
    },
  );

  it('every skip creates an evidence event with zero weight', () => {
    const before = getEvidence().length;
    recordEvidence({
      exercise: mcExercise, languageId: 'spanish', activityType: 'diagnostic',
      correct: false, skipped: true, userAnswer: '', confidence: 'low', timeSpentSeconds: 0,
    });
    const ev = getEvidence();
    expect(ev.length).toBe(before + 1);
    expect(ev[ev.length - 1].skipped).toBe(true);
    expect(ev[ev.length - 1].evidenceWeight).toBe(0);
  });

  it('seenCountFor increments as the same item is answered again', () => {
    expect(seenCountFor(mcExercise.id)).toBe(0);
    recordEvidence({ exercise: mcExercise, languageId: 'spanish', activityType: 'sprint', correct: true, userAnswer: 'a', confidence: 'high', timeSpentSeconds: 5 });
    expect(seenCountFor(mcExercise.id)).toBe(1);
    recordEvidence({ exercise: mcExercise, languageId: 'spanish', activityType: 'sprint', correct: true, userAnswer: 'a', confidence: 'high', timeSpentSeconds: 5 });
    const second = getEvidence().filter(e => e.exerciseId === mcExercise.id)[1];
    expect(second.isRepeat).toBe(true);
    expect(second.evidenceWeight).toBe(0.3);
  });
});
