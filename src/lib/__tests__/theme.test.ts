import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { applyTheme, setTheme, currentIsDark, onThemeChange, initTheme } from '../theme';
import { resetAllAppData, createProfile } from '../profile';
import { refreshActiveProfileCache } from '../storage';

function setup() {
  resetAllAppData();
  refreshActiveProfileCache();
  createProfile({
    targetLanguage: 'spanish',
    selfEstimatedLevel: 'beginner',
    targetLevel: 'B1',
    dailyTime: 10,
  });
  refreshActiveProfileCache();
}

beforeEach(() => {
  // Reset html class
  document.documentElement.className = '';
});

afterEach(() => {
  document.documentElement.className = '';
  vi.restoreAllMocks();
});

describe('applyTheme', () => {
  it('adds dark class for "dark" choice', () => {
    applyTheme('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('removes dark class for "light" choice', () => {
    document.documentElement.classList.add('dark');
    applyTheme('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('follows system preference for "system" choice when system is dark', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
    });
    applyTheme('system');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('follows system preference for "system" choice when system is light', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
    });
    applyTheme('system');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('notifies listeners when theme changes', () => {
    const cb = vi.fn();
    const unsub = onThemeChange(cb);
    applyTheme('dark');
    expect(cb).toHaveBeenCalledWith(true);
    applyTheme('light');
    expect(cb).toHaveBeenCalledWith(false);
    unsub();
  });

  it('unsubscribe stops notifications', () => {
    const cb = vi.fn();
    const unsub = onThemeChange(cb);
    unsub();
    applyTheme('dark');
    expect(cb).not.toHaveBeenCalled();
  });
});

describe('setTheme + currentIsDark', () => {
  it('persists dark theme and reports currentIsDark correctly', () => {
    setup();
    setTheme('dark');
    expect(currentIsDark()).toBe(true);
  });

  it('persists light theme', () => {
    setup();
    setTheme('light');
    expect(currentIsDark()).toBe(false);
  });

  it('persists and applies dark class to DOM', () => {
    setup();
    setTheme('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });
});

describe('initTheme', () => {
  it('applies dark when stored theme is "dark"', () => {
    setup();
    setTheme('dark');
    document.documentElement.className = '';
    initTheme();
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('applies light when stored theme is "light"', () => {
    setup();
    setTheme('light');
    document.documentElement.className = '';
    initTheme();
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('falls back gracefully when no profile exists', () => {
    resetAllAppData();
    refreshActiveProfileCache();
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
    });
    expect(() => initTheme()).not.toThrow();
  });
});
