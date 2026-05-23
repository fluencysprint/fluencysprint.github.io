import { describe, it, expect } from 'vitest';
import {
  saveResumableDiagnostic, getResumableDiagnostic,
  saveResumableSprint, getResumableSprint,
} from '../storage';

describe('resumable diagnostic state', () => {
  it('saves and reads back a partial diagnostic session', () => {
    saveResumableDiagnostic({
      language: 'spanish',
      itemIds: ['e1', 'e2', 'e3'],
      currentIndex: 1,
      answers: [{
        exerciseId: 'e1', cefrLevel: 'A1', skill: 'grammar',
        userAnswer: 'x', correct: true, confidence: 'high',
        timeSpent: 12, skipped: false,
      }],
      startedAt: '2026-05-21T00:00:00.000Z',
      lastSavedAt: '2026-05-21T00:00:00.000Z',
    });
    const r = getResumableDiagnostic();
    expect(r?.currentIndex).toBe(1);
    expect(r?.itemIds).toEqual(['e1', 'e2', 'e3']);
    expect(r?.answers).toHaveLength(1);
  });

  it('null clears the resumable diagnostic', () => {
    saveResumableDiagnostic({
      language: 'spanish', itemIds: ['x'], currentIndex: 0,
      answers: [], startedAt: '', lastSavedAt: '',
    });
    saveResumableDiagnostic(null);
    expect(getResumableDiagnostic()).toBeNull();
  });
});

describe('resumable sprint state', () => {
  it('saves and reads back a partial sprint', () => {
    saveResumableSprint({
      language: 'spanish',
      itemIds: ['s1', 's2'],
      currentIndex: 1,
      correct: 1, attempted: 1,
      mistakesAdded: [],
      skillsWorked: ['grammar'],
      durationMins: 5,
      startedAt: '2026-05-21T00:00:00.000Z',
      lastSavedAt: '2026-05-21T00:00:00.000Z',
    });
    const r = getResumableSprint();
    expect(r?.durationMins).toBe(5);
    expect(r?.skillsWorked).toEqual(['grammar']);
  });
});
