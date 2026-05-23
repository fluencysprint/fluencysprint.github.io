import type {
  Profile, LanguageId, CEFRLevel,
  UserProgress, MistakeRecord, Session, WritingEntry, SpeakingEntry,
  DiagnosticResult, AppSettings, ResumableDiagnosticState, ResumableSprintState,
} from '../types';
import { readJSON, writeJSON, removeKey, listKeysWithPrefix } from './storageAdapter';
import { nanoid } from './utils';

export const STORAGE_VERSION = '1';

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
}

export function resetAllAppData(): void {
  const allKeys = [
    KEYS.VERSION,
    KEYS.PROFILES,
    KEYS.ACTIVE_PROFILE_ID,
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
    // Ensure later-added fields exist on older payloads
    return {
      ...emptyProfileData(profile),
      ...data,
      drafts: { ...(data.drafts ?? {}) },
      recentExerciseIds: data.recentExerciseIds ?? [],
    };
  }
  return emptyProfileData(profile);
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
