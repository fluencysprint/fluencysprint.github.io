import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import WordCounter from '../WordCounter';

describe('WordCounter', () => {
  it('shows the current word count and target range', () => {
    render(<WordCounter text="hola mundo" min={80} max={120} />);
    const node = screen.getByTestId('word-counter');
    expect(node.textContent).toContain('2');
    expect(node.textContent).toContain('80');
    expect(node.textContent).toContain('120');
  });

  it('shows "Too short" status when below the range', () => {
    render(<WordCounter text="hola" min={20} max={40} />);
    expect(screen.getByTestId('word-counter').textContent).toMatch(/too short/i);
  });

  it('shows "In range" status when inside the range', () => {
    const text = Array.from({ length: 25 }, () => 'palabra').join(' ');
    render(<WordCounter text={text} min={20} max={40} />);
    expect(screen.getByTestId('word-counter').textContent).toMatch(/in range/i);
  });

  it('shows "Too long" status when above the range', () => {
    const text = Array.from({ length: 60 }, () => 'palabra').join(' ');
    render(<WordCounter text={text} min={20} max={40} />);
    expect(screen.getByTestId('word-counter').textContent).toMatch(/too long/i);
  });

  it('shows active writing time when provided', () => {
    render(<WordCounter text="hola" activeSeconds={75} />);
    expect(screen.getByTestId('word-counter').textContent).toMatch(/1m 15s/);
  });
});
