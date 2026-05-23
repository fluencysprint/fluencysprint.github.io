import React, { useState } from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LanguageInput from '../LanguageInput';
import { saveDraft, getDraft } from '../../lib/storage';

function Harness({ slot, initial = '' }: { slot?: string; initial?: string }) {
  const [v, setV] = useState(initial);
  return <LanguageInput value={v} onChange={setV} multiline rows={3} draftSlot={slot} />;
}

describe('LanguageInput draft autosave', () => {
  it('writes the current value to the draft slot (debounced)', async () => {
    const user = userEvent.setup();
    render(<Harness slot="diag-1" />);
    const textarea = screen.getByRole('textbox');

    await user.type(textarea, 'Hola mundo');
    // Debounce window in the component is 500ms; wait it out.
    await act(() => new Promise(r => setTimeout(r, 600)));

    expect(getDraft('diag-1')).toBe('Hola mundo');
  });

  it('renders restored draft text when consumer initializes from getDraft', () => {
    saveDraft('diag-2', 'Borrador previo');
    const restored = getDraft('diag-2') ?? '';
    render(<Harness slot="diag-2" initial={restored} />);
    expect(screen.getByDisplayValue('Borrador previo')).toBeInTheDocument();
  });

  it('shows the Spanish accent toolbar by default (Spanish profile in tests)', () => {
    render(<Harness slot="x" />);
    expect(screen.getByTestId('accent-toolbar')).toBeInTheDocument();
  });
});
