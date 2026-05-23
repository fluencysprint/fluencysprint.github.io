import { describe, it, expect, beforeEach } from 'vitest';
import { resetAllAppData, createProfile, getProfileData, KEYS, listProfiles } from '../profile';
import { writeJSON } from '../storageAdapter';
import { refreshActiveProfileCache, getEvidence, getProgress } from '../storage';
import type { DiagnosticAnswer } from '../../types';

function seedLegacyV1Profile() {
  resetAllAppData();
  refreshActiveProfileCache();
  const profile = createProfile({
    displayName: 'Existing user', targetLanguage: 'spanish',
    selfEstimatedLevel: 'B1', targetLevel: 'C1', dailyTime: 10,
  });

  const answers: DiagnosticAnswer[] = [
    { exerciseId: 'g-sub-01', cefrLevel: 'B1', skill: 'grammar', userAnswer: 'x', correct: true, confidence: 'high', timeSpent: 12, skipped: false },
    { exerciseId: 'g-sub-02', cefrLevel: 'B1', skill: 'grammar', userAnswer: 'y', correct: false, confidence: 'low', timeSpent: 20, skipped: false },
    { exerciseId: 'g-sub-03', cefrLevel: 'B2', skill: 'grammar', userAnswer: '', correct: false, confidence: 'low', timeSpent: 0, skipped: true },
  ];

  // Write a pre-v2 blob directly: no schemaVersion, no evidence, with history.
  const legacyBlob = {
    progress: { ...getProfileData(profile.id)!.progress, sessionCount: 7, totalMinutes: 90, diagnosticComplete: true },
    mistakes: [],
    sessions: [
      { id: 's1', date: new Date().toISOString(), type: 'sprint', durationSeconds: 300, exercisesAttempted: 8, exercisesCorrect: 6, accuracy: 75, skillsWorked: ['grammar'], mistakesAdded: [] },
    ],
    writing: [],
    speaking: [],
    diagnostics: [
      { id: 'd1', date: new Date().toISOString(), language: 'spanish', answers, placement: {}, timeSpent: 200, itemCount: 2 },
    ],
    settings: getProfileData(profile.id)!.settings,
    drafts: {},
    recentExerciseIds: [],
    // intentionally NO evidence and NO schemaVersion
  };
  writeJSON(KEYS.profileData(profile.id), legacyBlob);
  refreshActiveProfileCache();
  return profile;
}

describe('storage v2 migration', () => {
  beforeEach(() => {});

  it('migrates an old profile without resetting its data (tests 15, 38)', () => {
    const profile = seedLegacyV1Profile();
    const data = getProfileData(profile.id)!;

    // Profile still loads with its history intact.
    expect(listProfiles()).toHaveLength(1);
    expect(data.progress.sessionCount).toBe(7);
    expect(data.progress.totalMinutes).toBe(90);
    expect(data.sessions).toHaveLength(1);
    expect(data.diagnostics).toHaveLength(1);

    // Schema upgraded and legacy evidence seeded from old answers.
    expect(data.schemaVersion).toBe('2');
    expect(data.evidence).toHaveLength(3);
    expect(data.evidence.every(e => e.scoringMode === 'legacy')).toBe(true);
    expect(data.pendingMigrationNotice).toBe(true);
  });

  it('legacy evidence is discounted and does not create strong readiness alone (test 14/15)', () => {
    const profile = seedLegacyV1Profile();
    getProfileData(profile.id); // trigger migration
    refreshActiveProfileCache();
    const evidence = getEvidence();
    expect(evidence.length).toBeGreaterThan(0);
    expect(evidence.every(e => e.evidenceWeight <= 0.1)).toBe(true);
    // Progress preserved and readable.
    expect(getProgress().sessionCount).toBe(7);
  });

  it('is idempotent — re-reading does not duplicate evidence', () => {
    const profile = seedLegacyV1Profile();
    const first = getProfileData(profile.id)!.evidence.length;
    const second = getProfileData(profile.id)!.evidence.length;
    expect(second).toBe(first);
  });
});
