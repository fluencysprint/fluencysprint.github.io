import React from 'react';
import { describe, it, expect } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import Layout from '../Layout';
import { resetAllAppData, createProfile } from '../../lib/profile';
import { refreshActiveProfileCache } from '../../lib/storage';

function setup(opts?: { language?: 'spanish' | 'english'; displayName?: string }) {
  resetAllAppData();
  refreshActiveProfileCache();
  createProfile({
    displayName: opts?.displayName,
    targetLanguage: opts?.language ?? 'spanish',
    selfEstimatedLevel: 'beginner',
    targetLevel: 'B1',
    dailyTime: 10,
  });
  refreshActiveProfileCache();
}

describe('Layout sidebar', () => {
  it('renders the app title "Fluency Sprint"', () => {
    setup();
    render(
      <MemoryRouter>
        <Layout><div /></Layout>
      </MemoryRouter>,
    );
    // Appears in both desktop and mobile sidebars
    expect(screen.getAllByText(/Fluency Sprint/i).length).toBeGreaterThan(0);
  });

  it('shows language + A1 → C1 tagline without personal names in default state', () => {
    setup({ language: 'spanish' });
    render(
      <MemoryRouter>
        <Layout><div /></Layout>
      </MemoryRouter>,
    );
    // Should contain "A1 → C1" somewhere in the rendered layout
    expect(screen.getByText(/A1 → C1/)).toBeInTheDocument();
  });

  it('shows profile displayName in sidebar when set', () => {
    setup({ displayName: 'My Learner' });
    render(
      <MemoryRouter>
        <Layout><div /></Layout>
      </MemoryRouter>,
    );
    // May appear in both desktop and mobile sidebar
    expect(screen.getAllByText(/My Learner/).length).toBeGreaterThan(0);
  });

  it('shows "Default profile" when no displayName is set', () => {
    setup({ displayName: undefined });
    render(
      <MemoryRouter>
        <Layout><div /></Layout>
      </MemoryRouter>,
    );
    expect(screen.getAllByText(/Default profile/i).length).toBeGreaterThan(0);
  });

  it('does not render hardcoded developer names', () => {
    setup();
    render(
      <MemoryRouter>
        <Layout><div /></Layout>
      </MemoryRouter>,
    );
    const html = document.body.innerHTML;
    expect(html).not.toMatch(/\bfluencysprint\b/i);
  });

  it('truncate class is applied to at least one profile name element', () => {
    setup({ displayName: 'A very very long profile name that should be truncated' });
    render(
      <MemoryRouter>
        <Layout><div /></Layout>
      </MemoryRouter>,
    );
    // Both desktop and mobile sidebars render the profile name; at least one should truncate.
    const profileEls = screen.getAllByText(/A very very long profile name/);
    expect(profileEls.length).toBeGreaterThan(0);
    const hasTruncate = profileEls.some(el => el.classList.contains('truncate'));
    expect(hasTruncate).toBe(true);
  });
});
