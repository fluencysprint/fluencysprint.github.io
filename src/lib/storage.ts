import type {
  UserProgress, MistakeRecord, Session, AppSettings,
  WritingEntry, SpeakingEntry, DiagnosticResult,
  ResumableDiagnosticState, ResumableSprintState, Profile,
} from '../types';
import {
  getActiveProfileId, getActiveProfile, getProfileData, saveProfileData,
  listProfiles, getProfileLastSavedAt, emptyProfileData,
  resetAllAppData, saveProfiles, setActiveProfileId, createProfile,
  type ProfileData,
} from './profile';
import { registerFlushHandler, isStorageAvailable, getLastSaveStatus } from './storageAdapter';

// ─── Active-profile resolver ────────────────────────────────────────────────

/**
 * In-memory write-through cache of the current profile's data.
 * Reads pull from cache (or storage); writes update cache and schedule a flush.
 * A lifecycle flush handler persists pending writes on hide/unload.
 */
let _cachedId: string | null = null;
let _cache: ProfileData | null = null;
let _dirty = false;

function readActive(): { id: string; data: ProfileData } | null {
  const id = getActiveProfileId();
  if (!id) return null;
  if (_cachedId === id && _cache) {
    return { id, data: _cache };
  }
  const data = getProfileData(id);
  if (!data) return null;
  _cachedId = id;
  _cache = data;
  _dirty = false;
  return { id, data };
}

function writeActive(mutator: (d: ProfileData) => void): void {
  const ctx = readActive();
  if (!ctx) return;
  mutator(ctx.data);
  _dirty = true;
  // Persist immediately — small payloads and we want crash-safety on mobile.
  saveProfileData(ctx.id, ctx.data);
  _dirty = false;
}

/** Force-reload the cache from disk (call after switching active profile). */
export function refreshActiveProfileCache(): void {
  _cachedId = null;
  _cache = null;
  _dirty = false;
}

// Register a flush handler so any pending dirty state is persisted on hide.
registerFlushHandler(() => {
  if (_dirty && _cachedId && _cache) {
    saveProfileData(_cachedId, _cache);
    _dirty = false;
  }
});

// ─── Progress ──────────────────────────────────────────────────────────────

export function getProgress(): UserProgress {
  const ctx = readActive();
  if (!ctx) {
    // Caller is in pre-profile state; provide a neutral default.
    return emptyProfileData({
      id: 'tmp', targetLanguage: 'spanish',
      selfEstimatedLevel: 'not_sure', targetLevel: 'B1', dailyTime: 10,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    }).progress;
  }
  return ctx.data.progress;
}

export function saveProgress(progress: UserProgress): void {
  writeActive(d => { d.progress = progress; });
}

export function updateProgress(updates: Partial<UserProgress>): UserProgress {
  let next: UserProgress | null = null;
  writeActive(d => {
    d.progress = { ...d.progress, ...updates };
    next = d.progress;
  });
  return next ?? getProgress();
}

// ─── Mistakes ──────────────────────────────────────────────────────────────

export function getMistakes(): MistakeRecord[] {
  return readActive()?.data.mistakes ?? [];
}

export function saveMistakes(mistakes: MistakeRecord[]): void {
  writeActive(d => { d.mistakes = mistakes; });
}

export function addMistake(mistake: MistakeRecord): void {
  writeActive(d => {
    const existingIndex = d.mistakes.findIndex(m => m.exerciseId === mistake.exerciseId);
    if (existingIndex >= 0) {
      d.mistakes[existingIndex] = {
        ...mistake,
        attempts: d.mistakes[existingIndex].attempts + 1,
      };
    } else {
      d.mistakes.push(mistake);
    }
  });
}

export function updateMistake(id: string, updates: Partial<MistakeRecord>): void {
  writeActive(d => {
    const index = d.mistakes.findIndex(m => m.id === id);
    if (index >= 0) {
      d.mistakes[index] = { ...d.mistakes[index], ...updates };
    }
  });
}

export function getDueMistakes(today?: Date): MistakeRecord[] {
  const t = today ?? new Date();
  const todayStr = t.toISOString().split('T')[0];
  return getMistakes().filter(m => m.nextReviewDate <= todayStr && m.status !== 'mastered');
}

export function getOverdueMistakes(): MistakeRecord[] {
  const todayStr = new Date().toISOString().split('T')[0];
  return getMistakes().filter(m => m.nextReviewDate < todayStr && m.status !== 'mastered');
}

// ─── Settings ──────────────────────────────────────────────────────────────

