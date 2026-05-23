import React from 'react';
import { describe, it, expect } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import Dashboard from '../../pages/Dashboard';
import Skills from '../../pages/Skills';
import Onboarding from '../../pages/Onboarding';
import Listening from '../../pages/Listening';
import Speaking from '../../pages/Speaking';
import { resetAllAppData, createProfile } from '../../lib/profile';
import { refreshActiveProfileCache } from '../../lib/storage';
import { recordEvidence } from '../../lib/evidence';
import type { Exercise, CEFRLevel } from '../../types';

function ensureProfile(opts?: { language?: 'spanish' | 'english' }) {
  resetAllAppData();
  refreshActiveProfileCache();
  createProfile({
    displayName: 'Tester',
    targetLanguage: opts?.language ?? 'spanish',
    selfEstimatedLevel: 'beginner',
    targetLevel: 'B1',
    dailyTime: 10,
  });
  refreshActiveProfileCache();
}

function fakeItem(level: CEFRLevel, n: number): Exercise {
  return {
    id: `es-fake-${level}-${n}`, type: 'multipleChoice', skill: 'grammar', cefrLevel: level,
    prompt: 'p', choices: ['a', 'b'], correctAnswer: 'a', explanation: 'e',
    mistakeCategories: [], tags: [], estimatedSeconds: 10, difficulty: 2,
    accentSensitive: false, keyboardHelp: false, itemFamilyId: `es-fake-${level}-${n}`, construct: 'c',
  };
}

function seedEvidence(level: CEFRLevel, count: number, correct: number) {
  for (let i = 0; i < count; i++) {
    recordEvidence({
      exercise: fakeItem(level, i), languageId: 'spanish', activityType: 'diagnostic',
      correct: i < correct, userAnswer: 'a', confidence: 'high', timeSpentSeconds: 10,
    });
  }
}

describe('Dashboard — evidence-based readiness', () => {
  it('renders five CEFR readiness cards, evidence quality and momentum once evidence exists', () => {
    ensureProfile();
    seedEvidence('A2', 8, 7);
    render(<MemoryRouter><Dashboard /></MemoryRouter>);
    for (const lvl of ['A1', 'A2', 'B1', 'B2', 'C1']) {
      expect(screen.getByTestId(`level-readiness-${lvl}`)).toBeInTheDocument();
    }
    // Evidence quality is shown separately from momentum (test 34, 35).
    expect(screen.getByTestId('evidence-quality')).toBeInTheDocument();
    expect(screen.getByTestId('momentum')).toBeInTheDocument();
  });

  it('a level with only 2 items shows insufficient/early signal, never strong (test 32)', () => {
    ensureProfile();
    seedEvidence('B2', 2, 2);
    render(<MemoryRouter><Dashboard /></MemoryRouter>);
    const card = screen.getByTestId('level-readiness-B2');
    expect(card.textContent).toMatch(/Insufficient evidence|Early signal/i);
    expect(card.textContent).not.toMatch(/Strong evidence/i);
  });

  it('prompts for the diagnostic when there is no evidence at all', () => {
    ensureProfile();
    render(<MemoryRouter><Dashboard /></MemoryRouter>);
    expect(screen.getByText(/Take the placement diagnostic/i)).toBeInTheDocument();
  });
});

describe('Skill map — proficiency vs practice', () => {
  it('shows "Not enough data" for a skill with too little evidence (test 33)', () => {
    ensureProfile();
    seedEvidence('A2', 2, 2); // only grammar, and too few
    render(<MemoryRouter><Skills /></MemoryRouter>);
    // Reading/vocabulary etc. have no evidence → "Not enough data".
    expect(screen.getAllByText(/Not enough data/i).length).toBeGreaterThan(0);
  });
});

describe('Onboarding language selection', () => {
  it('first launch shows the language picker', () => {
    resetAllAppData();
    refreshActiveProfileCache();
    render(<MemoryRouter><Onboarding /></MemoryRouter>);
    expect(screen.getByText(/What language do you want to learn/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Spanish/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /English/i })).toBeInTheDocument();
  });
});

describe('Coming-soon placeholders', () => {
  it('Listening page shows Coming soon and does not affect scoring', () => {
    ensureProfile();
    render(<MemoryRouter><Listening /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: /Coming soon/i })).toBeInTheDocument();
  });

  it('Speaking page shows Coming soon and does not affect scoring', () => {
    ensureProfile();
    render(<MemoryRouter><Speaking /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: /Coming soon/i })).toBeInTheDocument();
  });
});

describe('Onboarding — profile name placeholder', () => {
  it('profile name input has generic placeholder without personal names', () => {
    resetAllAppData();
    refreshActiveProfileCache();
    render(<MemoryRouter><Onboarding /></MemoryRouter>);
    const input = screen.getByPlaceholderText(/main profile|beginner/i);
    expect(input).toBeInTheDocument();
    expect(input).not.toHaveAttribute('placeholder', expect.stringMatching(/friend \(a1\)/i));
  });
});
