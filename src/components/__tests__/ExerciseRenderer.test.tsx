import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ExerciseRenderer from '../ExerciseRenderer';
import type { Exercise } from '../../types';

type AnswerParams = {
  correct: boolean;
  userAnswer: string;
  accentMissing: boolean;
  confidence: 'low' | 'medium' | 'high';
  timeSpent: number;
};

const makeOnAnswer = () => vi.fn((_p: AnswerParams) => {});
const makeOnSkip = () => vi.fn(() => {});

function makeMC(overrides: Partial<Exercise> = {}): Exercise {
  return {
    id: 'mc-test-1',
    type: 'multipleChoice',
    skill: 'grammar',
    cefrLevel: 'B2',
    prompt: 'Quiero que tú _____ más temprano mañana.',
    choices: ['vengas', 'vienes', 'vendrás', 'venir'],
    correctAnswer: 'vengas',
    explanation: 'After "querer que", use present subjunctive.',
    mistakeCategories: ['subjunctive'],
    tags: ['subjunctive'],
    estimatedSeconds: 25,
    difficulty: 2,
    accentSensitive: false,
    keyboardHelp: false,
    ...overrides,
  };
}

function makeCloze(overrides: Partial<Exercise> = {}): Exercise {
  return {
    id: 'cloze-test-1',
    type: 'cloze',
    skill: 'grammar',
    cefrLevel: 'B2',
    prompt: 'Esperamos que la situación _____ (mejorar) pronto.',
    correctAnswer: 'mejore',
    acceptableAnswers: ['mejore'],
    explanation: '"Esperar que" triggers the subjunctive.',
    mistakeCategories: ['subjunctive'],
    tags: ['subjunctive'],
    estimatedSeconds: 30,
    difficulty: 2,
    accentSensitive: false,
    keyboardHelp: false,
    ...overrides,
  };
}

function makeSubjective(overrides: Partial<Exercise> = {}): Exercise {
  return {
    id: 'sub-test-1',
    type: 'writingPrompt',
    skill: 'writing',
    cefrLevel: 'B2',
    prompt: 'Write a short formal email.',
    explanation: 'Example only.',
    exampleAnswer: 'Estimados señores, ...',
    mistakeCategories: ['informal_register'],
    tags: ['writing'],
    estimatedSeconds: 300,
    difficulty: 3,
    accentSensitive: false,
    keyboardHelp: true,
    ...overrides,
  };
}