export function getSettings(): AppSettings {
  const ctx = readActive();
  if (!ctx) {
    return {
      theme: 'system', accentMode: 'lenient', keyboardMode: 'us',
      targetLevel: 'B1', dailyTime: 10, showTimers: true,
      autoAdvance: false, writingFrequency: 'sometimes',
    };
  }
  return ctx.data.settings;
}

export function saveSettings(settings: AppSettings): void {
  writeActive(d => { d.settings = settings; });
}

export function updateSettings(updates: Partial<AppSettings>): AppSettings {
  let next: AppSettings | null = null;
  writeActive(d => {
    d.settings = { ...d.settings, ...updates };
    next = d.settings;
  });
  return next ?? getSettings();
}

// ─── Sessions ──────────────────────────────────────────────────────────────

export function getSessions(): Session[] {
  return readActive()?.data.sessions ?? [];
}

export function addSession(session: Session): void {
  writeActive(d => { d.sessions.push(session); });
}

export function getRecentSessions(n = 10): Session[] {
  const all = getSessions();
  return all.slice(-n).reverse();
}

// ─── Writing ───────────────────────────────────────────────────────────────

export function getWritingEntries(): WritingEntry[] {
  return readActive()?.data.writing ?? [];
}

export function addWritingEntry(entry: WritingEntry): void {
  writeActive(d => { d.writing.push(entry); });
}

// ─── Speaking ──────────────────────────────────────────────────────────────

export function getSpeakingEntries(): SpeakingEntry[] {
  return readActive()?.data.speaking ?? [];
}

export function addSpeakingEntry(entry: SpeakingEntry): void {
  writeActive(d => { d.speaking.push(entry); });
}

// ─── Diagnostics ───────────────────────────────────────────────────────────

export function getDiagnosticResults(): DiagnosticResult[] {
  return readActive()?.data.diagnostics ?? [];
}

export function addDiagnosticResult(result: DiagnosticResult): void {
  writeActive(d => { d.diagnostics.push(result); });
}

export function getLatestDiagnostic(): DiagnosticResult | null {
  const all = getDiagnosticResults();
  return all.length > 0 ? all[all.length - 1] : null;
}

// ─── Resumable sessions ────────────────────────────────────────────────────

export function getResumableDiagnostic(): ResumableDiagnosticState | null {
  return readActive()?.data.diagnosticSession ?? null;
}

export function saveResumableDiagnostic(state: ResumableDiagnosticState | null): void {
  writeActive(d => {
    if (state === null) delete d.diagnosticSession;
    else d.diagnosticSession = { ...state, lastSavedAt: new Date().toISOString() };
  });
}

export function getResumableSprint(): ResumableSprintState | null {
  return readActive()?.data.sprintSession ?? null;
}

export function saveResumableSprint(state: ResumableSprintState | null): void {
  writeActive(d => {
    if (state === null) delete d.sprintSession;
    else d.sprintSession = { ...state, lastSavedAt: new Date().toISOString() };
  });
}

// ─── Recency tracking ──────────────────────────────────────────────────────

const RECENT_MAX = 50;

export function getRecentExerciseIds(): string[] {
  return readActive()?.data.recentExerciseIds ?? [];
}

export function markExercisesSeen(ids: string[]): void {
  if (ids.length === 0) return;
  writeActive(d => {
    const existing = d.recentExerciseIds ?? [];
    const merged = [...existing, ...ids];
    d.recentExerciseIds = merged.slice(-RECENT_MAX);
  });
}

// ─── Evidence ledger ───────────────────────────────────────────────────────

export function getEvidence(): import('../types').EvidenceEvent[] {
  return readActive()?.data.evidence ?? [];
}

export function addEvidenceEvent(event: import('../types').EvidenceEvent): void {
  writeActive(d => { d.evidence.push(event); });
}

// ─── Migration notice ──────────────────────────────────────────────────────

export function hasPendingMigrationNotice(): boolean {
  return readActive()?.data.pendingMigrationNotice === true;
}

export function dismissMigrationNotice(): void {
  writeActive(d => { d.pendingMigrationNotice = false; });
}

// ─── Streak ────────────────────────────────────────────────────────────────

export function updateStreak(): number {
  const progress = getProgress();
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  let streak = progress.streakDays;
  if (progress.lastSessionDate === yesterday) streak += 1;
  else if (progress.lastSessionDate !== today) streak = 1;

  updateProgress({ streakDays: streak, lastSessionDate: today });
  return streak;
}

// ─── Drafts (autosave, profile-scoped) ────────────────────────────────────

