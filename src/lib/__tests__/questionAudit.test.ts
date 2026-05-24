import { describe, it, expect } from 'vitest';
import type { Exercise } from '../../types';
import { auditExercise, auditExerciseBank } from '../questionAudit';
import { englishExercises2 } from '../../languages/english/exercises2';
import { englishCalibratedExercises2 } from '../../languages/english/calibrated2';
import { spanishExtraExercises } from '../../languages/spanish/extra';
import { spanishA1Exercises, spanishA2Exercises } from '../../languages/spanish/a1a2';
import { spanishCalibratedExercises } from '../../languages/spanish/calibrated';
import { spanishCalibratedExercises2 } from '../../languages/spanish/calibrated2';
import { englishExercises } from '../../languages/english/exercises';
import { englishCalibratedExercises } from '../../languages/english/calibrated';

function makeEx(overrides: Partial<Exercise>): Exercise {
  return {
    id: 'test-item',
    type: 'multipleChoice',
    skill: 'grammar',
    cefrLevel: 'B1',
    prompt: 'She ___ at work.',
    choices: ['is', 'are', 'am', 'be'],
    correctAnswer: 'is',
    explanation: 'Third-person singular present.',
    mistakeCategories: [],
    tags: [],
    estimatedSeconds: 15,
    difficulty: 1,
    accentSensitive: false,
    keyboardHelp: false,
    ...overrides,
  };
}

// ─── Test 1: The committee item is fixed ──────────────────────────────────────

describe('test 1 — committee item no longer contains double "yet"', () => {
  it('en-c1-12 correct answer does not produce "yet … yet"', () => {
    const item = englishExercises2.find(e => e.id === 'en-c1-12');
    expect(item).toBeDefined();
    const full = item!.prompt.replace(/_{2,}/, item!.correctAnswer!);
    const yetCount = (full.toLowerCase().match(/\byet\b/g) ?? []).length;
    expect(yetCount).toBeLessThan(2);
  });
});

// ─── Test 2: No English item produces "yet … yet" ────────────────────────────

describe('test 2 — no English item creates "yet … yet"', () => {
  it('inserting the correct answer into any English item does not repeat "yet"', () => {
    const allEnglish = [
      ...englishExercises,
      ...englishExercises2,
      ...englishCalibratedExercises,
      ...englishCalibratedExercises2,
    ].filter(e => e.correctAnswer && /_{2,}/.test(e.prompt ?? ''));

    const offenders = allEnglish.filter(e => {
      const full = (e.prompt ?? '').replace(/_{2,}/, e.correctAnswer!);
      return (full.toLowerCase().match(/\byet\b/g) ?? []).length >= 2;
    });
    expect(offenders.map(e => e.id)).toEqual([]);
  });
});

// ─── Test 3: No item creates duplicated temporal markers ─────────────────────