describe('ExerciseRenderer — multiple choice', () => {
  let onAnswer: ReturnType<typeof makeOnAnswer>;
  let onSkip: ReturnType<typeof makeOnSkip>;

  beforeEach(() => {
    onAnswer = makeOnAnswer();
    onSkip = makeOnSkip();
  });

  it('renders the Check answer button enabled only after selection', () => {
    render(<ExerciseRenderer exercise={makeMC()} onAnswer={onAnswer} onSkip={onSkip} />);
    const checkBtn = screen.getByRole('button', { name: /check answer/i });
    expect(checkBtn).toBeDisabled();

    fireEvent.click(screen.getByRole('radio', { name: 'vengas' }));
    expect(checkBtn).not.toBeDisabled();
  });

  it('shows feedback after selecting an answer and clicking Check', async () => {
    const user = userEvent.setup();
    render(<ExerciseRenderer exercise={makeMC()} onAnswer={onAnswer} onSkip={onSkip} />);

    await user.click(screen.getByRole('radio', { name: 'vengas' }));
    await user.click(screen.getByRole('button', { name: /check answer/i }));

    expect(screen.getByTestId('exercise-feedback')).toBeInTheDocument();
    expect(screen.getByText(/correct/i)).toBeInTheDocument();
    // Explanation should also be visible
    expect(screen.getByText(/After "querer que"/)).toBeInTheDocument();
  });

  it('shows feedback when pressing Enter after selecting an answer', async () => {
    const user = userEvent.setup();
    render(<ExerciseRenderer exercise={makeMC()} onAnswer={onAnswer} onSkip={onSkip} />);

    await user.click(screen.getByRole('radio', { name: 'vengas' }));
    fireEvent.keyDown(document, { key: 'Enter' });

    expect(screen.getByTestId('exercise-feedback')).toBeInTheDocument();
  });

  it('does not submit when no choice is selected', async () => {
    render(<ExerciseRenderer exercise={makeMC()} onAnswer={onAnswer} onSkip={onSkip} />);

    fireEvent.keyDown(document, { key: 'Enter' });
    expect(screen.queryByTestId('exercise-feedback')).not.toBeInTheDocument();

    // Button stays disabled, clicking does nothing
    const checkBtn = screen.getByRole('button', { name: /check answer/i });
    expect(checkBtn).toBeDisabled();
  });

  it('shows the incorrect feedback when wrong answer is chosen, and does NOT call onAnswer immediately', async () => {
    const user = userEvent.setup();
    render(<ExerciseRenderer exercise={makeMC()} onAnswer={onAnswer} onSkip={onSkip} />);

    await user.click(screen.getByRole('radio', { name: 'vienes' }));
    await user.click(screen.getByRole('button', { name: /check answer/i }));

    expect(screen.getByTestId('exercise-feedback')).toBeInTheDocument();
    expect(screen.getByText(/Incorrect/i)).toBeInTheDocument();
    expect(screen.getByText(/After "querer que"/)).toBeInTheDocument();
    // Critical: parent should NOT have been notified yet — confidence prompt is shown first.
    expect(onAnswer).not.toHaveBeenCalled();
    expect(screen.getByTestId('confidence-prompt')).toBeInTheDocument();
  });

  it('calls onAnswer only after confidence is selected', async () => {
    const user = userEvent.setup();
    render(<ExerciseRenderer exercise={makeMC()} onAnswer={onAnswer} onSkip={onSkip} />);

    await user.click(screen.getByRole('radio', { name: 'vengas' }));
    await user.click(screen.getByRole('button', { name: /check answer/i }));
    expect(onAnswer).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /^high$/i }));
    expect(onAnswer).toHaveBeenCalledTimes(1);
    const callArgs = onAnswer.mock.calls[0][0];
    expect(callArgs.correct).toBe(true);
    expect(callArgs.userAnswer).toBe('vengas');
    expect(callArgs.confidence).toBe('high');
    expect(callArgs.timeSpent).toBeGreaterThanOrEqual(0);
  });

  it('calls onSkip when Skip is clicked', async () => {
    const user = userEvent.setup();
    render(<ExerciseRenderer exercise={makeMC()} onAnswer={onAnswer} onSkip={onSkip} />);

    await user.click(screen.getByRole('button', { name: /skip/i }));
    expect(onSkip).toHaveBeenCalledTimes(1);
    expect(onAnswer).not.toHaveBeenCalled();
  });
});

describe('ExerciseRenderer — text input (cloze)', () => {
  let onAnswer: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onAnswer = makeOnAnswer();
  });

  it('Check button is disabled until user types', async () => {
    const user = userEvent.setup();
    render(<ExerciseRenderer exercise={makeCloze()} onAnswer={onAnswer} />);
    const checkBtn = screen.getByRole('button', { name: /check answer/i });
    expect(checkBtn).toBeDisabled();

    await user.type(screen.getByPlaceholderText(/type your answer/i), 'mejore');
    expect(checkBtn).not.toBeDisabled();
  });

  it('shows feedback after typing and clicking Check', async () => {
    const user = userEvent.setup();
    render(<ExerciseRenderer exercise={makeCloze()} onAnswer={onAnswer} />);

    await user.type(screen.getByPlaceholderText(/type your answer/i), 'mejore');
    await user.click(screen.getByRole('button', { name: /check answer/i }));

    expect(screen.getByTestId('exercise-feedback')).toBeInTheDocument();
    expect(screen.getByText(/correct/i)).toBeInTheDocument();
  });

  it('shows feedback when pressing Enter after typing', async () => {
    const user = userEvent.setup();
    render(<ExerciseRenderer exercise={makeCloze()} onAnswer={onAnswer} />);

    await user.type(screen.getByPlaceholderText(/type your answer/i), 'mejore');
    fireEvent.keyDown(document, { key: 'Enter' });

    expect(screen.getByTestId('exercise-feedback')).toBeInTheDocument();
  });

  it('does not submit when input is empty or whitespace-only', () => {
    render(<ExerciseRenderer exercise={makeCloze()} onAnswer={onAnswer} />);
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(screen.queryByTestId('exercise-feedback')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /check answer/i })).toBeDisabled();
  });

  it('flags wrong answers and shows correct one', async () => {
    const user = userEvent.setup();
    render(<ExerciseRenderer exercise={makeCloze()} onAnswer={onAnswer} />);

    await user.type(screen.getByPlaceholderText(/type your answer/i), 'mejora');
    await user.click(screen.getByRole('button', { name: /check answer/i }));

    expect(screen.getByText(/Incorrect/i)).toBeInTheDocument();
    expect(screen.getByText(/mejore/i)).toBeInTheDocument();
    expect(onAnswer).not.toHaveBeenCalled();
  });
});

