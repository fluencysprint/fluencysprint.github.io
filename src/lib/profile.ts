import type {
  Profile, LanguageId, CEFRLevel,
  UserProgress, MistakeRecord, Session, WritingEntry, SpeakingEntry,
  DiagnosticResult, AppSettings, ResumableDiagnosticState, ResumableSprintState,
  EvidenceEvent,
} from '../types';
import { readJSON, writeJSON, removeKey, listKeysWithPrefix, clearSessionCheckpoint, CHECKPOINT_KEY } from './storageAdapter';
import { nanoid } from './utils';

export const STORAGE_VERSION = '2';

export const KEYS = {
  VERSION: 'fluencySprint.storageVersion',
  PROFILES: 'fluencySprint.profiles',
  ACTIVE_PROFILE_ID: 'fluencySprint.activeProfileId',
  profileData: (id: string) => `fluencySprint.profileData.${id}`,
  lastSavedAt: (id: string) => `fluencySprint.lastSavedAt.${id}`,
} as const;

// ─── Profile data shape (one blob per profile) ──────────────────────────────

export interface ProfileData {
  progress: UserProgress;
  mistakes: MistakeRecord[];
  sessions: Session[];
  writing: WritingEntry[];
  speaking: SpeakingEntry[];
  diagnostics: DiagnosticResult[];
  settings: AppSettings;
  diagnosticSession?: ResumableDiagnosticState;
  sprintSession?: ResumableSprintState;
  drafts: Record<string, { text: string; savedAt: string }>;
  recentExerciseIds: string[];
  /** Append-only evidence ledger (every recorded action). */
  evidence: EvidenceEvent[];
  /** Storage schema version this blob was last written under. */
  schemaVersion?: string;
  /** True after a v1→v2 upgrade until the user dismisses the notice. */
  pendingMigrationNotice?: boolean;
}

// ─── Defaults ───────────────────────────────────────────────────────────────

export function defaultProgressFor(profile: Profile): UserProgress {
  return {
    onboardingComplete: true, // profile creation completes onboarding
    diagnosticComplete: false,
    selectedLevel: profile.selfEstimatedLevel,
    targetLevel: profile.targetLevel,
    dailyTime: profile.dailyTime,
    keyboardType: profile.targetLanguage === 'spanish' ? 'us' : 'us',
    skillScores: {},
    levelReadiness: {},
    sessionCount: 0,
    totalMinutes: 0,
    streakDays: 0,
    lastSessionDate: '',
    completedExercises: [],
    masteredExercises: [],
    createdAt: profile.createdAt,
    totalCorrect: 0,
    totalAttempted: 0,
  };
}

export function defaultSettingsFor(profile: Profile): AppSettings {
  return {
    theme: 'system',
    accentMode: profile.targetLanguage === 'spanish' ? 'lenient' : 'lenient',
    keyboardMode: 'us',
    targetLevel: profile.targetLevel,
    dailyTime: profile.dailyTime,
    showTimers: true,
    autoAdvance: false,
    writingFrequency: 'sometimes',
  };
}

export function emptyProfileData(profile: Profile): ProfileData {
  return {
    progress: defaultProgressFor(profile),
    mistakes: [],
    sessions: [],
    writing: [],
    speaking: [],
    diagnostics: [],
    settings: defaultSettingsFor(profile),
    drafts: {},
    recentExerciseIds: [],
    evidence: [],
    schemaVersion: STORAGE_VERSION,
  };
}

// ─── Profile CRUD ───────────────────────────────────────────────────────────

export function listProfiles(): Profile[] {
  return readJSON<Profile[]>(KEYS.PROFILES, []);
}

export function saveProfiles(profiles: Profile[]): void {
  writeJSON(KEYS.PROFILES, profiles);
}

export function getActiveProfileId(): string | null {
  return readJSON<string | null>(KEYS.ACTIVE_PROFILE_ID, null);
}