export function saveDraft(slot: string, text: string): void {
  writeActive(d => {
    d.drafts[slot] = { text, savedAt: new Date().toISOString() };
  });
}

export function getDraft(slot: string): string | null {
  const drafts = readActive()?.data.drafts;
  return drafts?.[slot]?.text ?? null;
}

export function clearDraft(slot: string): void {
  writeActive(d => { delete d.drafts[slot]; });
}

export function listDrafts(): { slot: string; text: string; savedAt: string }[] {
  const drafts = readActive()?.data.drafts ?? {};
  return Object.entries(drafts).map(([slot, v]) => ({
    slot, text: v.text, savedAt: v.savedAt,
  }));
}

// ─── Export / import ──────────────────────────────────────────────────────

export interface FluencyExport {
  version: string;
  exportedAt: string;
  profiles: Profile[];
  profileData: Record<string, ProfileData>;
  activeProfileId: string | null;
}

export function exportAll(): FluencyExport {
  const profiles = listProfiles();
  const profileData: Record<string, ProfileData> = {};
  for (const p of profiles) {
    const data = getProfileData(p.id);
    if (data) profileData[p.id] = data;
  }
  return {
    version: '2.0',
    exportedAt: new Date().toISOString(),
    profiles,
    profileData,
    activeProfileId: getActiveProfileId(),
  };
}

export function importAll(data: FluencyExport): void {
  if (!data || typeof data !== 'object' || !data.version) {
    throw new Error('Invalid export format');
  }
  // Support old v1 single-profile exports from c1-sprint-spanish releases.
  if (data.version === '1.0' || (data as unknown as { progress?: unknown }).progress) {
    importLegacyV1(data as unknown as LegacyV1Export);
    return;
  }
  if (!Array.isArray(data.profiles)) {
    throw new Error('Export is missing profiles');
  }
  // Wipe existing app data then write imported state.
  resetAllAppData();
  saveProfiles(data.profiles);
  for (const [id, pd] of Object.entries(data.profileData ?? {})) {
    saveProfileData(id, pd as ProfileData);
  }
  setActiveProfileId(data.activeProfileId ?? data.profiles[0]?.id ?? null);
  refreshActiveProfileCache();
}

// Legacy v1 export from the Spanish-only release.
interface LegacyV1Export {
  version: string;
  exportedAt?: string;
  progress?: Partial<UserProgress>;
  mistakes?: MistakeRecord[];
  sessions?: Session[];
  writing?: WritingEntry[];
  speaking?: SpeakingEntry[];
  settings?: Partial<AppSettings>;
}

function importLegacyV1(data: LegacyV1Export): void {
  resetAllAppData();
  const profile = createProfile({
    displayName: 'Imported',
    targetLanguage: 'spanish',
    selfEstimatedLevel: 'B1',
    targetLevel: 'C1',
    dailyTime: 10,
  });
  refreshActiveProfileCache();
  if (data.progress) updateProgress(data.progress);
  if (data.mistakes) saveMistakes(data.mistakes);
  if (data.sessions) for (const s of data.sessions) addSession(s);
  if (data.writing) for (const w of data.writing) addWritingEntry(w);
  if (data.speaking) for (const s of data.speaking) addSpeakingEntry(s);
  if (data.settings) updateSettings(data.settings as Partial<AppSettings>);
}

// ─── Reset helpers (back-compat names) ────────────────────────────────────

export { resetAllAppData as resetAll };

// ─── Storage status ───────────────────────────────────────────────────────

export function getActiveProfileLastSavedAt(): string | null {
  const id = getActiveProfileId();
  if (!id) return null;
  return getProfileLastSavedAt(id);
}

export function getStorageStatus(): {
  available: boolean;
  lastSavedAt: string | null;
  saveStatus: ReturnType<typeof getLastSaveStatus>;
} {
  return {
    available: isStorageAvailable(),
    lastSavedAt: getActiveProfileLastSavedAt(),
    saveStatus: getLastSaveStatus(),
  };
}

// Re-export commonly used profile helpers so other modules can import from
// a single surface.
export {
  listProfiles, getActiveProfile, getActiveProfileId,
};

// Keep legacy default exports the tests rely on.
export const defaultProgress: UserProgress = emptyProfileData({
  id: 'default', targetLanguage: 'spanish',
  selfEstimatedLevel: 'not_sure', targetLevel: 'B1', dailyTime: 10,
  createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
}).progress;

export const defaultSettings: AppSettings = emptyProfileData({
  id: 'default', targetLanguage: 'spanish',
  selfEstimatedLevel: 'not_sure', targetLevel: 'B1', dailyTime: 10,
  createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
}).settings;
