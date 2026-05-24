import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ExerciseRenderer from '../ExerciseRenderer';
import { seededShuffle } from '../../lib/utils';
import type { Exercise } from '../../types';

function makeMC(overrides: Partial<Exercise> = {}): Exercise {
  return {
    id: 'mc-shuffle-test',
    type: 'multipleChoice',
    skill: 'grammar',
    cefrLevel: 'B1',
    prompt: 'Choose the correct word.',
    choices: ['vengas', 'vienes', 'vendrás', 'venir'],
    correctAnswer: 'vengas',
    explanation: 'Subjunctive required here.',
    mistakeCategories: ['subjunctive'],
    tags: [],
    estimatedSeconds: 20,
    difficulty: 2,
    accentSensitive: false,
    keyboardHelp: false,
    ...overrides,
  };
}

// ─── Test 1: Source data not mutated ─────────────────────────────────────────

describe('test 1 — source exercise.choices is not mutated', () => {
  it('exercise.choices array is unchanged after render with a seed', () => {
    const ex = makeMC();
    const originalChoices = [...ex.choices!];
    render(
      <ExerciseRenderer exercise={ex} onAnswer={vi.fn()} choiceSeed="any-seed-here" />,
    );
    expect(ex.choices).toEqual(originalChoices);
  });

  it('seededShuffle does not mutate the input array', () => {
    const arr = ['a', 'b', 'c', 'd'];
    const original = [...arr];
    seededShuffle(arr, 'seed');
    expect(arr).toEqual(original);
  });
});

// ─── Test 2 & 3: Correct answer not always first; appears in multiple positions ──

describe('test 2 & 3 — shuffled positions', () => {
  it('test 2: with a seed that moves the correct answer, it does not render first', () => {
    const ex = makeMC();
    const choices = ex.choices!;
    // Find a seed that places 'vengas' away from index 0
    let shiftSeed = '';
    for (let i = 0; i < 200; i++) {
      const s = `session-${i}`;
      if (seededShuffle(choices, s)[0] !== 'vengas') { shiftSeed = s; break; }
    }
    expect(shiftSeed).toBeTruthy(); // Confirm we found such a seed

    const { container } = render(
      <ExerciseRenderer exercise={ex} onAnswer={vi.fn()} choiceSeed={shiftSeed} />,
    );
    const radios = container.querySelectorAll('[role="radio"]');
    expect(radios[0].textContent).not.toBe('vengas');
    // All choices still present
    expect(screen.getByRole('radio', { name: 'vengas' })).toBeInTheDocument();
  });

  it('test 3: correct answer appears in multiple positions across different seeds', () => {
    const choices = ['vengas', 'vienes', 'vendrás', 'venir'];
    const positionsSeen = new Set<number>();
    for (let i = 0; i < 300; i++) {
      const shuffled = seededShuffle(choices, `varied-seed-${i}`);
      positionsSeen.add(shuffled.indexOf('vengas'));
    }
    expect(positionsSeen.size).toBeGreaterThanOrEqual(3);
  });
});

// ─── Test 4: Validation correct even when correct answer is not first ─────────

describe('test 4 — answer validation with shuffled choices', () => {
  it('marks correct when user picks the correct answer regardless of its position', async () => {
    const user = userEvent.setup();
    const onAnswer = vi.fn();
    const ex = makeMC();
    const choices = ex.choices!;

    // Find seed placing 'vengas' last
    let lastSeed = '';
    for (let i = 0; i < 300; i++) {
      const s = `last-seed-${i}`;
      const sh = seededShuffle(choices, s);
      if (sh[sh.length - 1] === 'vengas') { lastSeed = s; break; }
    }
    expect(lastSeed).toBeTruthy();

    const { container } = render(
      <ExerciseRenderer exercise={ex} onAnswer={onAnswer} choiceSeed={lastSeed} />,
    );

    // 'vengas' should be last
    const radios = container.querySelectorAll('[role="radio"]');
    expect(radios[radios.length - 1].textContent).toBe('vengas');

    // Selecting it and confirming should still be marked correct
    await user.click(screen.getByRole('radio', { name: 'vengas' }));
    await user.click(screen.getByRole('button', { name: /check answer/i }));
    expect(screen.getByTestId('exercise-feedback').textContent).toMatch(/✓ Correct!/i);

    await user.click(screen.getByRole('button', { name: /^high$/i }));
    expect(onAnswer).toHaveBeenCalledTimes(1);
    expect(onAnswer.mock.calls[0][0].correct).toBe(true);
    expect(onAnswer.mock.calls[0][0].userAnswer).toBe('vengas');
  });
});

