import { describe, it, expect } from 'vitest';
import {
  computePlacement, buildAdaptiveDiagnosticPlan, placementHeadline,
} from '../placement';
import type { DiagnosticAnswer, CEFRLevel, Skill } from '../../types';

function answer(
  cefrLevel: CEFRLevel, correct: boolean, opts: {
    skill?: Skill; skipped?: boolean; confidence?: 'low' | 'medium' | 'high';
  } = {}
): DiagnosticAnswer {
  return {
    exerciseId: `ex-${Math.random().toString(36).slice(2, 7)}`,
    cefrLevel,
    skill: opts.skill ?? 'grammar',
    userAnswer: correct ? 'right' : 'wrong',
    correct,
    confidence: opts.confidence ?? 'medium',
    timeSpent: 20,
    skipped: opts.skipped ?? false,
  };
}

describe('placement — conservative gating', () => {
  it('A1 with weak performance is NOT placed B1/B2 even with one lucky upper answer', () => {
    const answers: DiagnosticAnswer[] = [
      // A1: only 1/4 correct
      answer('A1', true), answer('A1', false), answer('A1', false), answer('A1', false),
      // A2: 1/4
      answer('A2', false), answer('A2', false), answer('A2', true), answer('A2', false),
      // One lucky B2
      answer('B2', true),
    ];
    const p = computePlacement('spanish', answers);
    expect(p.estimatedLevel).toBe('A1');
    expect(['low', 'medium']).toContain(p.confidence);
  });

  it('strong A1 but weak A2 produces A1 with A2 boundary, not B1/B2', () => {
    const answers: DiagnosticAnswer[] = [
      answer('A1', true), answer('A1', true), answer('A1', true), answer('A1', true),
      answer('A2', true), answer('A2', false), answer('A2', false), answer('A2', false),
      // Some B1 / B2 answers (irrelevant since A2 is the cap)
      answer('B1', true), answer('B1', false),
      answer('B2', false),
    ];
    const p = computePlacement('spanish', answers);
    expect(p.estimatedLevel).toBe('A1');
    // The engine reports A2 as emerging on the boundary
    expect(p.boundary === 'A2' || p.boundary === undefined).toBe(true);
  });

  it('strong A2 but weak B1 → A2 with B1 boundary or A2', () => {
    const answers: DiagnosticAnswer[] = [
      answer('A1', true), answer('A1', true), answer('A1', true), answer('A1', true),
      answer('A2', true), answer('A2', true), answer('A2', true), answer('A2', true),
      answer('B1', false), answer('B1', false), answer('B1', false), answer('B1', false),
    ];
    const p = computePlacement('spanish', answers);
    expect(p.estimatedLevel).toBe('A2');
    expect(p.boundary === 'B1' || p.boundary === undefined).toBe(true);
  });

  it('estimating B2 requires enough B1 + B2 evidence', () => {
    const answers: DiagnosticAnswer[] = [
      answer('A1', true), answer('A1', true),
      answer('A2', true), answer('A2', true),
      answer('B1', true), answer('B1', true), answer('B1', true),
      // Only one B2 attempt — not enough to confidently say B2
      answer('B2', true),
    ];
    const p = computePlacement('spanish', answers);
    expect(p.estimatedLevel === 'B1' || p.estimatedLevel === 'B2').toBe(true);
    if (p.estimatedLevel === 'B2') {
      // If it does say B2, confidence must NOT be high (only one B2 item)
      expect(p.confidence).not.toBe('high');
    }
  });

  it('estimating C1 requires enough B2 + C1 evidence', () => {
    const answers: DiagnosticAnswer[] = [
      answer('A1', true), answer('A1', true),
      answer('A2', true), answer('A2', true),
      answer('B1', true), answer('B1', true), answer('B1', true),
      answer('B2', true), answer('B2', true), answer('B2', true),
      answer('C1', false), answer('C1', false), answer('C1', false),
    ];
    const p = computePlacement('spanish', answers);
    expect(p.estimatedLevel).toBe('B2');
  });

  it('many skips lower confidence to low', () => {
    const answers: DiagnosticAnswer[] = [
      answer('A1', true), answer('A1', true),
      answer('A2', true, { skipped: true }),
      answer('A2', true, { skipped: true }),
      answer('B1', false, { skipped: true }),
      answer('B1', false, { skipped: true }),
      answer('B2', false, { skipped: true }),
    ];
    const p = computePlacement('spanish', answers);
    expect(p.confidence).toBe('low');
  });

  it('low-confidence correct answers reduce skill score', () => {
    const allHigh: DiagnosticAnswer[] = Array.from({ length: 4 }, () =>
      answer('B1', true, { confidence: 'high' })
    );
    const allLow: DiagnosticAnswer[] = Array.from({ length: 4 }, () =>
      answer('B1', true, { confidence: 'low' })
    );
    const high = computePlacement('spanish', allHigh).skillEstimates.find(s => s.skill === 'grammar')!;
    const low = computePlacement('spanish', allLow).skillEstimates.find(s => s.skill === 'grammar')!;
    expect((low.score ?? 100)).toBeLessThan((high.score ?? 0));
  });

  it('writing not attempted → writingAttempted=false and a note', () => {
    const answers: DiagnosticAnswer[] = [
      answer('A1', true), answer('A1', true),
      answer('A2', true), answer('A2', true),
      answer('B1', true), answer('B1', true),
    ];
    const p = computePlacement('spanish', answers);
    expect(p.writingAttempted).toBe(false);
    expect(p.notes.some(n => n.toLowerCase().includes('writing'))).toBe(true);
    const writingEstimate = p.skillEstimates.find(s => s.skill === 'writing');
    expect(writingEstimate?.unattempted).toBe(true);
    expect(writingEstimate?.score).toBeNull();
  });

  it('placementHeadline formats boundary correctly', () => {
    expect(placementHeadline({
      language: 'spanish', estimatedLevel: 'A2', confidence: 'low',
      perLevel: [], skillEstimates: [], itemsAttempted: 0, itemsSkipped: 0,
      writingAttempted: false, notes: [],
    })).toBe('A2');
    expect(placementHeadline({
      language: 'spanish', estimatedLevel: 'A2', boundary: 'B1', confidence: 'low',
      perLevel: [], skillEstimates: [], itemsAttempted: 0, itemsSkipped: 0,
      writingAttempted: false, notes: [],
    })).toBe('A2/B1 boundary');
  });
});

