import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { resetAllAppData, createProfile } from '../profile';
import {
  refreshActiveProfileCache, getRecentExerciseIds, markExercisesSeen,
} from '../storage';

function ensureProfile() {
  resetAllAppData();
  refreshActiveProfileCache();
  createProfile({
    targetLanguage: 'spanish', selfEstimatedLevel: 'A1',
    targetLevel: 'B1', dailyTime: 10,
  });
  refreshActiveProfileCache();
}

beforeEach(ensureProfile);
afterEach(() => { cleanup(); localStorage.clear(); });

describe('recency tracking', () => {
  it('starts empty for a new profile', () => {
    expect(getRecentExerciseIds()).toHaveLength(0);
  });

  it('records seen exercise IDs', () => {
    markExercisesSeen(['es-a1-01', 'es-a1-02']);
    const recent = getRecentExerciseIds();
    expect(recent).toContain('es-a1-01');
    expect(recent).toContain('es-a1-02');
  });

  it('accumulates seen IDs across calls', () => {
    markExercisesSeen(['es-a1-01', 'es-a1-02']);
    markExercisesSeen(['es-a1-03']);
    const recent = getRecentExerciseIds();
    expect(recent).toContain('es-a1-01');
    expect(recent).toContain('es-a1-02');
    expect(recent).toContain('es-a1-03');
  });

  it('caps the list at 50 entries (FIFO — oldest evicted)', () => {
    const batch1 = Array.from({ length: 30 }, (_, i) => `es-a1-${i + 1}`);
    const batch2 = Array.from({ length: 30 }, (_, i) => `es-a2-${i + 1}`);
    markExercisesSeen(batch1);
    markExercisesSeen(batch2);
    const recent = getRecentExerciseIds();
    expect(recent.length).toBeLessThanOrEqual(50);
    // The oldest entries from batch1 should have been evicted
    expect(recent).not.toContain('es-a1-1');
  });

  it('persists across refreshActiveProfileCache calls', () => {
    markExercisesSeen(['es-b1-01', 'es-b1-02']);
    refreshActiveProfileCache();
    const recent = getRecentExerciseIds();
    expect(recent).toContain('es-b1-01');
    expect(recent).toContain('es-b1-02');
  });
});