describe('test 3 — no item creates duplicated temporal markers on correct answer', () => {
  it('inserting the correct answer never repeats: yet, already, never, ago, recently', () => {
    const MARKERS = ['yet', 'already', 'never', 'ago', 'recently'];
    const allItems = [
      ...englishExercises, ...englishExercises2,
      ...englishCalibratedExercises, ...englishCalibratedExercises2,
      ...spanishExtraExercises, ...spanishA1Exercises, ...spanishA2Exercises,
      ...spanishCalibratedExercises, ...spanishCalibratedExercises2,
    ].filter(e => e.correctAnswer && /_{2,}/.test(e.prompt ?? '') && !/\([^)]+\/[^)]+\)/.test(e.prompt ?? ''));

    const offenders: string[] = [];
    for (const e of allItems) {
      const full = (e.prompt ?? '').replace(/_{2,}/, e.correctAnswer!).toLowerCase();
      for (const m of MARKERS) {
        const re = new RegExp(`\\b${m}\\b`, 'g');
        if ((full.match(re) ?? []).length >= 2) {
          offenders.push(`${e.id}: "${full}"`);
          break;
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});

// ─── Test 4: Correct answer must not duplicate a word immediately after blank ─

describe('test 4 — correct answer does not repeat temporal marker present after blank', () => {
  it('auditExercise flags a "yet" repeated when correct answer is inserted', () => {
    const ex = makeEx({
      id: 'dup-test',
      prompt: 'The board ___ a vote yet.',
      choices: ['has yet to take', 'has not taken', 'took', 'will take'],
      correctAnswer: 'has yet to take',
      explanation: 'Formal: "has yet to + verb".',
    });
    const issues = auditExercise(ex);
    expect(issues.some(i => i.type === 'duplicate_temporal_marker')).toBe(true);
  });
});

// ─── Test 5: Tense items with clear context do not flag ambiguous_tense_context ─

describe('test 5 — tense items with time context do not flag as ambiguous', () => {
  it('a be-verb tense item with "when the bell rang" in prompt is not flagged', () => {
    const ex = makeEx({
      id: 'tense-ok',
      prompt: 'When the bell rang, neither the teacher nor the students ___ ready.',
      choices: ['were', 'was', 'are', 'is'],
      correctAnswer: 'were',
      explanation: 'Past context. "students" (plural) → were.',
      mistakeCategories: ['tense_aspect'],
    });
    const issues = auditExercise(ex);
    expect(issues.some(i => i.type === 'ambiguous_tense_context')).toBe(false);
  });
});

// ─── Test 6: correctAnswer must be in choices ─────────────────────────────────

describe('test 6 — auditExercise flags when correctAnswer is missing from choices', () => {
  it('returns answer_not_in_choices error', () => {
    const ex = makeEx({ correctAnswer: 'was', choices: ['is', 'are', 'am', 'be'] });
    const issues = auditExercise(ex);
    expect(issues.some(i => i.type === 'answer_not_in_choices')).toBe(true);
  });
});

// ─── Test 7: Duplicate choices are flagged ───────────────────────────────────

describe('test 7 — auditExercise flags duplicate choices', () => {
  it('returns duplicate_choices error when choices repeat', () => {
    const ex = makeEx({ choices: ['is', 'is', 'are', 'am'], correctAnswer: 'is' });
    const issues = auditExercise(ex);
    expect(issues.some(i => i.type === 'duplicate_choices')).toBe(true);
  });
});

// ─── Test 8: Empty explanation is flagged ────────────────────────────────────

describe('test 8 — auditExercise flags empty explanation', () => {
  it('returns empty_explanation error for blank explanation', () => {
    const ex = makeEx({ explanation: '' });
    const issues = auditExercise(ex);
    expect(issues.some(i => i.type === 'empty_explanation')).toBe(true);
  });
});

// ─── Test 9: English audit passes on all objective items ─────────────────────

describe('test 9 — English exercise bank passes audit with no errors', () => {
  it('no English objective item has an error-level audit issue', () => {
    const allEnglish = [
      ...englishExercises, ...englishExercises2,
      ...englishCalibratedExercises, ...englishCalibratedExercises2,
    ];
    const errors = auditExerciseBank(allEnglish).filter(r => r.severity === 'error');
    expect(errors.map(r => `${r.id}: ${r.type} — ${r.message}`)).toEqual([]);
  });
});

// ─── Test 10: Spanish audit passes on all objective items ─────────────────────

describe('test 10 — Spanish exercise bank passes audit with no errors', () => {
  it('no Spanish objective item has an error-level audit issue', () => {
    const allSpanish = [
      ...spanishA1Exercises, ...spanishA2Exercises, ...spanishExtraExercises,
      ...spanishCalibratedExercises, ...spanishCalibratedExercises2,
    ];
    const errors = auditExerciseBank(allSpanish).filter(r => r.severity === 'error');
    expect(errors.map(r => `${r.id}: ${r.type} — ${r.message}`)).toEqual([]);
  });
});

// ─── Test 11: en-b1-39 has time context and no ambiguous_tense_context warning ─

describe('test 11 — en-b1-39 neither/nor item has past context', () => {
  it('en-b1-39 prompt contains a past-tense context clause', () => {
    const item = englishExercises2.find(e => e.id === 'en-b1-39');
    expect(item).toBeDefined();
    const prompt = item!.prompt.toLowerCase();
    // Should contain a past-tense context clause
    const hasPastContext = /when the bell|when \w+ \w+ed|when \w+ happened|when \w+ rang/.test(prompt);
    expect(hasPastContext).toBe(true);
  });
});

// ─── Test 12: auditExercise does not flag reading/writing types ───────────────

describe('test 12 — non-objective types are ignored by audit', () => {
  it('readingText and writingPrompt items return no audit results', () => {
    const rt = makeEx({ type: 'readingText' as Exercise['type'], explanation: '' });
    const wp = makeEx({ type: 'writingPrompt' as Exercise['type'], explanation: '' });
    expect(auditExercise(rt)).toEqual([]);
    expect(auditExercise(wp)).toEqual([]);
  });
});

// ─── Test 13: Bad Spanish superlative prompt is gone ─────────────────────────

describe('test 13 — broken Spanish superlative item is fixed', () => {
  it('no item has the bad prompt with "Éste" or "el más" before a noun', () => {
    const allSpanish = [
      ...spanishA1Exercises, ...spanishA2Exercises, ...spanishExtraExercises,
      ...spanishCalibratedExercises, ...spanishCalibratedExercises2,
    ];
    const badPrompt = allSpanish.find(e =>
      /[ÉéEe]ste es _+\s*plato|el más plato/i.test(
        (e.prompt ?? '').replace(/_{2,}/, e.correctAnswer ?? ''),
      )
    );
    expect(badPrompt).toBeUndefined();
  });
});

// ─── Test 14: No Spanish item accepts "el más" followed by a noun ─────────────

describe('test 14 — no Spanish item creates "article + más + noun + adjective" order', () => {
  it('inserting the correct answer never produces the wrong superlative order', () => {
    const allSpanish = [
      ...spanishA1Exercises, ...spanishA2Exercises, ...spanishExtraExercises,
      ...spanishCalibratedExercises, ...spanishCalibratedExercises2,
    ].filter(e => e.correctAnswer && /_{2,}/.test(e.prompt ?? ''));

    const offenders = allSpanish.filter(e => {
      const full = (e.prompt ?? '').replace(/_{2,}/, e.correctAnswer!).toLowerCase();
      return /\b(el|la|los|las)\s+más\s+[a-záéíóúüñ]+\s+[a-záéíóúüñ]+\s+(del|de la|de los|de las)\b/.test(full);
    });
    expect(offenders.map(e => e.id)).toEqual([]);
  });
});

// ─── Test 15: Spanish superlative items produce valid completed sentences ─────

describe('test 15 — Spanish superlative items pass the new audit check', () => {
  it('no Spanish item flagged for spanish_superlative_order error', () => {
    const allSpanish = [
      ...spanishA1Exercises, ...spanishA2Exercises, ...spanishExtraExercises,
      ...spanishCalibratedExercises, ...spanishCalibratedExercises2,
    ];
    const errors = auditExerciseBank(allSpanish).filter(
      r => r.severity === 'error' && r.type === 'spanish_superlative_order',
    );
    expect(errors.map(r => `${r.id}: ${r.message}`)).toEqual([]);
  });
});

// ─── Test 16: auditExercise flags wrong superlative order ─────────────────────

describe('test 16 — auditExercise detects wrong Spanish superlative word order', () => {
  it('flags "el más plato delicioso del restaurante" as spanish_superlative_order error', () => {
    const ex = makeEx({
      id: 'bad-superlative',
      prompt: 'Éste es _____ plato delicioso del restaurante.',
      choices: ['el más', 'muy', 'el mucho', 'lo más'],
      correctAnswer: 'el más',
      explanation: 'Superlativo relativo.',
    });
    const issues = auditExercise(ex);
    expect(issues.some(i => i.type === 'spanish_superlative_order')).toBe(true);
  });

  it('does not flag correct superlative order "el plato más delicioso del restaurante"', () => {
    const ex = makeEx({
      id: 'good-superlative',
      prompt: 'Este es el plato _____ delicioso del restaurante.',
      choices: ['más', 'muy', 'mucho', 'tan'],
      correctAnswer: 'más',
      explanation: 'With a noun phrase, Spanish places más before the adjective.',
    });
    const issues = auditExercise(ex);
    expect(issues.some(i => i.type === 'spanish_superlative_order')).toBe(false);
  });
});

// ─── Test 17: Every examEligible item has a non-empty explanation ─────────────

describe('test 17 — every examEligible item has a non-empty explanation', () => {
  it('all items explicitly marked examEligible: true have an explanation', () => {
    const allItems = [
      ...spanishA1Exercises, ...spanishA2Exercises, ...spanishExtraExercises,
      ...spanishCalibratedExercises, ...spanishCalibratedExercises2,
      ...englishExercises, ...englishExercises2,
      ...englishCalibratedExercises, ...englishCalibratedExercises2,
    ].filter(e => e.examEligible === true);

    const missing = allItems.filter(e => !e.explanation || e.explanation.trim() === '');
    expect(missing.map(e => e.id)).toEqual([]);
  });
});

// ─── Test 18: Multiple-choice shuffle still works after item fix ───────────────

describe('test 18 — es-a2-d25 new choices are valid for shuffling', () => {
  it('fixed item has 4 unique choices with the correct answer present', () => {
    const item = spanishCalibratedExercises2.find(e => e.id === 'es-a2-d25');
    expect(item).toBeDefined();
    expect(item!.choices).toHaveLength(4);
    expect(new Set(item!.choices!).size).toBe(4);
    expect(item!.choices!).toContain(item!.correctAnswer);
  });
});
