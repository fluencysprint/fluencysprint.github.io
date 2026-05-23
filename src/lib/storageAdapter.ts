/**
 * Minimal storage adapter wrapping localStorage with:
 *  - availability detection (e.g. Safari Private Mode)
 *  - safe JSON encode/decode with fallbacks
 *  - explicit save status callbacks for the UI
 *
 * We intentionally do NOT use IndexedDB as the primary store because the rest
 * of the app expects synchronous reads. localStorage is reliable on every
 * modern browser when combined with aggressive flushing on visibilitychange
 * and pagehide (see initPersistenceLifecycle). Export/import remains the
 * canonical way to move profiles across devices.
 */

let _available: boolean | null = null;
const _saveListeners = new Set<(status: SaveStatus) => void>();

export type SaveStatus =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'saved'; at: string }
  | { kind: 'error'; message: string };

let _lastStatus: SaveStatus = { kind: 'idle' };

export function getLastSaveStatus(): SaveStatus {
  return _lastStatus;
}

export function onSaveStatus(cb: (status: SaveStatus) => void): () => void {
  _saveListeners.add(cb);
  cb(_lastStatus);
  return () => _saveListeners.delete(cb);
}

function emit(status: SaveStatus): void {
  _lastStatus = status;
  for (const cb of _saveListeners) {
    try { cb(status); } catch { /* ignore listener errors */ }
  }
}

export function isStorageAvailable(): boolean {
  if (_available !== null) return _available;
  try {
    const probe = '__fluencyProbe__' + Math.random();
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    _available = true;
  } catch {
    _available = false;
  }
  return _available;
}

export function readJSON<T>(key: string, fallback: T): T {
  if (!isStorageAvailable()) return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJSON<T>(key: string, value: T): boolean {
  if (!isStorageAvailable()) {
    emit({ kind: 'error', message: 'Storage unavailable' });
    return false;
  }
  emit({ kind: 'saving' });
  try {
    localStorage.setItem(key, JSON.stringify(value));
    emit({ kind: 'saved', at: new Date().toISOString() });
    return true;
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Storage write failed';
    // QuotaExceededError or similar
    console.warn('Storage write failed:', e);
    emit({ kind: 'error', message });
    return false;
  }
}

export function removeKey(key: string): void {
  if (!isStorageAvailable()) return;
  try { localStorage.removeItem(key); } catch { /* ignore */ }
}

export function listKeysWithPrefix(prefix: string): string[] {
  if (!isStorageAvailable()) return [];
  const out: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix)) out.push(k);
    }
  } catch { /* ignore */ }
  return out;
}

// ─── Lifecycle: aggressive flush on tab hide / page unload ─────────────────

type FlushFn = () => void;
const _flushHandlers = new Set<FlushFn>();
let _lifecycleInited = false;

export function registerFlushHandler(fn: FlushFn): () => void {
  _flushHandlers.add(fn);
  return () => _flushHandlers.delete(fn);
}

export function flushAll(): void {
  for (const fn of _flushHandlers) {
    try { fn(); } catch (e) { console.warn('flush handler failed:', e); }
  }
}

export function initPersistenceLifecycle(): void {
  if (_lifecycleInited || typeof document === 'undefined') return;
  _lifecycleInited = true;

  const onVisibility = () => {
    if (document.visibilityState === 'hidden') flushAll();
  };
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', flushAll);
  window.addEventListener('beforeunload', flushAll);
  // Periodic safety flush, e.g. for very long idle sessions on phones.
  setInterval(flushAll, 20_000);
}

export function getStorageDiagnostics(): {
  available: boolean;
  approxUsageBytes: number;
  lastStatus: SaveStatus;
} {
  if (!isStorageAvailable()) {
    return { available: false, approxUsageBytes: 0, lastStatus: _lastStatus };
  }
  let bytes = 0;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      const v = localStorage.getItem(k) ?? '';
      bytes += (k.length + v.length) * 2; // UTF-16 approx
    }
  } catch { /* ignore */ }
  return { available: true, approxUsageBytes: bytes, lastStatus: _lastStatus };
}
