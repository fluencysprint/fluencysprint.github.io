import { describe, it, expect } from 'vitest';
import { getLanguagePack } from '../index';
import { buildAdaptiveDiagnosticPlan } from '../../lib/placement';

describe('language separation — pack contents', () => {
  it('English pack exercises all start with "en-"', () => {
    const pack = getLanguagePack('english');
    const nonEnglish = pack.exercises.filter(e => !e.id.startsWith('en-'));
    expect(nonEnglish, `Non-English IDs: ${nonEnglish.map(e => e.id).join(', ')}`).toHaveLength(0);
  });

  it('English pack reading texts all start with "en-"', () => {
    const pack = getLanguagePack('english');
    const nonEnglish = pack.readingTexts.filter(t => !t.id.startsWith('en-'));
    expect(nonEnglish, `Non-English reading IDs: ${nonEnglish.map(t => t.id).join(', ')}`).toHaveLength(0);
  });

  it('English pack writing prompts all start with "en-"', () => {
    const pack = getLanguagePack('english');
    const nonEnglish = pack.writingPrompts.filter(p => !p.id.startsWith('en-'));
    expect(nonEnglish, `Non-English writing prompt IDs: ${nonEnglish.map(p => p.id).join(', ')}`).toHaveLength(0);
  });

  it('Spanish pack contains no English-prefixed IDs', () => {
    const pack = getLanguagePack('spanish');
    const englishItems = pack.exercises.filter(e => e.id.startsWith('en-'));
    expect(englishItems).toHaveLength(0);
  });

  it('Spanish pack exercises cover all five CEFR levels with ≥5 items each', () => {
    const pack = getLanguagePack('spanish');
    for (const level of ['A1', 'A2', 'B1', 'B2', 'C1'] as const) {
      const count = pack.exercises.filter(e => e.cefrLevel === level).length;
      expect(count, `Spanish ${level}`).toBeGreaterThanOrEqual(5);
    }
  });

  it('English pack covers all five CEFR levels with ≥5 items each', () => {
    const pack = getLanguagePack('english');
    for (const level of ['A1', 'A2', 'B1', 'B2', 'C1'] as const) {
      const count = pack.exercises.filter(e => e.cefrLevel === level).length;
      expect(count, `English ${level}`).toBeGreaterThanOrEqual(5);
    }
  });

  it('packs share no exercise IDs', () => {
    const es = new Set(getLanguagePack('spanish').exercises.map(e => e.id));
    const en = getLanguagePack('english').exercises.map(e => e.id);
    const overlap = en.filter(id => es.has(id));
    expect(overlap).toHaveLength(0);
  });
});

describe('language separation — diagnostic plan', () => {
  it('English diagnostic plan contains only English exercises', () => {
    const plan = buildAdaptiveDiagnosticPlan({ language: 'english', selfEstimatedLevel: 'A1' });
    const nonEnglish = plan.filter(e => !e.id.startsWith('en-') && e.type !== 'writingPrompt');
    expect(nonEnglish).toHaveLength(0);
  });

  it('Spanish diagnostic plan contains no English exercises', () => {
    const plan = buildAdaptiveDiagnosticPlan({ language: 'spanish', selfEstimatedLevel: 'A1' });
    const english = plan.filter(e => e.id.startsWith('en-'));
    expect(english).toHaveLength(0);
  });

  it('English diagnostic plan exercises are drawn from the English pack', () => {
    const pack = getLanguagePack('english');
    const englishIds = new Set(pack.exercises.map(e => e.id));
    const plan = buildAdaptiveDiagnosticPlan({ language: 'english', selfEstimatedLevel: 'B1' });
    for (const ex of plan) {
      expect(englishIds.has(ex.id), `Exercise ${ex.id} not in English pack`).toBe(true);
    }
  });

  it('Spanish diagnostic plan exercises are drawn from the Spanish pack', () => {
    const pack = getLanguagePack('spanish');
    const spanishIds = new Set(pack.exercises.map(e => e.id));
    const plan = buildAdaptiveDiagnosticPlan({ language: 'spanish', selfEstimatedLevel: 'B1' });
    for (const ex of plan) {
      expect(spanishIds.has(ex.id), `Exercise ${ex.id} not in Spanish pack`).toBe(true);
    }
  });

  it('diagnostic plan for beginner English starts with A1 items', () => {
    const plan = buildAdaptiveDiagnosticPlan({ language: 'english', selfEstimatedLevel: 'beginner' });
    const a1Count = plan.filter(e => e.cefrLevel === 'A1').length;
    expect(a1Count).toBeGreaterThanOrEqual(2);
    // A1 items appear before B2 items
    const firstA1 = plan.findIndex(e => e.cefrLevel === 'A1');
    const firstB2 = plan.findIndex(e => e.cefrLevel === 'B2');
    if (firstB2 >= 0) expect(firstA1).toBeLessThan(firstB2);
  });
});
