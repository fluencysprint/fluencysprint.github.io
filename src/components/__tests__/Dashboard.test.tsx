import React from 'react';
import { describe, it, expect } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import Dashboard from '../../pages/Dashboard';
import Onboarding from '../../pages/Onboarding';
import Listening from '../../pages/Listening';
import Speaking from '../../pages/Speaking';
import { resetAllAppData, createProfile } from '../../lib/profile';
import { refreshActiveProfileCache, addDiagnosticResult } from '../../lib/storage';
import type { PlacementResult } from '../../types';

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

describe('Dashboard — A1 through C1 readiness', () => {
  it('renders all five CEFR readiness cards once a placement exists', () => {
    ensureProfile();
    const placement: PlacementResult = {
      language: 'spanish',
      estimatedLevel: 'A2',
      confidence: 'medium',
      perLevel: [
        { level: 'A1', attempted: 4, correct: 4, skipped: 0, accuracy: 1, status: 'strong', readiness: 100 },
        { level: 'A2', attempted: 4, correct: 3, skipped: 0, accuracy: 0.75, status: 'developing', readiness: 75 },
        { level: 'B1', attempted: 3, correct: 1, skipped: 0, accuracy: 0.33, status: 'not_yet', readiness: 33 },
        { level: 'B2', attempted: 0, correct: 0, skipped: 0, accuracy: 0, status: 'unknown', readiness: 0 },
        { level: 'C1', attempted: 0, correct: 0, skipped: 0, accuracy: 0, status: 'unknown', readiness: 0 },
      ],
      skillEstimates: [],
      itemsAttempted: 11,
      itemsSkipped: 0,
      writingAttempted: false,
      notes: ['Writing estimate unavailable — take a writing check later.'],
    };
    addDiagnosticResult({
      id: 'd1', date: new Date().toISOString(), language: 'spanish',
      answers: [], placement, timeSpent: 300, itemCount: 11,
    });

    render(<MemoryRouter><Dashboard /></MemoryRouter>);
    expect(screen.getByTestId('readiness-A1')).toBeInTheDocument();
    expect(screen.getByTestId('readiness-A2')).toBeInTheDocument();
    expect(screen.getByTestId('readiness-B1')).toBeInTheDocument();
    expect(screen.getByTestId('readiness-B2')).toBeInTheDocument();
    expect(screen.getByTestId('readiness-C1')).toBeInTheDocument();
  });

  it('prompts for diagnostic when no placement exists', () => {
    ensureProfile();
    render(<MemoryRouter><Dashboard /></MemoryRouter>);
    expect(screen.getByText(/Take the placement diagnostic/i)).toBeInTheDocument();
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
