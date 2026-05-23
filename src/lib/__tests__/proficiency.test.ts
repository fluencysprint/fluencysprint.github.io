import { describe, it, expect } from 'vitest';
import { estimateProficiency } from '../proficiency';
import { computeEvidenceWeight } from '../evidence';
import type { EvidenceEvent, CEFRLevel, Skill, ScoringMode } from '../../types';

let seq = 0;
function ev(opts: {
  level: CEFRLevel;
  correct: boolean;
  skill?: Skill;
  seenCountBefore?: number;
  scoringMode?: ScoringMode;
  isReview?: boolean;
  skipped?: boolean;
  confidence?: 'low' | 'medium' | 'high';
}): EvidenceEvent {
  const seenCountBefore = opts.seenCountBefore ?? 0;
  const scoringMode = opts.scoringMode ?? 'objective';
  const isReview = opts.isReview ?? false;
  const skipped = opts.skipped ?? false;
  const confidence = opts.confidence ?? 'high';
  const evidenceWeight = computeEvidenceWeight({ scoringMode, isReview, skipped, seenCountBefore, confidence });
  seq += 1;
  return {
    id: `e${seq}`, profileId: 'p', languageId: 'spanish', activityType: 'sprint',
    exerciseId: `x${seq}`, itemVersion: 1, itemFamilyId: `f${seq}`,
    skill: opts.skill ?? 'grammar', cefrLevel: opts.level,
    firstAttempt: seenCountBefore === 0, seenCountBefore,
    correct: opts.correct, skipped, userAnswer: '', confidence,
    timeSpentSeconds: 10, activeTimeSeconds: 10, mistakeCategories: [],
    scoringMode, evidenceWeight, isRepeat: seenCountBefore > 0, isReview,
    createdAt: new Date().toISOString(),
  };
}

function makeLevel(level: CEFRLevel, total: number, correct: number, opts: Partial<Parameters<typeof ev>[0]> = {}): EvidenceEvent[] {
  return Array.from({ length: total }, (_, i) => ev({ level, correct: i < correct, ...opts }));
}

describe('conservative proficiency estimation', () => {
  it('two correct C1 items do NOT create C1 readiness (test 7)', () => {
    const est = estimateProficiency('spanish', makeLevel('C1', 2, 2));
    const c1 = est.readinessByLevel.find(l => l.level === 'C1')!;
    expect(est.currentEstimate).not.toBe('C1');
    expect(c1.band).toBe('insufficient');
    expect(c1.confidence).toBe('insufficient');
  });

  it('two correct B2 items do NOT show 100% B2 readiness or strong (test 8, 32)', () => {
    const est = estimateProficiency('spanish', makeLevel('B2', 2, 2));
    const b2 = est.readinessByLevel.find(l => l.level === 'B2')!;
    expect(b2.readiness).toBeLessThan(100);
    expect(b2.band).not.toBe('strong');
    expect(['insufficient', 'early_signal']).toContain(b2.band);
  });

  it('a high score made of repeated items does not raise the level (test 9)', () => {
    // 30 C1 items, all correct, but every one previously seen 2+ times.
    const est = estimateProficiency('spanish', makeLevel('C1', 30, 30, { seenCountBefore: 2 }));
    const c1 = est.readinessByLevel.find(l => l.level === 'C1')!;
    expect(est.currentEstimate).not.toBe('C1');
    expect(c1.unseenItems).toBe(0);
    expect(c1.band).toBe('insufficient');
  });

  it('review items never raise CEFR level (test 6)', () => {
    const est = estimateProficiency('spanish', makeLevel('B1', 8, 8, { isReview: true }));
    const b1 = est.readinessByLevel.find(l => l.level === 'B1')!;
    expect(b1.weightedEvidence).toBe(0);
    expect(est.currentEstimate).toBe('A1');
  });

  it('weak lower-level evidence caps higher estimates (test 10)', () => {
    const evidence = [
      ...makeLevel('A1', 8, 8),       // stable floor
      ...makeLevel('A2', 6, 2),       // weak — 33%
      ...makeLevel('B2', 20, 18),     // strong on its own
    ];
    const est = estimateProficiency('spanish', evidence);
    const b2 = est.readinessByLevel.find(l => l.level === 'B2')!;
    expect(b2.gatedBy).toBe('A2');
    expect(est.currentEstimate).not.toBe('B2');
    expect(est.bottlenecks.some(b => b.includes('A2'))).toBe(true);
  });

  it('many skips reduce confidence and warn (test 11)', () => {
    const evidence = [
      ...makeLevel('A2', 6, 5),
      ...makeLevel('A2', 5, 0, { skipped: true }),
    ];
    const est = estimateProficiency('spanish', evidence);
    expect(est.evidenceWarnings.some(w => /skip/i.test(w))).toBe(true);
  });

  it('missing writing evidence leaves writing proficiency unavailable and warns (tests 13, 40)', () => {
    const est = estimateProficiency('spanish', makeLevel('A2', 10, 8, { skill: 'grammar' }));
    const writing = est.readinessBySkill.find(s => s.skill === 'writing')!;
    expect(writing.proficiency).toBeNull();
    expect(est.evidenceWarnings.some(w => /writing/i.test(w))).toBe(true);
  });

  it('legacy evidence is preserved but discounted (test 14)', () => {
    const est = estimateProficiency('spanish', makeLevel('B1', 10, 10, { scoringMode: 'legacy' }));
    const b1 = est.readinessByLevel.find(l => l.level === 'B1')!;
    expect(est.evidenceQuality.legacyItems).toBe(10);
    expect(b1.unseenItems).toBe(0); // legacy is not calibrated unseen evidence
    expect(est.currentEstimate).toBe('A1');
  });

  it('writing improves readiness only with enough evidence (test 42)', () => {
    const few = estimateProficiency('spanish', makeLevel('B1', 2, 2, { skill: 'writing', scoringMode: 'heuristic_writing' }));
    expect(few.readinessBySkill.find(s => s.skill === 'writing')!.proficiency).toBeNull();

    const enough = estimateProficiency('spanish', makeLevel('B1', 4, 4, { skill: 'writing', scoringMode: 'heuristic_writing' }));
    expect(enough.readinessBySkill.find(s => s.skill === 'writing')!.proficiency).not.toBeNull();
  });

  it('a stable chain promotes the estimate (sanity)', () => {
    const evidence = [
      ...makeLevel('A1', 8, 8),
      ...makeLevel('A2', 8, 7),
      ...makeLevel('B1', 8, 7),
    ];
    const est = estimateProficiency('spanish', evidence);
    expect(['B1', 'A2']).toContain(est.currentEstimate);
    expect(est.nextTarget).toBeTruthy();
  });

  it('never shows strong from fewer than 20 unseen calibrated items', () => {
    const est = estimateProficiency('spanish', makeLevel('B1', 15, 15));
    const b1 = est.readinessByLevel.find(l => l.level === 'B1')!;
    expect(b1.band).not.toBe('strong');
  });
});
