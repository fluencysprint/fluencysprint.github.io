import { getSettings, updateSettings } from './storage';

export type ThemeChoice = 'light' | 'dark' | 'system';

type ThemeListener = (isDark: boolean) => void;
const listeners = new Set<ThemeListener>();
let _mq: MediaQueryList | null = null;

function isSystemDark(): boolean {
  return typeof window !== 'undefined' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function computeIsDark(theme: ThemeChoice): boolean {
  if (theme === 'dark') return true;
  if (theme === 'light') return false;
  return isSystemDark();
}

function applyToDom(isDark: boolean): void {
  document.documentElement.classList.toggle('dark', isDark);
}

function broadcast(isDark: boolean): void {
  for (const l of listeners) l(isDark);
}

function onSystemChange(e: MediaQueryListEvent): void {
  applyToDom(e.matches);
  broadcast(e.matches);
}

function teardownMq(): void {
  if (_mq) {
    _mq.removeEventListener('change', onSystemChange);
    _mq = null;
  }
}

export function applyTheme(theme: ThemeChoice): void {
  const isDark = computeIsDark(theme);
  applyToDom(isDark);
  broadcast(isDark);
  if (theme === 'system') {
    if (!_mq) {
      _mq = window.matchMedia('(prefers-color-scheme: dark)');
      _mq.addEventListener('change', onSystemChange);
    }
  } else {
    teardownMq();
  }
}

/** Call once on app mount. Reads persisted setting (or falls back to system). */
export function initTheme(): void {
  try {
    applyTheme(getSettings().theme ?? 'system');
  } catch {
    applyToDom(isSystemDark());
    if (!_mq) {
      _mq = window.matchMedia('(prefers-color-scheme: dark)');
      _mq.addEventListener('change', onSystemChange);
    }
  }
}

/** Persist and apply a new theme choice. */
export function setTheme(theme: ThemeChoice): void {
  try {
    updateSettings({ theme });
  } catch { /* ignore pre-profile state */ }
  applyTheme(theme);
}

/** Subscribe to dark-mode toggle changes. Returns unsubscribe fn. */
export function onThemeChange(cb: ThemeListener): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function currentIsDark(): boolean {
  try {
    return computeIsDark(getSettings().theme ?? 'system');
  } catch {
    return isSystemDark();
  }
}
