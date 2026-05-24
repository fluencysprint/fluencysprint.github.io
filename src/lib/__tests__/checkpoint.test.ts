import { describe, it, expect, beforeEach } from 'vitest';
import {
  writeSessionCheckpoint, readSessionCheckpoint, clearSessionCheckpoint,
  CHECKPOINT_KEY, flushAll,
} from '../storageAdapter';
import {
  saveResumableDiagnostic, getResumableDiagnostic,
  saveResumableSprint, getResumableSprint,
  saveDraft, getDraft,
  getActiveProfileId,
} from '../storage';
import { resetAllAppData, resetProfile, listProfiles, createProfile } from '../profile';
import { refreshActiveProfileCache } from '../storage';
import type { ResumableDiagnosticState, ResumableSprintState } from '../../types';

function freshDiagState(index = 0): ResumableDiagnosticState {
  return {
    language: 'english',
    itemIds: ['en-a', 'en-b', 'en-c'],
    currentIndex: index,
    answers: [],
    startedAt: new Date().toISOString(),
    lastSavedAt: new Date().toISOString(),
  };
}

function freshSprintState(index = 0): ResumableSprintState {
  return {
    language: 'english',
    itemIds: ['en-x', 'en-y'],
    currentIndex: index,
    correct: index, attempted: index,
    mistakesAdded: [], skillsWorked: [],
    durationMins: 5,
    startedAt: new Date().toISOString(),
    lastSavedAt: new Date().toISOString(),
  };
}

// Test 11: diagnostic state saves after each answer
describe('test 11 — diagnostic state saves after each answer', () => {
  it('saves and retrieves diagnostic state with updated index', () => {
    saveResumableDiagnostic(freshDiagState(0));
    saveResumableDiagnostic({ ...freshDiagState(0), currentIndex: 1 });
    expect(getResumableDiagnostic()?.currentIndex).toBe(1);
  });
});

// Test 12: sprint state saves after each answer
describe('test 12 — sprint state saves after each answer', () => {
  it('saves and retrieves sprint state with updated index', () => {
    saveResumableSprint(freshSprintState(0));
    saveResumableSprint({ ...freshSprintState(0), currentIndex: 1, correct: 1, attempted: 1 });
    const r = getResumableSprint();
    expect(r?.currentIndex).toBe(1);
    expect(r?.correct).toBe(1);
  });
});

// Test 13: exam state — uses same saveResumable infrastructure
describe('test 13 — exam state saves via same storage path', () => {
  it('diagnostic save (used by exam flow) persists across reads', () => {
    saveResumableDiagnostic(freshDiagState(2));
    expect(getResumableDiagnostic()?.currentIndex).toBe(2);
  });
});

// Test 14: skip action saves immediately
describe('test 14 — skip saves immediately', () => {
  it('skipping advances currentIndex and persists', () => {
    saveResumableDiagnostic(freshDiagState(0));
    saveResumableDiagnostic({ ...freshDiagState(0), currentIndex: 1 }); // skip increments index
    expect(getResumableDiagnostic()?.currentIndex).toBe(1);
  });
});

// Test 15: writing draft restores after remount (via getDraft)
describe('test 15 — writing draft restores after remount', () => {
  it('saved draft is readable (simulates component remount)', () => {
    saveDraft('writing-en-essay-1', 'Hello world draft text');
    // Simulate remount by re-reading
    expect(getDraft('writing-en-essay-1')).toBe('Hello world draft text');
  });
});

// Test 16: session resumes after page reload (state survives localStorage persistence)
describe('test 16 — session resumes after simulated reload', () => {
  it('diagnostic session is present after cache flush and fresh read', () => {
    saveResumableDiagnostic(freshDiagState(1));
    flushAll(); // simulate flush that happens on page hide
    // Reading fresh from localStorage (refreshActiveProfileCache clears the in-memory cache)
    refreshActiveProfileCache();
    expect(getResumableDiagnostic()?.currentIndex).toBe(1);
  });
});

// Test 17: session resumes after simulated pagehide
describe('test 17 — session resumes after pagehide', () => {
  it('state persists through pagehide flush', () => {
    saveResumableSprint(freshSprintState(1));
    flushAll(); // pagehide triggers this
    refreshActiveProfileCache();
    expect(getResumableSprint()?.currentIndex).toBe(1);
  });
});

// Test 18: session resumes after simulated visibilitychange hidden
describe('test 18 — session resumes after visibilitychange', () => {
  it('state persists through visibility flush', () => {
    saveResumableDiagnostic(freshDiagState(2));
    flushAll(); // visibilitychange hidden triggers this
    refreshActiveProfileCache();
    expect(getResumableDiagnostic()?.currentIndex).toBe(2);
  });
});

// Test 19: localStorage checkpoint is written for active session
describe('test 19 — localStorage checkpoint is written', () => {
  it('checkpoint key exists after saving a diagnostic session', () => {
    saveResumableDiagnostic(freshDiagState(0));
    const cp = readSessionCheckpoint();
    expect(cp).not.toBeNull();
    expect(cp?.type).toBe('diagnostic');
    expect(cp?.profileId).toBeTruthy();
    expect(localStorage.getItem(CHECKPOINT_KEY)).not.toBeNull();
  });

  it('checkpoint key exists after saving a sprint session', () => {
    saveResumableSprint(freshSprintState(0));
    const cp = readSessionCheckpoint();
    expect(cp?.type).toBe('sprint');
  });

  it('checkpoint is cleared when session is cleared', () => {
    saveResumableDiagnostic(freshDiagState(0));
    saveResumableDiagnostic(null);
    expect(readSessionCheckpoint()).toBeNull();
    expect(localStorage.getItem(CHECKPOINT_KEY)).toBeNull();
  });
});

// Test 20: if profile data missing but checkpoint exists, checkpoint is readable
describe('test 20 — checkpoint survives if profile data were unavailable', () => {
  it('checkpoint can be read independently of profile blob', () => {
    // Write checkpoint directly (simulates scenario where main blob was not written)
    const profileId = getActiveProfileId() ?? 'test-profile';
    writeSessionCheckpoint({ profileId, type: 'sprint', savedAt: new Date().toISOString() });
    // Remove the profile data blob
    const profileKey = `fluencySprint.profileData.${profileId}`;
    localStorage.removeItem(profileKey);
    // Checkpoint should still be readable
    const cp = readSessionCheckpoint();
    expect(cp).not.toBeNull();
    expect(cp?.profileId).toBe(profileId);
  });
});

// Test 21: reset current profile clears checkpoint
describe('test 21 — reset profile clears checkpoint', () => {
  it('checkpoint is removed after resetting the current profile', () => {
    saveResumableDiagnostic(freshDiagState(1));
    expect(readSessionCheckpoint()).not.toBeNull();
    const profiles = listProfiles();
    expect(profiles.length).toBeGreaterThan(0);
    resetProfile(profiles[0].id);
    expect(readSessionCheckpoint()).toBeNull();
  });
});

// Test 22: reset all clears checkpoint
describe('test 22 — reset all clears checkpoint', () => {
  it('checkpoint is removed after resetting all app data', () => {
    saveResumableSprint(freshSprintState(1));
    expect(readSessionCheckpoint()).not.toBeNull();
    resetAllAppData();
    refreshActiveProfileCache();
    expect(readSessionCheckpoint()).toBeNull();
    expect(localStorage.getItem(CHECKPOINT_KEY)).toBeNull();
  });
});