export function setActiveProfileId(id: string | null): void {
  if (id === null) {
    removeKey(KEYS.ACTIVE_PROFILE_ID);
  } else {
    writeJSON(KEYS.ACTIVE_PROFILE_ID, id);
  }
}

export function getActiveProfile(): Profile | null {
  const id = getActiveProfileId();
  if (!id) return null;
  return listProfiles().find(p => p.id === id) ?? null;
}

export interface CreateProfileInput {
  displayName?: string;
  targetLanguage: LanguageId;
  selfEstimatedLevel: CEFRLevel | 'beginner' | 'not_sure';
  targetLevel: CEFRLevel;
  dailyTime: 5 | 10 | 20;
}

export function createProfile(input: CreateProfileInput, makeActive = true): Profile {
  const now = new Date().toISOString();
  const profile: Profile = {
    id: nanoid(),
    displayName: input.displayName,
    targetLanguage: input.targetLanguage,
    selfEstimatedLevel: input.selfEstimatedLevel,
    targetLevel: input.targetLevel,
    dailyTime: input.dailyTime,
    createdAt: now,
    updatedAt: now,
  };
  const profiles = listProfiles();
  profiles.push(profile);
  saveProfiles(profiles);
  saveProfileData(profile.id, emptyProfileData(profile));
  if (makeActive) setActiveProfileId(profile.id);
  writeJSON(KEYS.VERSION, STORAGE_VERSION);
  return profile;
}

export function updateProfile(id: string, updates: Partial<Profile>): Profile | null {
  const profiles = listProfiles();
  const idx = profiles.findIndex(p => p.id === id);
  if (idx < 0) return null;
  profiles[idx] = { ...profiles[idx], ...updates, updatedAt: new Date().toISOString() };
  saveProfiles(profiles);
  return profiles[idx];
}

export function deleteProfile(id: string): void {
  const remaining = listProfiles().filter(p => p.id !== id);
  saveProfiles(remaining);
  removeKey(KEYS.profileData(id));
  removeKey(KEYS.lastSavedAt(id));
  const active = getActiveProfileId();
  if (active === id) {
    setActiveProfileId(remaining[0]?.id ?? null);
  }
}

export function resetProfile(id: string): void {
  const profile = listProfiles().find(p => p.id === id);
  if (!profile) return;
  saveProfileData(id, emptyProfileData(profile));
  clearSessionCheckpoint();
}

export function resetAllAppData(): void {
  const allKeys = [
    KEYS.VERSION,
    KEYS.PROFILES,
    KEYS.ACTIVE_PROFILE_ID,
    CHECKPOINT_KEY,
    ...listKeysWithPrefix('fluencySprint.profileData.'),
    ...listKeysWithPrefix('fluencySprint.lastSavedAt.'),
    // Also wipe legacy c1sprint.* keys for users upgrading.
    ...listKeysWithPrefix('c1sprint.'),
  ];
  for (const k of allKeys) removeKey(k);
}

// ─── Profile data IO ────────────────────────────────────────────────────────

export function getProfileData(id: string): ProfileData | null {
  const profile = listProfiles().find(p => p.id === id);
  if (!profile) return null;
  const data = readJSON<ProfileData | null>(KEYS.profileData(id), null);
  if (data) {
    // Detect pre-v2 blobs from the *raw* payload (before defaults are applied).
    const rawVersion = data.schemaVersion;
    // Ensure later-added fields exist on older payloads.
    const merged: ProfileData = {
      ...emptyProfileData(profile),
      ...data,
      drafts: { ...(data.drafts ?? {}) },
      recentExerciseIds: data.recentExerciseIds ?? [],
      evidence: data.evidence ?? [],
    };
    // Upgrade pre-v2 blobs in place: seed legacy evidence, never reset data.
    if (rawVersion !== STORAGE_VERSION) {
      return migrateProfileDataToV2(profile, merged);
    }
    return merged;
  }
  return emptyProfileData(profile);
}

/**
 * Upgrade a pre-v2 profile blob: preserve everything, convert old diagnostic
 * answers into low-weight legacy evidence, and flag a one-time notice. Sessions
 * and history are kept untouched (they still feed momentum). Never resets data.
 */
