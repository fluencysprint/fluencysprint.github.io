import { describe, it, expect } from 'vitest';
import { getLanguagePack, getAllLanguageMetadata, isLanguageId } from '../index';
import { CEFR_ORDER } from '../../types';

describe('language packs', () => {
  it('Spanish pack loads with all five CEFR levels represented', () => {
    const pack = getLanguagePack('spanish');
    expect(pack.metadata.id).toBe('spanish');
    expect(pack.metadata.keyboardHelpers).toBe(true);
    expect(pack.metadata.accentSensitive).toBe(true);
    for (const level of CEFR_ORDER) {
      const count = pack.exercises.filter(e => e.cefrLevel === level).length;
      expect(count, `Spanish ${level} count`).toBeGreaterThan(0);
    }
  });

  it('English pack loads with all five CEFR levels and no Spanish keyboard helpers', () => {
    const pack = getLanguagePack('english');
    expect(pack.metadata.id).toBe('english');
    expect(pack.metadata.keyboardHelpers).toBe(false);
    expect(pack.metadata.accentSensitive).toBe(false);
    for (const level of CEFR_ORDER) {
      const count = pack.exercises.filter(e => e.cefrLevel === level).length;
      expect(count, `English ${level} count`).toBeGreaterThan(0);
    }
  });

  it('A1/A2 content meets the MVP minimum (≥20 items each per language)', () => {
    for (const lang of ['spanish', 'english'] as const) {
      const pack = getLanguagePack(lang);
      const a1 = pack.exercises.filter(e => e.cefrLevel === 'A1').length;
      const a2 = pack.exercises.filter(e => e.cefrLevel === 'A2').length;
      expect(a1, `${lang} A1`).toBeGreaterThanOrEqual(20);
      expect(a2, `${lang} A2`).toBeGreaterThanOrEqual(20);
    }
  });

  it('reading texts span A1 + A2 + at least one B-level item', () => {
    for (const lang of ['spanish', 'english'] as const) {
      const pack = getLanguagePack(lang);
      expect(pack.readingTexts.filter(t => t.cefrLevel === 'A1').length).toBeGreaterThanOrEqual(3);
      expect(pack.readingTexts.filter(t => t.cefrLevel === 'A2').length).toBeGreaterThanOrEqual(3);
      expect(pack.readingTexts.filter(t => t.cefrLevel === 'B1' || t.cefrLevel === 'B2' || t.cefrLevel === 'C1').length).toBeGreaterThanOrEqual(1);
    }
  });

  it('writing prompts span A1 through C1 for both packs', () => {
    for (const lang of ['spanish', 'english'] as const) {
      const pack = getLanguagePack(lang);
      const levels = new Set(pack.writingPrompts.map(p => p.cefrLevel));
      // We require at least A1, A2, B1, B2 coverage
      for (const lvl of ['A1', 'A2', 'B1', 'B2'] as const) {
        expect(levels.has(lvl), `${lang} missing writing at ${lvl}`).toBe(true);
      }
    }
  });

  it('getAllLanguageMetadata returns both packs', () => {
    const all = getAllLanguageMetadata();
    expect(all.map(m => m.id).sort()).toEqual(['english', 'spanish']);
  });

  it('isLanguageId narrows', () => {
    expect(isLanguageId('spanish')).toBe(true);
    expect(isLanguageId('french')).toBe(false);
    expect(isLanguageId(42)).toBe(false);
  });
});