describe('ExerciseRenderer — state reset between exercises', () => {
  it('clears selection, input, and feedback when the exercise prop changes', async () => {
    const user = userEvent.setup();
    const onAnswer = makeOnAnswer();
    const first = makeMC({ id: 'first', prompt: 'First prompt' });
    const second = makeMC({ id: 'second', prompt: 'Second prompt', choices: ['a', 'b', 'c', 'd'], correctAnswer: 'a' });

    const { rerender } = render(<ExerciseRenderer exercise={first} onAnswer={onAnswer} />);

    await user.click(screen.getByRole('radio', { name: 'vengas' }));
    await user.click(screen.getByRole('button', { name: /check answer/i }));
    expect(screen.getByTestId('exercise-feedback')).toBeInTheDocument();

    rerender(<ExerciseRenderer exercise={second} onAnswer={onAnswer} />);

    // New prompt visible, feedback gone, fresh check button disabled
    expect(screen.getByText('Second prompt')).toBeInTheDocument();
    expect(screen.queryByTestId('exercise-feedback')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /check answer/i })).toBeDisabled();
    // Choices for new exercise visible
    expect(screen.getByRole('radio', { name: 'a' })).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'vengas' })).not.toBeInTheDocument();
  });
});

describe('ExerciseRenderer — subjective tasks', () => {
  it('preserves the user answer and shows analysis (no "Correct!") after submit', async () => {
    const user = userEvent.setup();
    const onAnswer = makeOnAnswer();
    const ex = makeSubjective({
      taskType: 'formal_email',
      wordTargetMin: 30,
      wordTargetMax: 60,
    });
    render(<ExerciseRenderer exercise={ex} onAnswer={onAnswer} />);

    const userText =
      'Estimados señores, me dirijo a ustedes para solicitar información sobre el programa de prácticas que ofrecen en su empresa. Quedo a la espera de su respuesta. Atentamente, Juan.';
    await user.type(screen.getByPlaceholderText(/write your answer/i), userText);
    await user.click(screen.getByRole('button', { name: /submit for analysis/i }));

    // User text is still visible (use a unique phrase only in the user's text)
    expect(screen.getByTestId('writing-feedback')).toBeInTheDocument();
    expect(screen.getByText(/ofrecen en su empresa/i)).toBeInTheDocument();
    // No misleading "Correct!" banner
    expect(screen.queryByText(/^✓ Correct!$/)).not.toBeInTheDocument();
    // Example answer appears as a separate section
    expect(screen.getByText(/example answer/i)).toBeInTheDocument();
    // Self-rate buttons appear, onAnswer not yet called
    expect(screen.getByTestId('self-rate-prompt')).toBeInTheDocument();
    expect(onAnswer).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /^strong$/i }));
    expect(onAnswer).toHaveBeenCalledTimes(1);
    expect(onAnswer.mock.calls[0][0].confidence).toBe('high');
    expect(onAnswer.mock.calls[0][0].analysis).toBeDefined();
  });

  it('Edit and resubmit returns to the editing view with the text intact', async () => {
    const user = userEvent.setup();
    const onAnswer = makeOnAnswer();
    render(<ExerciseRenderer exercise={makeSubjective({ taskType: 'formal_email' })} onAnswer={onAnswer} />);

    const textarea = screen.getByPlaceholderText(/write your answer/i);
    await user.type(textarea, 'A first draft that I want to revise.');
    await user.click(screen.getByRole('button', { name: /submit for analysis/i }));

    expect(screen.getByTestId('writing-feedback')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /edit & resubmit/i }));

    expect(screen.queryByTestId('writing-feedback')).not.toBeInTheDocument();
    expect(screen.getByDisplayValue(/A first draft that I want to revise/)).toBeInTheDocument();
  });

  it('Enter does not submit a subjective writing task (Enter is a newline)', async () => {
    const user = userEvent.setup();
    const onAnswer = makeOnAnswer();
    render(<ExerciseRenderer exercise={makeSubjective()} onAnswer={onAnswer} />);

    await user.type(screen.getByPlaceholderText(/write your answer/i), 'A short answer');
    fireEvent.keyDown(document, { key: 'Enter' });

    expect(screen.queryByTestId('exercise-feedback')).not.toBeInTheDocument();
    expect(onAnswer).not.toHaveBeenCalled();
  });
});

