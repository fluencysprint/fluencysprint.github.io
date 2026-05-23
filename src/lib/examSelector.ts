import type { CEFRLevel, Exercise } from '../types';
import { CEFR_ORDER } from '../types';
import { shuffle } from './utils';
import { itemFamilyOf, isCalibratedItem } from './evidence';

export interface ExamSelectionInput {
  exercises: Exercise[];
  targetLevel: CEFRLevel;
  count?: number;
  /** Recently shown item ids (avoid). */
  recentExerciseIds?: string[];
  /** Item ids the user has ever answered. */
  seenExerciseIds?: string[];
  /** Item family ids the user has ever answered (avoid near-duplicates). */
  seenFamilyIds?: string[];
}

export interface ExamSelection {
  queue: Exercise[];
  warnings: string[];
  /** Items the user has never answered before. */
  freshCount: number;
  /** Items the user has answered before (repeats). */
  repeatedCount: number;
  levelDistribution: Record<CEFRLevel, number>;
}

function examPool(exercises: Exercise[]): Exercise[] {
  return exercises.filter(
    e => isCalibratedItem(e)
      && e.examEligible !== false
      && e.skill !== 'listening' && e.skill !== 'speaking',
  );
}

/** Spread the requested count across calibration / target / stretch levels. */
export function levelTargets(target: CEFRLevel, count: number): Record<CEFRLevel, number> {
  const out = { A1: 0, A2: 0, B1: 0, B2: 0, C1: 0 } as Record<CEFRLevel, number>;
  const idx = CEFR_ORDER.indexOf(target);
  const lower = CEFR_ORDER.slice(0, idx);
  const stretch = idx < CEFR_ORDER.length - 1 ? CEFR_ORDER[idx + 1] : null;

  const stretchShare = stretch ? Math.min(3, Math.round(count * 0.15)) : 0;
  let targetShare = Math.round(count * (lower.length > 0 ? 0.45 : 0.7));
  let lowerShare = count - targetShare - stretchShare;
  if (lower.length === 0) { targetShare += lowerShare; lowerShare = 0; }

  out[target] += targetShare;
  if (stretch) out[stretch] += stretchShare;

  // Distribute the calibration budget across lower levels, weighting the
  // immediately-lower level slightly more.
  if (lower.length > 0 && lowerShare > 0) {
    const per = Math.floor(lowerShare / lower.length);
    let remainder = lowerShare - per * lower.length;
    for (const lvl of lower) out[lvl] += per;
    // Hand the remainder to the highest lower levels first.
    for (let i = lower.length - 1; i >= 0 && remainder > 0; i--, remainder--) {
      out[lower[i]] += 1;
    }
  }
  return out;
}

/** Pick up to n items from a level pool, preferring fresh items and varying skill/family. */
function pickFromLevel(
  pool: Exercise[],
  n: number,
  state: {
    recent: Set<string>;
    seen: Set<string>;
    usedFamilies: Set<string>;
    usedIds: Set<string>;
  },
): Exercise[] {
  if (n <= 0) return [];
  const available = shuffle(pool).filter(
    e => !state.usedIds.has(e.id) && !state.usedFamilies.has(itemFamilyOf(e)),
  );
  // Freshness tiers: never-seen & not recent → seen-but-not-recent → recent.
  const tierFresh = available.filter(e => !state.seen.has(e.id) && !state.recent.has(e.id));
  const tierSeen = available.filter(e => state.seen.has(e.id) && !state.recent.has(e.id));
  const tierRecent = available.filter(e => state.recent.has(e.id));
  const ordered = [...tierFresh, ...tierSeen, ...tierRecent];

  const chosen: Exercise[] = [];
  const skillCount = new Map<string, number>();
  // Greedy pass favouring skill diversity.
  for (const ex of ordered) {
    if (chosen.length >= n) break;
    const fam = itemFamilyOf(ex);
    if (state.usedFamilies.has(fam) || state.usedIds.has(ex.id)) continue;
    const used = skillCount.get(ex.skill) ?? 0;
    // On the first pass cap each skill so the exam stays balanced.
    if (used >= Math.ceil(n / 2) && chosen.length < ordered.length) continue;
    chosen.push(ex);
    state.usedFamilies.add(fam);
    state.usedIds.add(ex.id);
    skillCount.set(ex.skill, used + 1);
  }
  // Second pass: relax the skill cap to fill any shortfall.
  if (chosen.length < n) {
    for (const ex of ordered) {
      if (chosen.length >= n) break;
      const fam = itemFamilyOf(ex);
      if (state.usedFamilies.has(fam) || state.usedIds.has(ex.id)) continue;
      chosen.push(ex);
      state.usedFamilies.add(fam);
      state.usedIds.add(ex.id);
    }
  }
  return chosen;
}

/**
 * Build a readiness exam that samples across skills/levels, avoids recently
 * seen items and repeated families, and warns when the fresh bank is thin.
 */
export function buildReadinessExam(input: ExamSelectionInput): ExamSelection {
  const count = input.count ?? 20;
  const pool = examPool(input.exercises);
  const recent = new Set(input.recentExerciseIds ?? []);
  const seen = new Set(input.seenExerciseIds ?? []);
  const seenFamilies = new Set(input.seenFamilyIds ?? []);

  const targets = levelTargets(input.targetLevel, count);
  const state = { recent, seen, usedFamilies: new Set<string>(), usedIds: new Set<string>() };
  const warnings: string[] = [];

  const queue: Exercise[] = [];
  const shortfalls: CEFRLevel[] = [];
  for (const level of CEFR_ORDER) {
    const want = targets[level];
    if (want <= 0) continue;
    const levelPool = pool.filter(e => e.cefrLevel === level);
    const picked = pickFromLevel(levelPool, want, state);
    if (picked.length < want) shortfalls.push(level);
    queue.push(...picked);
  }

  // Backfill any global shortfall from whatever calibrated items remain.
  if (queue.length < count) {
    const rest = pickFromLevel(pool, count - queue.length, state);
    queue.push(...rest);
  }

  const finalQueue = shuffle(queue).slice(0, count);

  // Freshness accounting (vs. the user's lifetime history).
  const freshCount = finalQueue.filter(
    e => !seen.has(e.id) && !seenFamilies.has(itemFamilyOf(e)),
  ).length;
  const repeatedCount = finalQueue.length - freshCount;

  if (finalQueue.length < count) {
    warnings.push('Limited fresh question bank. Results may be less accurate.');
  } else if (freshCount < Math.ceil(count * 0.5)) {
    warnings.push('Fresh evidence is limited. Try a different drill or wait for more content.');
  }
  if (shortfalls.length > 0) {
    warnings.push(`Thin coverage at ${shortfalls.join(', ')} — those levels are under-sampled.`);
  }

  const levelDistribution = { A1: 0, A2: 0, B1: 0, B2: 0, C1: 0 } as Record<CEFRLevel, number>;
  for (const e of finalQueue) levelDistribution[e.cefrLevel] += 1;

  return { queue: finalQueue, warnings, freshCount, repeatedCount, levelDistribution };
}
