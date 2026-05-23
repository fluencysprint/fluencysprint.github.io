import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useActiveTime } from '../activeTime';

describe('useActiveTime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts at zero', () => {
    const { result } = renderHook(() => useActiveTime({ enabled: true, tickIntervalMs: 500 }));
    expect(result.current.activeSeconds).toBe(0);
  });

  it('accumulates active seconds while the user is interacting', () => {
    const { result } = renderHook(() => useActiveTime({ enabled: true, tickIntervalMs: 500 }));

    // Simulate two ticks of activity, bumping in between
    act(() => {
      window.dispatchEvent(new Event('mousemove'));
      vi.advanceTimersByTime(500);
      window.dispatchEvent(new Event('mousemove'));
      vi.advanceTimersByTime(500);
    });

    expect(result.current.activeSeconds).toBeGreaterThanOrEqual(1);
  });

  it('pauses after idle threshold is exceeded', () => {
    const { result } = renderHook(() =>
      useActiveTime({ enabled: true, tickIntervalMs: 500, idleThresholdMs: 1000 }),
    );

    // One active second
    act(() => {
      window.dispatchEvent(new Event('mousemove'));
      vi.advanceTimersByTime(500);
      window.dispatchEvent(new Event('mousemove'));
      vi.advanceTimersByTime(500);
    });
    const afterActive = result.current.activeSeconds;

    // Now sit idle past the threshold; ticks should stop accumulating
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(result.current.activeSeconds).toBeLessThanOrEqual(afterActive + 1);
    expect(result.current.isPaused).toBe(true);
  });

  it('reset() returns the timer to zero', () => {
    const { result } = renderHook(() => useActiveTime({ enabled: true, tickIntervalMs: 500 }));
    act(() => {
      window.dispatchEvent(new Event('mousemove'));
      vi.advanceTimersByTime(500);
    });
    act(() => result.current.reset());
    expect(result.current.activeSeconds).toBe(0);
  });
});