describe('ExerciseRenderer — register rewrite task', () => {
  function makeRewrite(overrides: Partial<Exercise> = {}): Exercise {
    return {
      id: 'rr-test-1',
      type: 'registerRewrite',
      skill: 'formal_register',
      cefrLevel: 'B2',
      taskType: 'register_rewrite',
      prompt: 'Rewrite formally:\n"Hey, can you tell me about the job thing?"',
      exampleAnswer: 'Dear Sir or Madam, could you please provide more information about the position?',
      explanation: 'Formal English avoids "Hey" and vague nouns.',
      mistakeCategories: ['register_en', 'informal_register'],
      tags: ['formal register'],
      estimatedSeconds: 90,
      difficulty: 3,
      accentSensitive: false,
      keyboardHelp: false,
      wordTargetMin: 8,
      wordTargetMax: 25,
      checklist: [
        'polite greeting or opening',
        'asks for information or details',
        'uses "position", "role", or "opportunity" instead of "job thing"',
        'avoids casual words like "Hey", "job thing", and "tell me"',
        'keeps the same meaning',
      ],
      ...overrides,
    };
  }

  it('shows rewrite instructions before the textarea', () => {
    render(<ExerciseRenderer exercise={makeRewrite()} onAnswer={vi.fn()} />);
    expect(screen.getByTestId('rewrite-instructions')).toBeInTheDocument();
    expect(screen.getByText(/rewrite the sentence in a more formal/i)).toBeInTheDocument();
  });

  it('shows expected word count in the instructions', () => {
    render(<ExerciseRenderer exercise={makeRewrite()} onAnswer={vi.fn()} />);
    const instructions = screen.getByTestId('rewrite-instructions');
    expect(within(instructions).getByText(/8.{1,5}25 words/i)).toBeInTheDocument();
  });

  it('shows checklist items before submit', () => {
    render(<ExerciseRenderer exercise={makeRewrite()} onAnswer={vi.fn()} />);
    expect(screen.getByText(/polite greeting or opening/i)).toBeInTheDocument();
    expect(screen.getByText(/position.*role.*opportunity/i)).toBeInTheDocument();
  });

  it('hides instructions after submission', async () => {
    const user = userEvent.setup();
    render(<ExerciseRenderer exercise={makeRewrite()} onAnswer={vi.fn()} />);

    const textarea = screen.getByPlaceholderText(/write your answer/i);
    await user.type(textarea, 'Hello, could you please provide more details about the position?');
    await user.click(screen.getByRole('button', { name: /submit for analysis/i }));

    expect(screen.queryByTestId('rewrite-instructions')).not.toBeInTheDocument();
  });

  it('Edit and resubmit works for register rewrite', async () => {
    const user = userEvent.setup();
    render(<ExerciseRenderer exercise={makeRewrite()} onAnswer={vi.fn()} />);

    const textarea = screen.getByPlaceholderText(/write your answer/i);
    await user.type(textarea, 'Hello, could you please provide more details about the position?');
    await user.click(screen.getByRole('button', { name: /submit for analysis/i }));

    expect(screen.getByTestId('writing-feedback')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /edit & resubmit/i }));

    expect(screen.queryByTestId('writing-feedback')).not.toBeInTheDocument();
    expect(screen.getByTestId('rewrite-instructions')).toBeInTheDocument();
  });
});
