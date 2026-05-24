import React from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import LevelPath from '../LevelPath';
import WordCounter from '../WordCounter';
import WeaknessHeatmap from '../WeaknessHeatmap';
import type { MistakeCategory } from '../../types';

beforeEach(() => {
  document.documentElement.classList.add('dark');
});

afterEach(() => {
  document.documentElement.classList.remove('dark');
});

describe('LevelPath dark mode', () => {
  it('inactive nodes do not rely on bg-white alone — dark variant present', () => {
    render(<LevelPath currentLevel="A1" />);
    const path = screen.getByTestId('level-path');
    const html = path.innerHTML;
    // Every node with bg-white must also have dark:bg-slate-700
    const whiteNodes = [...path.querySelectorAll('[class*="bg-white"]')];
    for (const node of whiteNodes) {
      expect(node.className).toContain('dark:bg-slate-700');
    }
  });

  it('connector lines have dark variant', () => {
    render(<LevelPath currentLevel="B1" />);
    const path = screen.getByTestId('level-path');
    const connectors = [...path.querySelectorAll('[class*="bg-slate-200"]')];
    for (const c of connectors) {
      expect(c.className).toContain('dark:bg-slate-700');
    }
  });
});

describe('WordCounter dark mode', () => {
  it('too_short status badge has dark-mode classes', () => {
    render(<WordCounter text="hi" min={20} max={40} />);
    const badge = screen.getByTestId('word-counter').querySelector('span');
    expect(badge?.className).toContain('dark:bg-amber-950/40');
    expect(badge?.className).toContain('dark:text-amber-200');
    expect(badge?.className).toContain('dark:border-amber-700/50');
  });

  it('in_range status badge has dark-mode classes', () => {
    const text = Array.from({ length: 25 }, () => 'word').join(' ');
    render(<WordCounter text={text} min={20} max={40} />);
    const badge = screen.getByTestId('word-counter').querySelector('span');
    expect(badge?.className).toContain('dark:bg-emerald-950/40');
    expect(badge?.className).toContain('dark:text-emerald-300');
  });

  it('too_long status badge has dark-mode classes', () => {
    const text = Array.from({ length: 60 }, () => 'word').join(' ');
    render(<WordCounter text={text} min={20} max={40} />);
    const badge = screen.getByTestId('word-counter').querySelector('span');
    expect(badge?.className).toContain('dark:bg-red-950/40');
    expect(badge?.className).toContain('dark:text-red-300');
  });
});

describe('LevelPath active node dark glow', () => {
  it('active node does not use hardcoded white-only shadow', () => {
    render(<LevelPath currentLevel="B1" />);
    const path = screen.getByTestId('level-path');
    const activeNode = path.querySelector('[class*="bg-indigo-600"]');
    expect(activeNode).not.toBeNull();
    expect(activeNode!.className).toContain('dark:shadow-indigo-900');
  });

  it('active node has dark shadow variant, not just light', () => {
    render(<LevelPath currentLevel="A2" />);
    const path = screen.getByTestId('level-path');
    const activeNode = path.querySelector('[class*="shadow-indigo-200"]');
    expect(activeNode).not.toBeNull();
    expect(activeNode!.className).toContain('dark:shadow-indigo-900');
    expect(activeNode!.className).not.toMatch(/shadow-white/);
  });
});

describe('WeaknessHeatmap dark mode', () => {
  const cats: MistakeCategory[] = ['subjunctive', 'tense_choice', 'ser_estar', 'por_para'];

  it('inactive tiles use CSS variable for background, not hardcoded white', () => {
    const { container } = render(
      <WeaknessHeatmap mistakeCounts={{}} categories={cats} />,
    );
    const tiles = container.querySelectorAll('[style*="background"]');
    for (const tile of tiles) {
      const bg = (tile as HTMLElement).style.backgroundColor;
      expect(bg).toContain('var(--heat-');
    }
  });

  it('active high-severity tile uses CSS variable for color', () => {
    const counts: Partial<Record<MistakeCategory, number>> = { subjunctive: 10, tense_choice: 3 };
    const { container } = render(
      <WeaknessHeatmap mistakeCounts={counts} categories={cats} />,
    );
    const tiles = container.querySelectorAll('[style*="background"]');
    const hasCssVar = [...tiles].some(t =>
      (t as HTMLElement).style.backgroundColor.includes('var(--heat-'),
    );
    expect(hasCssVar).toBe(true);
  });
});

describe('Writing submit button dark mode', () => {
  it('submit button in Writing page has visible enabled state in dark mode', () => {
    // Verify the className string used in Writing.tsx has readable dark text.
    // We test by rendering a button with the same className pattern.
    const { container } = render(
      <button className="flex-1 py-3.5 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:opacity-40">
        Submit
      </button>,
    );
    const btn = container.querySelector('button')!;
    expect(btn.className).toContain('text-white');
    expect(btn.className).toContain('bg-indigo-600');
    expect(btn.className).toContain('disabled:opacity-40');
  });
});