export function migrateProfileDataToV2(profile: Profile, data: ProfileData): ProfileData {
  const hadActivity = (data.diagnostics?.length ?? 0) > 0 || (data.sessions?.length ?? 0) > 0;

  // Only seed legacy evidence if none exists yet (idempotent).
  if (data.evidence.length === 0 && (data.diagnostics?.length ?? 0) > 0) {
    const seen = new Map<string, number>();
    const legacy: EvidenceEvent[] = [];
    for (const diag of data.diagnostics) {
      for (const ans of diag.answers) {
        const seenBefore = seen.get(ans.exerciseId) ?? 0;
        seen.set(ans.exerciseId, seenBefore + 1);
        legacy.push({
          id: nanoid(),
          profileId: profile.id,
          languageId: diag.language,
          activityType: 'diagnostic',
          exerciseId: ans.exerciseId,
          itemVersion: 1,
          itemFamilyId: ans.exerciseId,
          skill: ans.skill,
          cefrLevel: ans.cefrLevel,
          firstAttempt: seenBefore === 0,
          seenCountBefore: seenBefore,
          correct: ans.correct,
          skipped: ans.skipped,
          userAnswer: ans.userAnswer,
          confidence: ans.confidence,
          timeSpentSeconds: ans.timeSpent,
          activeTimeSeconds: ans.timeSpent,
          mistakeCategories: [],
          scoringMode: 'legacy',
          // Legacy diagnostic answers retain enough metadata to count weakly.
          evidenceWeight: seenBefore === 0 ? 0.1 : 0.05,
          isRepeat: seenBefore > 0,
          isReview: false,
          createdAt: diag.date,
        });
      }
    }
    data.evidence = legacy;
  }

  data.schemaVersion = STORAGE_VERSION;
  // Surface a one-time notice for profiles that actually had prior progress.
  if (hadActivity && data.pendingMigrationNotice === undefined) {
    data.pendingMigrationNotice = true;
  }
  saveProfileData(profile.id, data);
  return data;
}

export function saveProfileData(id: string, data: ProfileData): void {
  writeJSON(KEYS.profileData(id), data);
  writeJSON(KEYS.lastSavedAt(id), new Date().toISOString());
}

export function getProfileLastSavedAt(id: string): string | null {
  return readJSON<string | null>(KEYS.lastSavedAt(id), null);
}

// ─── Best-effort migration from legacy c1sprint.* keys ─────────────────────

export function migrateLegacyIfNeeded(): Profile | null {
  if (listProfiles().length > 0) return null;
  const legacyProgressRaw = readJSON<unknown>('c1sprint.progress', null);
  if (!legacyProgressRaw) return null;
  // Create a fresh Spanish profile and dump legacy data into it.
  const profile = createProfile({
    displayName: 'Imported profile',
    targetLanguage: 'spanish',
    selfEstimatedLevel: 'B1',
    targetLevel: 'C1',
    dailyTime: 10,
  });
  const data = emptyProfileData(profile);
  // Best-effort field copies; ignore shape mismatches.
  try {
    const legacy = legacyProgressRaw as Record<string, unknown>;
    data.progress = { ...data.progress, ...(legacy as Partial<UserProgress>) };
  } catch { /* ignore */ }
  data.mistakes = readJSON<MistakeRecord[]>('c1sprint.mistakes', []);
  data.sessions = readJSON<Session[]>('c1sprint.sessions', []);
  data.writing = readJSON<WritingEntry[]>('c1sprint.writing', []);
  data.speaking = readJSON<SpeakingEntry[]>('c1sprint.speaking', []);
  data.diagnostics = readJSON<DiagnosticResult[]>('c1sprint.diagnostics', []);
  const legacySettings = readJSON<Partial<AppSettings>>('c1sprint.settings', {});
  data.settings = { ...data.settings, ...legacySettings };
  saveProfileData(profile.id, data);
  return profile;
}
