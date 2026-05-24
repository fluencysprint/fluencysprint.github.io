import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getSettings, saveSettings, getStorageStatus, refreshActiveProfileCache,
} from '../lib/storage';
import { onSaveStatus, isPersistentStorageGranted, type SaveStatus } from '../lib/storageAdapter';
import {
  listProfiles, getActiveProfile, setActiveProfileId, deleteProfile, resetProfile, resetAllAppData,
} from '../lib/profile';
import { downloadProgress, uploadProgress } from '../lib/exportImport';
import { getLanguagePack } from '../languages';
import { applyTheme, type ThemeChoice } from '../lib/theme';
import type { AppSettings, CEFRLevel, WritingFrequency } from '../types';

function formatRelative(iso: string | null): string {
  if (!iso) return 'never';
  const date = new Date(iso);
  const diff = (Date.now() - date.getTime()) / 1000;
  if (diff < 5) return 'just now';
  if (diff < 60) return `${Math.round(diff)}s ago`;
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
  return date.toLocaleString();
}

export default function Settings() {
  const navigate = useNavigate();
  const profile = getActiveProfile();
  const pack = profile ? getLanguagePack(profile.targetLanguage) : null;

  const [settings, setSettings] = useState<AppSettings>(getSettings());
  const [savedFlash, setSavedFlash] = useState(false);
  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [importError, setImportError] = useState('');
  const [resetProfileConfirm, setResetProfileConfirm] = useState(false);
  const [resetAllConfirm, setResetAllConfirm] = useState(false);
  const [deleteProfileConfirm, setDeleteProfileConfirm] = useState(false);
  const [saveStatus, setSaveStatusState] = useState<SaveStatus>({ kind: 'idle' });
  const [persistentStorage, setPersistentStorage] = useState<boolean | null>(null);
  const [, forceRerender] = useState(0);

  useEffect(() => onSaveStatus(setSaveStatusState), []);
  useEffect(() => {
    isPersistentStorageGranted().then(granted => setPersistentStorage(granted));
  }, []);

  const status = getStorageStatus();
  const profiles = listProfiles();

  function update<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    saveSettings(updated);
    if (key === 'theme') applyTheme(value as ThemeChoice);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1500);
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportStatus('idle');
    uploadProgress(file)
      .then(() => {
        setImportStatus('success');
        refreshActiveProfileCache();
        setSettings(getSettings());
        forceRerender(n => n + 1);
      })
      .catch(err => {
        setImportStatus('error');
        setImportError(err.message);
      });
    e.target.value = '';
  }

  function handleSwitch(id: string) {
    setActiveProfileId(id);
    refreshActiveProfileCache();
    window.location.reload();
  }

  function handleResetProfile() {
    if (!profile) return;
    if (!resetProfileConfirm) {
      setResetProfileConfirm(true);
      setTimeout(() => setResetProfileConfirm(false), 5000);
      return;
    }
    resetProfile(profile.id);
    refreshActiveProfileCache();
    window.location.reload();
  }

  function handleDeleteProfile() {
    if (!profile) return;
    if (!deleteProfileConfirm) {
      setDeleteProfileConfirm(true);
      setTimeout(() => setDeleteProfileConfirm(false), 5000);
      return;
    }
    deleteProfile(profile.id);
    refreshActiveProfileCache();
    if (listProfiles().length === 0) {
      window.location.hash = '#/onboarding';
    }
    window.location.reload();
  }

  function handleResetAll() {
    if (!resetAllConfirm) {
      setResetAllConfirm(true);
      setTimeout(() => setResetAllConfirm(false), 5000);
      return;
    }
    resetAllAppData();
    window.location.hash = '#/onboarding';
    window.location.reload();
  }

  const row = (label: string, desc: string, control: React.ReactNode) => (
    <div className="flex items-start justify-between gap-4 py-4 border-b border-slate-100 dark:border-slate-700 last:border-0">
      <div className="flex-1">
        <div className="text-sm font-medium text-slate-800 dark:text-slate-100">{label}</div>
        <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{desc}</div>
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );

  const select = <T extends string>(
    value: T,
    options: { value: T; label: string }[],
    onChange: (v: T) => void,
  ) => (
    <select
      value={value}
      onChange={e => onChange(e.target.value as T)}
      className="text-sm border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-1.5 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white dark:bg-slate-700"
    >
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );

  const saveStatusLabel = (() => {
    switch (saveStatus.kind) {
      case 'saving': return 'Saving…';
      case 'saved': return `Saved ${formatRelative(saveStatus.at)}`;
      case 'error': return `Save failed: ${saveStatus.message}`;
      default: return status.lastSavedAt ? `Last saved ${formatRelative(status.lastSavedAt)}` : 'Not saved yet';
    }
  })();

  return (
    <div className="space-y-6 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Settings</h1>
          <p className="text-slate-400 dark:text-slate-400 text-sm mt-1">Manage your profile, practice and data</p>
        </div>
        {savedFlash && (
          <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium animate-pulse">✓ Saved</span>
        )}
      </div>

      {/* Storage diagnostics */}
      <div className={`rounded-2xl border p-4 text-sm ${
        status.available
          ? 'bg-emerald-50 dark:bg-emerald-900/40 border-emerald-200 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200'
          : 'bg-red-50 dark:bg-red-900/40 border-red-200 dark:border-red-700 text-red-700 dark:text-red-300'
      }`}>
        <div className="font-semibold mb-2">
          {status.available ? 'Storage diagnostics' : 'Storage unavailable'}
        </div>
        {status.available ? (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs opacity-90">
            <dt className="font-medium">Storage available</dt>
            <dd>Yes</dd>
            <dt className="font-medium">Persistent storage</dt>
            <dd>
              {persistentStorage === null ? 'Checking...' : persistentStorage ? 'Granted' : 'Not granted'}
            </dd>
            <dt className="font-medium">Last saved</dt>
            <dd>{saveStatusLabel}</dd>
            <dt className="font-medium">Active profile ID</dt>
            <dd className="font-mono truncate">{profile?.id ?? '—'}</dd>
          </dl>
        ) : (
          <div className="text-xs mt-1 opacity-80">
            Private browsing or low storage may prevent saving. Export a backup before closing.
          </div>
        )}
      </div>

      {/* Profile */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm px-5" data-testid="profile-section">
        <div className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wide font-semibold pt-4 pb-2">Profile</div>
        {profile && pack && (
          <>
            {row('Active profile', `${pack.metadata.label}${profile.displayName ? ` · ${profile.displayName}` : ''} · target ${profile.targetLevel}`,
              <span className="text-xs text-slate-500 dark:text-slate-400">{profile.id.slice(0, 6)}…</span>
            )}
            {profiles.length > 1 && (
              <div className="py-3 border-b border-slate-100 dark:border-slate-700">
                <div className="text-xs text-slate-400 dark:text-slate-500 mb-2">Switch profile</div>
                <div className="flex flex-wrap gap-2">
                  {profiles.filter(p => p.id !== profile.id).map(p => {
                    const lp = getLanguagePack(p.targetLanguage);
                    return (
                      <button
                        key={p.id}
                        onClick={() => handleSwitch(p.id)}
                        className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-600 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
                      >
                        {p.displayName || 'Unnamed'} ({lp.metadata.label})
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="py-3 border-b border-slate-100 dark:border-slate-700">
              <button
                onClick={() => navigate('/onboarding')}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-600 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                + Create new profile
              </button>
              <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                Changing language creates a separate profile so your progress stays scoped.
              </div>
            </div>
          </>
        )}
      </div>

      {/* Appearance */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm px-5">
        <div className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wide font-semibold pt-4 pb-2">Appearance</div>
        {row('Theme', 'App color scheme',
          select<ThemeChoice>(settings.theme ?? 'system',
            [
              { value: 'system', label: 'System default' },
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ],
            v => update('theme', v),
          )
        )}
      </div>

      {/* Practice settings */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm px-5">
        <div className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wide font-semibold pt-4 pb-2">Practice</div>
        {row('Daily time target', 'Session duration for daily sprints',
          select(String(settings.dailyTime) as '5' | '10' | '20',
            [{ value: '5', label: '5 minutes' }, { value: '10', label: '10 minutes' }, { value: '20', label: '20 minutes' }],
            v => update('dailyTime', parseInt(v) as 5 | 10 | 20)
          )
        )}
        {row('Target level', 'Where you are aiming',
          select<CEFRLevel>(settings.targetLevel,
            [
              { value: 'A1', label: 'A1' }, { value: 'A2', label: 'A2' },
              { value: 'B1', label: 'B1' }, { value: 'B2', label: 'B2' },
              { value: 'C1', label: 'C1' },
            ],
            v => update('targetLevel', v),
          )
        )}
        {row('Include writing', 'How often the daily sprint asks for writing',
          select<WritingFrequency>(settings.writingFrequency,
            [
              { value: 'never', label: 'Never' },
              { value: 'sometimes', label: 'Sometimes (default)' },
              { value: 'often', label: 'Often' },
            ],
            v => update('writingFrequency', v),
          )
        )}
        {row('Show per-question timer', 'Display seconds spent on each item',
          <button
            onClick={() => update('showTimers', !settings.showTimers)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.showTimers ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-600'}`}
            aria-label="Toggle timers"
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.showTimers ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        )}
      </div>

      {/* Spanish-only accent settings */}
      {pack?.metadata.id === 'spanish' && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm px-5">
          <div className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wide font-semibold pt-4 pb-2">Spanish input</div>
          {row('Keyboard type', 'Affects default accent tolerance',
            select(settings.keyboardMode,
              [{ value: 'us', label: 'Standard US' }, { value: 'spanish', label: 'Spanish keyboard' }],
              v => update('keyboardMode', v),
            )
          )}
          {row('Accent mode', 'Lenient: accept answers without accents. Strict: require them.',
            select(settings.accentMode,
              [{ value: 'lenient', label: 'Lenient' }, { value: 'strict', label: 'Strict' }],
              v => update('accentMode', v),
            )
          )}
        </div>
      )}

      {/* Data */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm px-5">
        <div className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wide font-semibold pt-4 pb-2">Backup &amp; data</div>

        <div className="py-4 border-b border-slate-100 dark:border-slate-700">
          <div className="text-sm font-medium text-slate-800 dark:text-slate-100 mb-1">Export backup</div>
          <div className="text-xs text-slate-400 dark:text-slate-500 mb-3">All profiles and their data as one JSON file. Use this to move between devices.</div>
          <button
            onClick={downloadProgress}
            className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700"
          >
            Download backup JSON
          </button>
        </div>

        <div className="py-4 border-b border-slate-100 dark:border-slate-700">
          <div className="text-sm font-medium text-slate-800 dark:text-slate-100 mb-1">Import backup</div>
          <div className="text-xs text-slate-400 dark:text-slate-500 mb-3">Replaces all current app data with the imported snapshot.</div>
          <label className="inline-block px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-semibold hover:bg-slate-200 dark:hover:bg-slate-600 cursor-pointer">
            Choose JSON file
            <input type="file" accept=".json" onChange={handleImport} className="hidden" />
          </label>
          {importStatus === 'success' && (
            <div className="mt-2 text-xs text-emerald-600 dark:text-emerald-400">✓ Imported — refresh to see all changes.</div>
          )}
          {importStatus === 'error' && (
            <div className="mt-2 text-xs text-red-500 dark:text-red-400">{importError}</div>
          )}
        </div>

        <div className="py-4 border-b border-slate-100 dark:border-slate-700">
          <div className="text-sm font-medium text-amber-700 dark:text-amber-400 mb-1">Reset current profile</div>
          <div className="text-xs text-slate-400 dark:text-slate-500 mb-3">Wipes progress, mistakes, sessions and drafts for {profile?.displayName ?? 'this profile'} only.</div>
          <button
            onClick={handleResetProfile}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
              resetProfileConfirm
                ? 'bg-amber-600 text-white'
                : 'bg-amber-50 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/60'
            }`}
          >
            {resetProfileConfirm ? '⚠ Tap again to confirm' : 'Reset profile data'}
          </button>
        </div>

        <div className="py-4 border-b border-slate-100 dark:border-slate-700">
          <div className="text-sm font-medium text-red-700 dark:text-red-400 mb-1">Delete current profile</div>
          <div className="text-xs text-slate-400 dark:text-slate-500 mb-3">Removes the entire profile. If it is the only one, you will land back on onboarding.</div>
          <button
            onClick={handleDeleteProfile}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
              deleteProfileConfirm
                ? 'bg-red-600 text-white'
                : 'bg-red-50 dark:bg-red-900/40 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/60'
            }`}
          >
            {deleteProfileConfirm ? '⚠ Tap again to delete profile' : 'Delete this profile'}
          </button>
        </div>

        <div className="py-4">
          <div className="text-sm font-medium text-red-700 dark:text-red-400 mb-1">Reset all app data</div>
          <div className="text-xs text-slate-400 dark:text-slate-500 mb-3">Wipes every profile and every byte of local data. Cannot be undone.</div>
          <button
            onClick={handleResetAll}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
              resetAllConfirm
                ? 'bg-red-600 text-white'
                : 'bg-red-50 dark:bg-red-900/40 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/60'
            }`}
          >
            {resetAllConfirm ? '⚠ Tap again to wipe everything' : 'Reset all app data'}
          </button>
        </div>
      </div>

      {/* About */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm p-5">
        <div className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wide font-semibold mb-3">About</div>
        <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1.5">
          <p>Fluency Sprint — adaptive CEFR practice for Spanish and English.</p>
          <p>Level estimates are unofficial and are intended for self-study guidance only. They are not equivalent to certification from any examining body.</p>
          <p>Listening and speaking modules are planned and currently absent from level scoring.</p>
          <p>All progress lives in your browser. Export a backup before clearing browser data or switching devices.</p>
        </div>
      </div>
    </div>
  );
}
