import { describe, it, expect } from 'vitest';
import {
  saveDraft, getDraft, clearDraft, listDrafts,
  addWritingEntry, getWritingEntries,
} from '../storage';
import {
  resetAllAppData, createProfile, listProfiles, getActiveProfileId, setActiveProfileId,
} from '../profile';
import { refreshActiveProfileCache } from '../storage';
import type { WritingEntry } from '../../types';

describe('writing drafts (profile-scoped)', () => {
  it('saves and restores a draft by slot', () => {
    saveDraft('slot-a', 'Hola mundo');
    expect(getDraft('slot-a')).toBe('Hola mundo');
  });

  it('returns null for an unknown slot', () => {
    expect(getDraft('does-not-exist')).toBe(null);
  });

  it('clears a draft', () => {
    saveDraft('slot-b', 'temp');
    clearDraft('slot-b');
    expect(getDraft('slot-b')).toBe(null);
  });

  it('listDrafts returns all stored drafts', () => {
    saveDraft('a', 'one');
    saveDraft('b', 'two');
    const drafts = listDrafts();
    expect(drafts.find(d => d.slot === 'a')?.text).toBe('one');
    expect(drafts.find(d => d.slot === 'b')?.text).toBe('two');
  });

  it('resetAllAppData clears drafts (and the profile)', () => {
    saveDraft('a', 'one');
    resetAllAppData();
    refreshActiveProfileCache();
    expect(getDraft('a')).toBe(null);
  });
});

describe('writing entries persistence', () => {
  it('stores writing entries and reads them back', () => {
    const entry: WritingEntry = {
      id: 'we-1',
      promptId: 'wp-01',
      date: new Date().toISOString(),
      text: 'Estimados señores, ...',
      durationSeconds: 120,
      activeSeconds: 100,
      selfScores: {},
      weakCategories: ['informal_register'],
      mode: 'diagnostic',
      analysisScore: 73,
      wordCount: 84,
      cefrLevel: 'B2',
    };
    addWritingEntry(entry);

    const all = getWritingEntries();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe('we-1');
    expect(all[0].analysisScore).toBe(73);
    expect(all[0].weakCategories).toContain('informal_register');
  });

  it('isolates writing entries between profiles', () => {
    addWritingEntry({
      id: 'we-a', promptId: 'wp-01', date: new Date().toISOString(),
      text: 'profile A only', durationSeconds: 60, selfScores: {},
      weakCategories: [], mode: 'diagnostic',
    });
    const firstProfileId = getActiveProfileId();
    // Create a second profile and check its writing entries are empty.
    createProfile({
      displayName: 'Other',
      targetLanguage: 'english',
      selfEstimatedLevel: 'A1',
      targetLevel: 'A2',
      dailyTime: 5,
    });
    refreshActiveProfileCache();
    expect(getWritingEntries()).toEqual([]);
    // Switch back: original entry is still there.
    setActiveProfileId(firstProfileId);
    refreshActiveProfileCache();
    expect(getWritingEntries().map(e => e.id)).toContain('we-a');
  });
});

describe('profile creation and switching', () => {
  it('creates a profile and makes it active by default', () => {
    // The test setup already created one — verify it exists.
    expect(listProfiles().length).toBeGreaterThanOrEqual(1);
    expect(getActiveProfileId()).not.toBeNull();
  });

  it('resetAllAppData wipes profiles', () => {
    resetAllAppData();
    refreshActiveProfileCache();
    expect(listProfiles()).toEqual([]);
    expect(getActiveProfileId()).toBeNull();
  });
});
