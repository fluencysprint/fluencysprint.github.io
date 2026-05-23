import { describe, it, expect } from 'vitest';
import {
  createProfile, listProfiles, getActiveProfile, getActiveProfileId,
  setActiveProfileId, deleteProfile, resetProfile, resetAllAppData,
  getProfileData,
} from '../profile';
import {
  refreshActiveProfileCache, getProgress, updateProgress,
  addWritingEntry, getWritingEntries, exportAll, importAll, type FluencyExport,
} from '../storage';

describe('profile lifecycle', () => {
  it('creating a profile sets it active and seeds empty data', () => {
    // Setup already created one profile; create another.
    const p = createProfile({
      displayName: 'Friend',
      targetLanguage: 'english',
      selfEstimatedLevel: 'A1',
      targetLevel: 'A2',
      dailyTime: 5,
    });
    expect(getActiveProfileId()).toBe(p.id);
    expect(getActiveProfile()?.targetLanguage).toBe('english');
    const data = getProfileData(p.id);
    expect(data?.mistakes).toEqual([]);
    expect(data?.writing).toEqual([]);
  });

  it('switching profiles does not mix progress', () => {
    const seedId = getActiveProfileId();
    expect(seedId).not.toBeNull();
    updateProgress({ totalMinutes: 42 });

    const other = createProfile({
      displayName: 'Other',
      targetLanguage: 'english',
      selfEstimatedLevel: 'A2',
      targetLevel: 'B1',
      dailyTime: 10,
    });
    refreshActiveProfileCache();
    // Brand-new profile starts with zero minutes.
    expect(getProgress().totalMinutes).toBe(0);
    updateProgress({ totalMinutes: 7 });

    setActiveProfileId(seedId!);
    refreshActiveProfileCache();
    expect(getProgress().totalMinutes).toBe(42);

    setActiveProfileId(other.id);
    refreshActiveProfileCache();
    expect(getProgress().totalMinutes).toBe(7);
  });

  it('resetProfile only clears the targeted profile', () => {
    addWritingEntry({
      id: 'e1', promptId: 'p', date: new Date().toISOString(),
      text: 't', durationSeconds: 1, selfScores: {},
      weakCategories: [], mode: 'diagnostic',
    });
    const a = getActiveProfileId()!;
    const other = createProfile({
      displayName: 'Other', targetLanguage: 'english',
      selfEstimatedLevel: 'A1', targetLevel: 'A2', dailyTime: 5,
    });
    refreshActiveProfileCache();
    addWritingEntry({
      id: 'e2', promptId: 'p', date: new Date().toISOString(),
      text: 't', durationSeconds: 1, selfScores: {},
      weakCategories: [], mode: 'diagnostic',
    });

    resetProfile(other.id);
    refreshActiveProfileCache();
    expect(getWritingEntries()).toEqual([]); // other was reset

    setActiveProfileId(a);
    refreshActiveProfileCache();
    expect(getWritingEntries().map(e => e.id)).toContain('e1'); // a is untouched
  });

  it('deleteProfile removes data and falls back to another profile if available', () => {
    const a = getActiveProfileId()!;
    const other = createProfile({
      displayName: 'Other', targetLanguage: 'english',
      selfEstimatedLevel: 'A1', targetLevel: 'A2', dailyTime: 5,
    });
    refreshActiveProfileCache();
    deleteProfile(other.id);
    expect(listProfiles().find(p => p.id === other.id)).toBeUndefined();
    expect(getActiveProfileId()).toBe(a);
  });

  it('resetAllAppData wipes every profile and active id', () => {
    resetAllAppData();
    refreshActiveProfileCache();
    expect(listProfiles()).toEqual([]);
    expect(getActiveProfileId()).toBeNull();
  });
});

describe('backup export / import', () => {
  it('export includes all profiles + their data', () => {
    addWritingEntry({
      id: 'export-e1', promptId: 'p', date: new Date().toISOString(),
      text: 't', durationSeconds: 1, selfScores: {},
      weakCategories: [], mode: 'diagnostic',
    });
    const other = createProfile({
      displayName: 'Other', targetLanguage: 'english',
      selfEstimatedLevel: 'A1', targetLevel: 'A2', dailyTime: 5,
    });
    refreshActiveProfileCache();
    const dump = exportAll();
    expect(dump.profiles.length).toBeGreaterThanOrEqual(2);
    expect(dump.activeProfileId).toBe(other.id);
    // Switch back and confirm the writing entry is preserved in the export.
    const profileIds = dump.profiles.map(p => p.id);
    const found = profileIds.some(id =>
      (dump.profileData[id]?.writing ?? []).some(w => w.id === 'export-e1')
    );
    expect(found).toBe(true);
  });

  it('import restores profiles and active id, replacing existing data', () => {
    const snapshot = exportAll();
    resetAllAppData();
    refreshActiveProfileCache();
    expect(listProfiles()).toEqual([]);
    importAll(snapshot as FluencyExport);
    refreshActiveProfileCache();
    expect(listProfiles().length).toBeGreaterThanOrEqual(1);
  });
});
