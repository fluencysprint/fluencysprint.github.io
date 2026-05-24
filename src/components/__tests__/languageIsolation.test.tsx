import React from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import WeaknessHeatmap from '../WeaknessHeatmap';
import Review from '../../pages/Review';
import { getLanguagePack } from '../../languages';
import { resetAllAppData, createProfile } from '../../lib/profile';
import { refreshActiveProfileCache } from '../../lib/storage';
import { addMistake } from '../../lib/storage';
import { nanoid } from '../../lib/utils';
import type { MistakeRecord } from '../../types';
import { MISTAKE_LABELS } from '../../types';

function ensureProfile(lang: 'english' | 'spanish') {
  resetAllAppData();
  refreshActiveProfileCache();
  createProfile({
    displayName: 'Tester',
    targetLanguage: lang,
    selfEstimatedLevel: 'B1',
    targetLevel: 'C1',
    dailyTime: 10,
  });
  refreshActiveProfileCache();
}

function fakeMistake(cats: string[]): MistakeRecord {
  return {
    id: nanoid(),
    exerciseId: `ex-${nanoid()}`,
    date: new Date().toISOString(),
    userAnswer: 'wrong',
    correctAnswer: 'right',
    explanation: 'Because.',
    mistakeCategories: cats as MistakeRecord['mistakeCategories'],
    cefrLevel: 'B1',
    skill: 'grammar',
    confidence: 'medium',
    timeSpent: 10,
    nextReviewDate: new Date().toISOString().split('T')[0],
    reviewInterval: 1,
    attempts: 1,
    status: 'learning',
    prompt: 'Test prompt',
  };
}

const englishCategories = getLanguagePack('english').metadata.weaknessCategories;
const spanishCategories = getLanguagePack('spanish').metadata.weaknessCategories;

// ─── Tests 1-5: WeaknessHeatmap rendering ────────────────────────────────────

describe('WeaknessHeatmap — language isolation', () => {
  afterEach(() => cleanup());

  it('test 1: English heatmap does not render Ser vs Estar', () => {
    const counts = { ser_estar: 5 } as Parameters<typeof WeaknessHeatmap>[0]['mistakeCounts'];
    render(<WeaknessHeatmap mistakeCounts={counts} categories={englishCategories} />);
    expect(screen.queryByText(MISTAKE_LABELS['ser_estar'])).toBeNull();
  });

  it('test 2: English heatmap does not render Por vs Para', () => {
    const counts = { por_para: 3 } as Parameters<typeof WeaknessHeatmap>[0]['mistakeCounts'];
    render(<WeaknessHeatmap mistakeCounts={counts} categories={englishCategories} />);
    expect(screen.queryByText(MISTAKE_LABELS['por_para'])).toBeNull();
  });

  it('test 3: English heatmap does not render Missing Accents', () => {
    const counts = { accent_error: 2 } as Parameters<typeof WeaknessHeatmap>[0]['mistakeCounts'];
    render(<WeaknessHeatmap mistakeCounts={counts} categories={englishCategories} />);
    expect(screen.queryByText(MISTAKE_LABELS['accent_error'])).toBeNull();
  });

  it('test 4: English heatmap does not render Subjunctive', () => {
    const counts = { subjunctive: 4 } as Parameters<typeof WeaknessHeatmap>[0]['mistakeCounts'];
    render(<WeaknessHeatmap mistakeCounts={counts} categories={englishCategories} />);
    expect(screen.queryByText(MISTAKE_LABELS['subjunctive'])).toBeNull();
  });

  it('test 5: Spanish heatmap renders Ser vs Estar and Por vs Para', () => {
    const counts = { ser_estar: 5, por_para: 3 } as Parameters<typeof WeaknessHeatmap>[0]['mistakeCounts'];
    render(<WeaknessHeatmap mistakeCounts={counts} categories={spanishCategories} />);
    expect(screen.getByText(MISTAKE_LABELS['ser_estar'])).toBeInTheDocument();
    expect(screen.getByText(MISTAKE_LABELS['por_para'])).toBeInTheDocument();
  });
});

// ─── Tests 6-8: Review page category filtering ───────────────────────────────

describe('Review page — language-filtered categories', () => {
  beforeEach(() => cleanup());
  afterEach(() => cleanup());

  it('test 6 & 7: English review does not show Spanish-only category labels in topCats', () => {
    ensureProfile('english');
    // Seed mistakes with Spanish-origin categories
    addMistake(fakeMistake(['ser_estar', 'por_para', 'accent_error']));
    addMistake(fakeMistake(['subjunctive', 'ser_estar']));
    render(<MemoryRouter><Review /></MemoryRouter>);
    expect(screen.queryByText(MISTAKE_LABELS['ser_estar'])).toBeNull();
    expect(screen.queryByText(MISTAKE_LABELS['por_para'])).toBeNull();
    expect(screen.queryByText(MISTAKE_LABELS['accent_error'])).toBeNull();
    expect(screen.queryByText(MISTAKE_LABELS['subjunctive'])).toBeNull();
  });

  it('test 8: Spanish review does not show English-only category labels in topCats', () => {
    ensureProfile('spanish');
    // Seed mistakes with English-origin categories
    addMistake(fakeMistake(['article_use', 'phrasal_verb', 'tense_aspect']));
    addMistake(fakeMistake(['word_order', 'collocation_en']));
    render(<MemoryRouter><Review /></MemoryRouter>);
    expect(screen.queryByText(MISTAKE_LABELS['article_use'])).toBeNull();
    expect(screen.queryByText(MISTAKE_LABELS['phrasal_verb'])).toBeNull();
    expect(screen.queryByText(MISTAKE_LABELS['tense_aspect'])).toBeNull();
  });
});

// ─── Test 9: All displayed categories come from active language pack ──────────

describe('Language pack — category membership', () => {
  it('test 9: English weaknessCategories contains no Spanish-exclusive categories', () => {
    const spanishOnly = new Set(['ser_estar', 'por_para', 'subjunctive', 'accent_error', 'false_friend']);
    for (const cat of englishCategories) {
      expect(spanishOnly.has(cat), `English heatmap includes Spanish-only "${cat}"`).toBe(false);
    }
  });

  it('Spanish weaknessCategories contains no English-exclusive categories', () => {
    const englishOnly = new Set(['article_use', 'phrasal_verb', 'collocation_en', 'preposition_en', 'register_en', 'tense_aspect', 'word_order']);
    for (const cat of spanishCategories) {
      expect(englishOnly.has(cat), `Spanish heatmap includes English-only "${cat}"`).toBe(false);
    }
  });
});

// ─── Test 10: No raw snake_case labels in heatmap UI ─────────────────────────

describe('WeaknessHeatmap — no raw snake_case labels', () => {
  afterEach(() => cleanup());

  it('test 10: English heatmap shows human-readable labels, not raw category keys', () => {
    const counts = {} as Parameters<typeof WeaknessHeatmap>[0]['mistakeCounts'];
    const { container } = render(
      <WeaknessHeatmap mistakeCounts={counts} categories={englishCategories} />,
    );
    const text = container.textContent ?? '';
    // Human-readable labels must be present
    for (const cat of englishCategories) {
      expect(text, `Label for "${cat}" should appear`).toContain(MISTAKE_LABELS[cat]);
    }
    // Raw snake_case keys must not appear literally (e.g. "article_use", "phrasal_verb")
    for (const cat of englishCategories) {
      if (cat.includes('_')) {
        expect(text, `Raw key "${cat}" must not appear in UI`).not.toContain(cat);
      }
    }
  });
});