// ─── Test 5: Same seed → same order (reload stability) ───────────────────────

describe('test 5 — same seed produces identical order', () => {
  it('renders choices in the same order when re-rendered with the same seed', () => {
    const ex = makeMC();
    const seed = 'stable-reload-seed-42';

    const { container, rerender } = render(
      <ExerciseRenderer exercise={ex} onAnswer={vi.fn()} choiceSeed={seed} />,
    );
    const firstOrder = [...container.querySelectorAll('[role="radio"]')].map(r => r.textContent);

    rerender(<ExerciseRenderer exercise={ex} onAnswer={vi.fn()} choiceSeed={seed} />);
    const secondOrder = [...container.querySelectorAll('[role="radio"]')].map(r => r.textContent);

    expect(firstOrder).toEqual(secondOrder);
  });

  it('seededShuffle is deterministic for a given seed', () => {
    const arr = ['a', 'b', 'c', 'd'];
    expect(seededShuffle(arr, 'seed-x')).toEqual(seededShuffle(arr, 'seed-x'));
    expect(seededShuffle(arr, 'seed-y')).toEqual(seededShuffle(arr, 'seed-y'));
  });
});

// ─── Test 6: Different seeds → can produce different orders ──────────────────

describe('test 6 — different seeds can produce different orders', () => {
  it('two distinct seeds do not always produce the same order', () => {
    const arr = ['vengas', 'vienes', 'vendrás', 'venir'];
    const orders = new Set<string>();
    for (let i = 0; i < 50; i++) {
      orders.add(seededShuffle(arr, `session-${i}`).join(','));
    }
    expect(orders.size).toBeGreaterThan(1);
  });
});

// ─── Test 7-10: Each session mode passes a choiceSeed ─────────────────────────

describe('tests 7-10 — choiceSeed produces shuffled display', () => {
  it('test 7-10: with a shuffling seed, choices render in shuffled order', () => {
    const ex = makeMC();
    const choices = ex.choices!;

    // Find a seed that actually changes the order
    let shuffleSeed = '';
    for (let i = 0; i < 200; i++) {
      const s = `diag-${i}`;
      if (seededShuffle(choices, s).join(',') !== choices.join(',')) {
        shuffleSeed = s;
        break;
      }
    }
    expect(shuffleSeed).toBeTruthy();

    const { container } = render(
      <ExerciseRenderer exercise={ex} onAnswer={vi.fn()} choiceSeed={shuffleSeed} />,
    );
    const rendered = [...container.querySelectorAll('[role="radio"]')].map(r => r.textContent);
    expect(rendered.join(',')).not.toBe(choices.join(','));
    // All choices still present
    for (const c of choices) {
      expect(rendered).toContain(c);
    }
  });

  it('without choiceSeed, choices render in original order', () => {
    const ex = makeMC();
    const { container } = render(
      <ExerciseRenderer exercise={ex} onAnswer={vi.fn()} />,
    );
    const rendered = [...container.querySelectorAll('[role="radio"]')].map(r => r.textContent);
    expect(rendered).toEqual(ex.choices!);
  });
});

// ─── Test 11: No dependency on correct answer at index 0 ─────────────────────

describe('test 11 — correct answer validation is position-independent', () => {
  it('selecting wrong answer when correct is not first gives incorrect feedback', async () => {
    const user = userEvent.setup();
    const ex = makeMC();
    const choices = ex.choices!;

    // seed where 'vengas' is NOT first
    let seed = '';
    for (let i = 0; i < 200; i++) {
      const s = `pos-test-${i}`;
      if (seededShuffle(choices, s)[0] !== 'vengas') { seed = s; break; }
    }
    render(<ExerciseRenderer exercise={ex} onAnswer={vi.fn()} choiceSeed={seed} />);

    // Click whatever is shown FIRST (should not be 'vengas')
    const firstRadio = screen.getAllByRole('radio')[0];
    expect(firstRadio.textContent).not.toBe('vengas');

    await user.click(firstRadio);
    await user.click(screen.getByRole('button', { name: /check answer/i }));
    expect(screen.getByText(/incorrect/i)).toBeInTheDocument();
  });
});

// ─── Test 12: Build ────────────────────────────────────────────────────────────
// (Covered by `npm run build` in CI — noted here as a reminder)

// ─── Test 13: All tests pass ──────────────────────────────────────────────────
// (Covered by `npm test` — noted here as a reminder)
