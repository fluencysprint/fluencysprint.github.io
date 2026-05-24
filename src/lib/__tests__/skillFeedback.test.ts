import { describe, it, expect } from 'vitest';
import { MISTAKE_LABELS } from '../../types';
import type { MistakeCategory } from '../../types';

// Tests for Skill Map UX: labels must be human-readable, never raw snake_case.

describe('MISTAKE_LABELS — no snake_case in UI labels', () => {
  it('every label value contains no underscores (test S1)', () => {
    const allLabels = Object.values(MISTAKE_LABELS);
    const snakeCased = allLabels.filter(l => l.includes('_'));
    expect(snakeCased).toEqual([]);
  });

  it('every label is a non-empty string (test S2)', () => {
    const allLabels = Object.values(MISTAKE_LABELS);
    const empty = allLabels.filter(l => typeof l !== 'string' || l.trim().length === 0);
    expect(empty).toEqual([]);
  });

  it('every MistakeCategory key maps to a label (test S3)', () => {
    const sampleKeys: MistakeCategory[] = [
      'tense_choice', 'weak_collocation', 'ser_estar', 'por_para',
      'connector_misuse', 'informal_register', 'accent_error',
      'article_use', 'phrasal_verb', 'tense_aspect', 'register_en',
    ];
    for (const k of sampleKeys) {
      expect(MISTAKE_LABELS[k], `Missing label for ${k}`).toBeTruthy();
      expect(MISTAKE_LABELS[k]).not.toMatch(/_/);
    }
  });

  it('human-readable labels start with a capital letter (test S4)', () => {
    const allLabels = Object.values(MISTAKE_LABELS);
    const lowercase = allLabels.filter(l => l.charAt(0) !== l.charAt(0).toUpperCase());
    expect(lowercase).toEqual([]);
  });
});

describe('Skill feedback prefix logic', () => {
  function getMistakePrefix(opts: {
    unseenItems: number;
    repeatedItems: number;
    confidence: string;
  }): string {
    const onlyReview = opts.unseenItems === 0 && opts.repeatedItems > 0;
    const weakEvidence = opts.confidence === 'insufficient' || opts.confidence === 'very_low';
    if (onlyReview) return 'Needs review:';
    if (weakEvidence) return 'Early signal:';
    return 'Main issue:';
  }

  it('shows "Needs review:" when all items are repeated (test S5)', () => {
    const prefix = getMistakePrefix({ unseenItems: 0, repeatedItems: 5, confidence: 'low' });
    expect(prefix).toBe('Needs review:');
  });

  it('shows "Early signal:" when evidence is insufficient (test S6)', () => {
    const prefix = getMistakePrefix({ unseenItems: 2, repeatedItems: 0, confidence: 'insufficient' });
    expect(prefix).toBe('Early signal:');
  });

  it('shows "Early signal:" when evidence is very_low (test S7)', () => {
    const prefix = getMistakePrefix({ unseenItems: 6, repeatedItems: 1, confidence: 'very_low' });
    expect(prefix).toBe('Early signal:');
  });

  it('shows "Main issue:" when evidence is sufficient (test S8)', () => {
    const prefix = getMistakePrefix({ unseenItems: 25, repeatedItems: 3, confidence: 'medium' });
    expect(prefix).toBe('Main issue:');
  });

  it('shows "Main issue:" when evidence is strong (test S9)', () => {
    const prefix = getMistakePrefix({ unseenItems: 45, repeatedItems: 5, confidence: 'strong' });
    expect(prefix).toBe('Main issue:');
  });

  it('onlyReview takes priority over weakEvidence for prefix (test S10)', () => {
    // unseenItems=0 + insufficient → should still be "Needs review:"
    const prefix = getMistakePrefix({ unseenItems: 0, repeatedItems: 2, confidence: 'insufficient' });
    expect(prefix).toBe('Needs review:');
  });
});
