import { describe, it, expect } from 'vitest';
import { buildReadinessExam, levelTargets } from '../examSelector';
import { itemFamilyOf } from '../evidence';
import { getLanguagePack } from '../../languages';

describe('readiness exam selector', () => {
  it('avoids recently seen items when fresh ones exist (test 16)', () => {
    const pack = getLanguagePack('english');
    const all = pack.exercises.filter(e => e.examEligible !== false);
    // Mark the first 10 as recently seen.
    const recent = all.slice(0, 10).map(e => e.id);
    const sel = buildReadinessExam({
      exercises: pack.exercises, targetLevel: 'B1', count: 20, recentExerciseIds: recent,
    });
    const usedRecent = sel.queue.filter(e => recent.includes(e.id)).length;
    expect(usedRecent).toBe(0);
  });

  it('never repeats an item family within one exam (test 17)', () => {
    const pack = getLanguagePack('spanish');
    const sel = buildReadinessExam({ exercises: pack.exercises, targetLevel: 'B2', count: 20 });
    const fams = sel.queue.map(itemFamilyOf);
    expect(new Set(fams).size).toBe(fams.length);
  });

  it('includes lower-level calibration items for a higher target (test 18)', () => {
    const targets = levelTargets('B2', 20);
    expect(targets.A2 + targets.B1).toBeGreaterThan(0);
    const pack = getLanguagePack('english');
    const sel = buildReadinessExam({ exercises: pack.exercises, targetLevel: 'B2', count: 20 });
    const belowTarget = sel.queue.filter(e => ['A1', 'A2', 'B1'].includes(e.cefrLevel)).length;
    expect(belowTarget).toBeGreaterThan(0);
  });

  it('warns when the fresh bank is too small (test 19)', () => {
    const pack = getLanguagePack('english');
    const tiny = pack.exercises.filter(e => e.cefrLevel === 'C1').slice(0, 4);
    const sel = buildReadinessExam({ exercises: tiny, targetLevel: 'C1', count: 20 });
    expect(sel.warnings.length).toBeGreaterThan(0);
    expect(sel.warnings.some(w => /limited fresh|fresh/i.test(w))).toBe(true);
  });

  it('repeating the same exam marks items as repeated evidence (test 20)', () => {
    const pack = getLanguagePack('english');
    const seenIds = pack.exercises.map(e => e.id);
    const seenFams = pack.exercises.map(itemFamilyOf);
    const sel = buildReadinessExam({
      exercises: pack.exercises, targetLevel: 'B1', count: 20,
      seenExerciseIds: seenIds, seenFamilyIds: seenFams,
    });
    expect(sel.repeatedCount).toBeGreaterThan(0);
    expect(sel.freshCount).toBe(0);
  });

  it('English exam uses only English items (test 43)', () => {
    const pack = getLanguagePack('english');
    const sel = buildReadinessExam({ exercises: pack.exercises, targetLevel: 'B1', count: 20 });
    expect(sel.queue.every(e => e.id.startsWith('en-'))).toBe(true);
  });

  it('Spanish exam uses no English items (test 44)', () => {
    const pack = getLanguagePack('spanish');
    const sel = buildReadinessExam({ exercises: pack.exercises, targetLevel: 'B1', count: 20 });
    expect(sel.queue.some(e => e.id.startsWith('en-'))).toBe(false);
  });

  it('distinguishes new vs repeated evidence for exam results (test 36)', () => {
    const pack = getLanguagePack('spanish');
    const sel = buildReadinessExam({ exercises: pack.exercises, targetLevel: 'B1', count: 20 });
    expect(sel.freshCount + sel.repeatedCount).toBe(sel.queue.length);
  });
});
