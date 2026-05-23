import { describe, it, expect } from 'vitest';
import { getLanguagePack } from '../index';
import { spanishCalibratedExercises } from '../spanish/calibrated';
import { englishCalibratedExercises } from '../english/calibrated';
import type { CEFRLevel } from '../../types';

const english = getLanguagePack('english');
const spanish = getLanguagePack('spanish');

describe('content bank — language tagging & ids', () => {
  it('every English item is tagged languageId english (test 21)', () => {
    expect(english.exercises.every(e => e.languageId === 'english')).toBe(true);
  });

  it('every Spanish item is tagged languageId spanish (test 22)', () => {
    expect(spanish.exercises.every(e => e.languageId === 'spanish')).toBe(true);
  });

  it('every English exercise id starts with en- (test 23)', () => {
    const bad = english.exercises.filter(e => !e.id.startsWith('en-'));
    expect(bad.map(e => e.id)).toEqual([]);
  });

  it('every calibrated Spanish item id starts with es- and the pack has no en- ids (test 24)', () => {
    expect(spanishCalibratedExercises.every(e => e.id.startsWith('es-'))).toBe(true);
    expect(englishCalibratedExercises.every(e => e.id.startsWith('en-'))).toBe(true);
    expect(spanish.exercises.some(e => e.id.startsWith('en-'))).toBe(false);
  });
});

describe('content bank — cross-language separation', () => {
  it('no Spanish-only punctuation/letters appear in English content (test 25)', () => {
    const offenders = english.exercises.filter(e => {
      const text = [e.prompt, e.explanation, ...(e.choices ?? [])].join(' ');
      return /[¿¡ñ]/.test(text);
    });
    expect(offenders.map(e => e.id)).toEqual([]);
  });

  it('no English-prefixed items leak into the Spanish pack (test 26)', () => {
    expect(spanish.exercises.some(e => e.id.startsWith('en-'))).toBe(false);
    // Spanish content genuinely contains Spanish-language markers somewhere.
    const spanishMarkers = spanish.exercises.filter(e => /[áéíóúñ¿¡]/.test(`${e.prompt} ${e.explanation}`)).length;
    expect(spanishMarkers).toBeGreaterThan(20);
  });
});

describe('content bank — calibration metadata', () => {
  for (const [name, pack] of [['english', english], ['spanish', spanish]] as const) {
    it(`every ${name} item has an itemFamilyId (test 27)`, () => {
      expect(pack.exercises.every(e => typeof e.itemFamilyId === 'string' && e.itemFamilyId.length > 0)).toBe(true);
    });

    it(`every ${name} item has a construct (test 28)`, () => {
      expect(pack.exercises.every(e => typeof e.construct === 'string' && e.construct!.length > 0)).toBe(true);
    });

    it(`every exam-eligible ${name} item has an explanation (test 29)`, () => {
      const bad = pack.exercises.filter(e => e.examEligible && (!e.explanation || e.explanation.trim().length === 0));
      expect(bad.map(e => e.id)).toEqual([]);
    });
  }
});

describe('content bank — integrity & coverage', () => {
  it('has no duplicate ids within or across packs (test 30)', () => {
    const enIds = english.exercises.map(e => e.id);
    const esIds = spanish.exercises.map(e => e.id);
    expect(new Set(enIds).size).toBe(enIds.length);
    expect(new Set(esIds).size).toBe(esIds.length);
    const overlap = enIds.filter(id => esIds.includes(id));
    expect(overlap).toEqual([]);
  });

  it('meets per-language, per-level minimums (test 31)', () => {
    const minimums: Record<'english' | 'spanish', Record<CEFRLevel, number>> = {
      english: { A1: 45, A2: 45, B1: 40, B2: 30, C1: 20 },
      spanish: { A1: 45, A2: 45, B1: 25, B2: 15, C1: 10 },
    };
    for (const [name, pack, prefix] of [['english', english, 'en-'], ['spanish', spanish, 'es-']] as const) {
      for (const level of ['A1', 'A2', 'B1', 'B2', 'C1'] as CEFRLevel[]) {
        const count = pack.exercises.filter(e => e.cefrLevel === level && e.id.startsWith(prefix)).length;
        expect(count, `${name} ${level} (${count})`).toBeGreaterThanOrEqual(minimums[name as 'english' | 'spanish'][level]);
      }
    }
  });

  it('provides reading texts and writing prompts across levels', () => {
    expect(english.readingTexts.length).toBeGreaterThanOrEqual(10);
    expect(spanish.readingTexts.length).toBeGreaterThanOrEqual(10);
    expect(english.writingPrompts.length).toBeGreaterThanOrEqual(10);
    expect(spanish.writingPrompts.length).toBeGreaterThanOrEqual(10);
  });
});
