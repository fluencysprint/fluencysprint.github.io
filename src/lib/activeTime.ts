import { useEffect, useRef, useState, useCallback } from 'react';

const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'focus'] as const;

export interface ActiveTimeOptions {
  enabled?: boolean;
  idleThresholdMs?: number;
  tickIntervalMs?: number;
}

/**
 * Tracks "active learning time": wall-clock seconds the user is plausibly
 * engaged. The timer pauses when the document is hidden or when no user
 * input has happened for `idleThresholdMs` (default 60s).
 *
 * Returns activeSeconds plus controls. Resets to zero when the consumer
 * remounts the hook or calls reset().
 */
export function useActiveTime({
  enabled = true,
  idleThresholdMs = 60_000,
  tickIntervalMs = 1000,
}: ActiveTimeOptions = {}) {
  const [activeSeconds, setActiveSeconds] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const lastActivityRef = useRef<number>(Date.now());
  const lastTickRef = useRef<number>(Date.now());

  // Bump activity on any interaction
  useEffect(() => {
    if (!enabled) return;
    const onActivity = () => {
      lastActivityRef.current = Date.now();
    };
    for (const ev of ACTIVITY_EVENTS) {
      window.addEventListener(ev, onActivity, { passive: true });
    }
    return () => {
      for (const ev of ACTIVITY_EVENTS) {
        window.removeEventListener(ev, onActivity);
      }
    };
  }, [enabled]);

  // Pause when the tab is hidden
  useEffect(() => {
    if (!enabled) return;
    const onVisibility = () => {
      if (document.hidden) {
        setIsPaused(true);
      } else {
        // Re-anchor activity on return so we don't accidentally count
        // the hidden time as idle right after.
        lastActivityRef.current = Date.now();
        lastTickRef.current = Date.now();
        setIsPaused(false);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [enabled]);

  // Tick
  useEffect(() => {
    if (!enabled) return;
    const interval = window.setInterval(() => {
      if (document.hidden) {
        // visibilitychange already paused us; just refresh anchors
        lastTickRef.current = Date.now();
        return;
      }
      const now = Date.now();
      const sinceActivity = now - lastActivityRef.current;
      if (sinceActivity > idleThresholdMs) {
        setIsPaused(true);
        lastTickRef.current = now;
        return;
      }
      // Count the elapsed wall time since the previous tick (clamped).
      const delta = Math.min(tickIntervalMs * 2, now - lastTickRef.current);
      lastTickRef.current = now;
      if (delta > 0) {
        setActiveSeconds(s => s + Math.round(delta / 1000));
        if (isPaused) setIsPaused(false);
      }
    }, tickIntervalMs);
    return () => window.clearInterval(interval);
  }, [enabled, idleThresholdMs, tickIntervalMs, isPaused]);

  const reset = useCallback(() => {
    setActiveSeconds(0);
    lastActivityRef.current = Date.now();
    lastTickRef.current = Date.now();
    setIsPaused(false);
  }, []);

  const bump = useCallback(() => {
    lastActivityRef.current = Date.now();
    if (isPaused) setIsPaused(false);
  }, [isPaused]);

  return { activeSeconds, isPaused, reset, bump };
}
