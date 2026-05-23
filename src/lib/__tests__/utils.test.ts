import { describe, it, expect } from 'vitest';
import { checkAnswer, normalizeSpanish, percentOf, clamp } from '../utils';

describe('checkAnswer — lenient accent mode', () => {
  it('accepts exact matches', () => {
    expect(checkAnswer('habló', 'habló', undefined, 'lenient')).toEqual({
      correct: true,
      accentMissing: false,
    });
  });

  it('accepts missing accents but flags them', () => {
    expect(checkAnswer('hablo', 'habló', undefined, 'lenient')).toEqual({
      correct: true,
      accentMissing: true,
    });
  });

  it('accepts acceptable answers', () => {
    expect(checkAnswer('estoy bien', 'me encuentro bien', ['estoy bien'], 'lenient')).toEqual({
      correct: true,
      accentMissing: false,
    });
  });

  it('rejects truly wrong answers', () => {
    expect(checkAnswer('vienes', 'vengas', undefined, 'lenient')).toEqual({
      correct: false,
      accentMissing: false,
    });
  });

  it('is case-insensitive', () => {
    expect(checkAnswer('VENGAS', 'vengas', undefined, 'lenient').correct).toBe(true);
  });
});

describe('checkAnswer — strict accent mode', () => {
  it('rejects missing accents in strict mode', () => {
    expect(checkAnswer('hablo', 'habló', undefined, 'strict')).toEqual({
      correct: false,
      accentMissing: false,
    });
  });

  it('still accepts exact matches', () => {
    expect(checkAnswer('habló', 'habló', undefined, 'strict').correct).toBe(true);
  });
});

describe('normalizeSpanish', () => {
  it('strips accents and lowercases', () => {
    expect(normalizeSpanish('Habló')).toBe('hablo');
    expect(normalizeSpanish('está')).toBe('esta');
    expect(normalizeSpanish('PÚBLICO')).toBe('publico');
  });

  it('strips Spanish punctuation', () => {
    expect(normalizeSpanish('¿Qué tal?')).toBe('que tal?');
  });
});

describe('percentOf', () => {
  it('handles normal ratios', () => {
    expect(percentOf(1, 4)).toBe(25);
    expect(percentOf(3, 4)).toBe(75);
  });

  it('returns 0 when total is 0', () => {
    expect(percentOf(0, 0)).toBe(0);
  });
});

describe('clamp', () => {
  it('clamps within range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(15, 0, 10)).toBe(10);
  });
});