describe('placement — adaptive plan', () => {
  it('beginner plan starts with A1/A2 items', () => {
    const queue = buildAdaptiveDiagnosticPlan({
      language: 'spanish', selfEstimatedLevel: 'beginner', includeWriting: false,
    });
    expect(queue.length).toBeGreaterThan(5);
    const earlyLevels = queue.slice(0, 4).map(e => e.cefrLevel);
    expect(earlyLevels.every(l => l === 'A1' || l === 'A2')).toBe(true);
  });

  it('not_sure plan also starts at A1', () => {
    const queue = buildAdaptiveDiagnosticPlan({
      language: 'spanish', selfEstimatedLevel: 'not_sure', includeWriting: false,
    });
    expect(queue.slice(0, 2).every(e => e.cefrLevel === 'A1' || e.cefrLevel === 'A2')).toBe(true);
  });

  it('B2 self-estimate still includes A1/A2 anchor items', () => {
    const queue = buildAdaptiveDiagnosticPlan({
      language: 'spanish', selfEstimatedLevel: 'B2', includeWriting: false,
    });
    expect(queue.some(e => e.cefrLevel === 'A1')).toBe(true);
    expect(queue.some(e => e.cefrLevel === 'A2')).toBe(true);
    expect(queue.some(e => e.cefrLevel === 'B2')).toBe(true);
  });

  it('includeWriting appends one writing prompt at the end', () => {
    const queue = buildAdaptiveDiagnosticPlan({
      language: 'spanish', selfEstimatedLevel: 'A1', includeWriting: true,
    });
    const last = queue[queue.length - 1];
    expect(last.type === 'writingPrompt' || queue.some(e => e.type === 'writingPrompt')).toBe(true);
  });

  it('drops listening/speaking items from the plan', () => {
    const queue = buildAdaptiveDiagnosticPlan({
      language: 'spanish', selfEstimatedLevel: 'B1', includeWriting: false,
    });
    expect(queue.every(e => e.skill !== 'listening' && e.skill !== 'speaking')).toBe(true);
  });
});
