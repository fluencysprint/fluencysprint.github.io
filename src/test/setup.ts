import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { resetAllAppData, createProfile } from '../lib/profile';
import { refreshActiveProfileCache } from '../lib/storage';

beforeEach(() => {
  // Each test starts with a clean storage and a single guest profile so that
  // profile-scoped storage helpers (saveDraft, addWritingEntry, etc.) work.
  resetAllAppData();
  refreshActiveProfileCache();
  createProfile({
    displayName: 'Test',
    targetLanguage: 'spanish',
    selfEstimatedLevel: 'B1',
    targetLevel: 'C1',
    dailyTime: 10,
  });
  refreshActiveProfileCache();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});
