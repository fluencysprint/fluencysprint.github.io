import { describe, it, expect } from 'vitest';
import type { Exercise } from '../../types';
import { englishCalibratedExercises2 } from '../../languages/english/calibrated2';
import { englishExercises2 } from '../../languages/english/exercises2';
import { spanishExtraExercises } from '../../languages/spanish/extra';

// ─── Audit helper ─────────────────────────────────────────────────────────────

const TIME_MARKERS = [
  'last night', 'yesterday', 'last week', 'this morning', 'this week',
  'recently', 'just', 'already', 'never', 'always', 'usually', 'often',
  'tomorrow', 'tonight', 'right now', 'at the moment', 'currently',
  'ayer', 'anoche', 'la semana pasada', 'últimamente', 'ahora', 'actualmente',
  'siempre', 'nunca', 'normalmente', 'mañana', 'esta mañana',
];

const CONFUSED_PATTERNS = [/wait\s*—/i, /let'?s reconsider/i];

const BE_VERB_SET = new Set(['is', 'are', 'was', 'were', 'been', 'be', 'am']);

export interface AuditIssue {
  type: 'duplicate_choices' | 'answer_not_in_choices' | 'empty_explanation' | 'confused_explanation' | 'tense_no_time_marker';
  message: string;
}

export function auditExerciseClarity(exercise: Exercise): AuditIssue[] {
  const issues: AuditIssue[] = [];

  if (exercise.choices && exercise.choices.length !== new Set(exercise.choices).size) {
    issues.push({ type: 'duplicate_choices', message: 'Choices contain duplicates.' });
  }

  if (exercise.type === 'multipleChoice' && exercise.choices && exercise.correctAnswer) {
    if (!exercise.choices.includes(exercise.correctAnswer)) {
      issues.push({ type: 'answer_not_in_choices', message: 'correctAnswer is not in choices.' });
    }
  }

  if (!exercise.explanation || exercise.explanation.trim() === '') {
    issues.push({ type: 'empty_explanation', message: 'Explanation is missing or empty.' });
  }

  for (const pat of CONFUSED_PATTERNS) {
    if (pat.test(exercise.explanation ?? '')) {
      issues.push({ type: 'confused_explanation', message: 'Explanation contains self-doubt markers.' });
      break;
    }
  }

  const isTenseWithBeVerb =
    (exercise.mistakeCategories?.includes('tense_aspect') ||
      exercise.mistakeCategories?.includes('tense_choice')) &&
    exercise.choices?.some(c => BE_VERB_SET.has(c.toLowerCase()));
  if (isTenseWithBeVerb) {
    const promptLower = (exercise.prompt ?? '').toLowerCase();
    const hasTimeMarker = TIME_MARKERS.some(m => promptLower.includes(m));
    if (!hasTimeMarker) {
      issues.push({ type: 'tense_no_time_marker', message: 'Be-verb tense question has no time marker.' });
    }
  }

  return issues;
}

// ─── Test 1: "My parents ____ at the concert." must not exist without a time marker ──

describe('test 1 — ambiguous concert item is gone', () => {
  it('no item has the prompt "My parents _____ at the concert." without a time marker', () => {
    const allEnglish = [...englishCalibratedExercises2, ...englishExercises2];
    const bare = allEnglish.find(e =>
      /my parents\s+_+\s+at the concert\.?$/i.test(e.prompt),
    );
    expect(bare).toBeUndefined();
  });
});

// ─── Test 2: Fixed item includes "last night" ─────────────────────────────────

describe('test 2 — en-a2-d16 has a time marker', () => {
  it('en-a2-d16 prompt includes "last night"', () => {
    const item = englishCalibratedExercises2.find(e => e.id === 'en-a2-d16');
    expect(item).toBeDefined();
    expect(item!.prompt.toLowerCase()).toContain('last night');
  });
});

// ─── Test 3: auditExerciseClarity flags duplicate choices ─────────────────────

describe('test 3 — auditExerciseClarity detects duplicate choices', () => {
  it('flags an item whose choices array contains a repeat', () => {
    const ex: Exercise = {
      id: 'test-dup', type: 'multipleChoice', skill: 'grammar', cefrLevel: 'A2',
      prompt: 'She ___ happy.',
      choices: ['was', 'were', 'was', 'been'],
      correctAnswer: 'was',
      explanation: 'Past tense.',
      mistakeCategories: [], tags: [], estimatedSeconds: 10, difficulty: 1,
      accentSensitive: false, keyboardHelp: false,
    };
    const issues = auditExerciseClarity(ex);
    expect(issues.some(i => i.type === 'duplicate_choices')).toBe(true);
  });
});

// ─── Test 4: auditExerciseClarity does NOT flag item with time marker ─────────

describe('test 4 — auditExerciseClarity clears tense items that have time markers', () => {
  it('does not flag a be-verb tense item when a time marker is present', () => {
    const ex: Exercise = {
      id: 'test-ok', type: 'multipleChoice', skill: 'grammar', cefrLevel: 'A2',
      prompt: 'She _____ at the concert last night.',
      choices: ['was', 'were', 'is', 'been'],
      correctAnswer: 'was',
      explanation: 'Past tense — last night confirms past context.',
      mistakeCategories: ['tense_aspect'], tags: [], estimatedSeconds: 10, difficulty: 1,
      accentSensitive: false, keyboardHelp: false,
    };
    const issues = auditExerciseClarity(ex);
    expect(issues.some(i => i.type === 'tense_no_time_marker')).toBe(false);
  });
});

// ─── Test 5: auditExerciseClarity flags missing correctAnswer in choices ──────

describe('test 5 — auditExerciseClarity detects answer not in choices', () => {
  it('flags multipleChoice when correctAnswer is absent from choices', () => {
    const ex: Exercise = {
      id: 'test-missing', type: 'multipleChoice', skill: 'grammar', cefrLevel: 'B1',
      prompt: 'He ___ to school yesterday.',
      choices: ['go', 'goes', 'gone', 'going'],
      correctAnswer: 'went',
      explanation: 'Past simple.',
      mistakeCategories: ['tense_aspect'], tags: [], estimatedSeconds: 10, difficulty: 2,
      accentSensitive: false, keyboardHelp: false,
    };
    const issues = auditExerciseClarity(ex);
    expect(issues.some(i => i.type === 'answer_not_in_choices')).toBe(true);
  });
});

// ─── Test 6: auditExerciseClarity flags empty explanation ────────────────────

describe('test 6 — auditExerciseClarity detects empty explanation', () => {
  it('flags an item with a blank explanation', () => {
    const ex: Exercise = {
      id: 'test-noexp', type: 'multipleChoice', skill: 'grammar', cefrLevel: 'A1',
      prompt: 'I _____ a student.',
      choices: ['am', 'is', 'are', 'be'],
      correctAnswer: 'am',
      explanation: '',
      mistakeCategories: [], tags: [], estimatedSeconds: 8, difficulty: 1,
      accentSensitive: false, keyboardHelp: false,
    };
    const issues = auditExerciseClarity(ex);
    expect(issues.some(i => i.type === 'empty_explanation')).toBe(true);
  });
});

// ─── Test 7: auditExerciseClarity flags confused explanation ─────────────────

describe('test 7 — auditExerciseClarity detects self-doubt in explanations', () => {
  it('flags "Wait —" in an explanation', () => {
    const ex: Exercise = {
      id: 'test-confused', type: 'multipleChoice', skill: 'grammar', cefrLevel: 'A2',
      prompt: 'If it ___ tomorrow, we stay inside.',
      choices: ['rains', 'will rain', 'rained', 'rain'],
      correctAnswer: 'rains',
      explanation: 'Present simple in if-clause. Wait — actually this might also be subjunctive.',
      mistakeCategories: ['tense_aspect'], tags: [], estimatedSeconds: 20, difficulty: 2,
      accentSensitive: false, keyboardHelp: false,
    };
    const issues = auditExerciseClarity(ex);
    expect(issues.some(i => i.type === 'confused_explanation')).toBe(true);
  });
});

// ─── Test 8: en-a2-33 explanation is clean ───────────────────────────────────

describe('test 8 — en-a2-33 has a clean explanation', () => {
  it('en-a2-33 explanation contains no self-doubt markers', () => {
    const item = englishExercises2.find(e => e.id === 'en-a2-33');
    expect(item).toBeDefined();
    expect(item!.explanation).not.toMatch(/wait\s*—/i);
    expect(item!.explanation).not.toMatch(/let'?s reconsider/i);
  });
});

// ─── Test 9: es-a2-44 has no duplicate choices ───────────────────────────────

describe('test 9 — es-a2-44 choices are unique', () => {
  it('es-a2-44 choices array has no duplicates', () => {
    const item = spanishExtraExercises.find(e => e.id === 'es-a2-44');
    expect(item).toBeDefined();
    expect(item!.choices!.length).toBe(new Set(item!.choices!).size);
  });
});

// ─── Test 10: All multipleChoice items in audited files have no duplicate choices ──

describe('test 10 — no multipleChoice item has duplicate choices', () => {
  it('all items across English calibrated2, exercises2, and Spanish extra pass duplicate check', () => {
    const allItems = [
      ...englishCalibratedExercises2,
      ...englishExercises2,
      ...spanishExtraExercises,
    ].filter(e => e.type === 'multipleChoice');

    const withDups = allItems.filter(e => {
      const c = e.choices ?? [];
      return c.length !== new Set(c).size;
    });

    expect(withDups.map(e => e.id)).toEqual([]);
  });
});
