import type {
  CEFRLevel, Exercise, Skill, ProficiencyEstimate, MistakeCategory,
} from '../types';
import { SKILL_LABELS, MISTAKE_LABELS } from '../types';
import { shuffle } from './utils';
import { isCalibratedItem } from './evidence';

// ─── Textual recommendations ────────────────────────────────────────────────

export interface RecommendationContext {
  estimate: ProficiencyEstimate | null;
  dueReviewCount: number;
  topMistakeCategories: MistakeCategory[];
  writingFrequency: 'never' | 'sometimes' | 'often';
}

export function computeRecommendations(ctx: RecommendationContext): string[] {
  const out: string[] = [];
  const est = ctx.estimate;

  if (ctx.dueReviewCount > 0) {
    out.push(`Clear ${ctx.dueReviewCount} due review${ctx.dueReviewCount === 1 ? '' : 's'} to lock in retention.`);
  }

  if (est) {
    // Evidence-gap nudge.
    const gap = est.evidenceQuality.levelsWithInsufficientEvidence[0];
    if (gap) out.push(`Take a short drill at ${gap} to improve evidence quality.`);

    // Weakest reliable skill.
    const weak = est.readinessBySkill
      .filter(s => s.proficiency !== null)
      .sort((a, b) => (a.proficiency ?? 0) - (b.proficiency ?? 0))[0];
    if (weak && (weak.proficiency ?? 100) < 70) {
      out.push(`Your ${est.nextTarget ?? est.currentEstimate} readiness is limited by weak ${SKILL_LABELS[weak.skill].toLowerCase()}.`);
    }

    // Gating bottleneck.
    const gated = est.readinessByLevel.find(l => l.gatedBy);
    if (gated) {
      out.push(`Review ${gated.gatedBy} errors before attempting ${gated.level} again.`);
    }

    if (est.evidenceQuality.writingSamples === 0 && ctx.writingFrequency !== 'never') {
      out.push('Your estimate is uncertain because writing was skipped — add a writing sample.');
    }
  }

  for (const cat of ctx.topMistakeCategories.slice(0, 2)) {
    out.push(`Recurring ${MISTAKE_LABELS[cat].toLowerCase()} mistakes — target them in your next sprint.`);
  }

  if (out.length === 0) out.push('Take a short reading drill to broaden your evidence quality.');
  return out;
}

// ─── Adaptive sprint planner ────────────────────────────────────────────────

export interface SprintPlanInput {
  exercises: Exercise[];
  count: number;
  estimate: ProficiencyEstimate | null;
  dueMistakeExerciseIds: string[];
  recentExerciseIds: string[];
  targetLevel: CEFRLevel;
}

export interface SprintPlan {
  queue: Exercise[];
  reviewCount: number;
  /** True when we had to reuse recently-seen items to fill the sprint. */
  notEnoughFresh: boolean;
  composition: { bottleneck: number; review: number; evidenceGap: number; stretch: number };
}

function objectivePool(exercises: Exercise[]): Exercise[] {
  return exercises.filter(
    e => isCalibratedItem(e) && e.skill !== 'listening' && e.skill !== 'speaking',
  );
}

/**
 * Daily sprint mix: 40% weakest bottleneck, 25% due review, 20% evidence gap,
 * 15% target-level stretch. Fresh (unseen / non-recent) items are preferred;
 * recently-seen items are only used to backfill, and that is reported.
 */
export function planSprint(input: SprintPlanInput): SprintPlan {
  const pool = objectivePool(input.exercises);
  const recent = new Set(input.recentExerciseIds);
  const used = new Set<string>();
  let reusedRecent = false;

  function take(candidates: Exercise[], n: number): Exercise[] {
    if (n <= 0) return [];
    const avail = candidates.filter(e => !used.has(e.id));
    const fresh = shuffle(avail.filter(e => !recent.has(e.id)));
    const stale = shuffle(avail.filter(e => recent.has(e.id)));
    const picked = [...fresh, ...stale].slice(0, n);
    if (fresh.length < n && stale.length > 0) reusedRecent = true;
    for (const e of picked) used.add(e.id);
    return picked;
  }

  const count = input.count;
  const nBottleneck = Math.round(count * 0.4);
  const nReview = Math.round(count * 0.25);
  const nGap = Math.round(count * 0.2);
  const nStretch = count - nBottleneck - nReview - nGap;

  const est = input.estimate;
  const queue: Exercise[] = [];

  // 1. Bottleneck — weakest skills (or whole pool if unknown).
  const weakSkills: Skill[] = est
    ? est.readinessBySkill
      .filter(s => s.proficiency !== null)
      .sort((a, b) => (a.proficiency ?? 0) - (b.proficiency ?? 0))
      .slice(0, 3)
      .map(s => s.skill)
    : [];
  const bottleneckPool = weakSkills.length > 0
    ? pool.filter(e => weakSkills.includes(e.skill))
    : pool;
  queue.push(...take(bottleneckPool, nBottleneck));

  // 2. Due reviews.
  const reviewPool = input.dueMistakeExerciseIds
    .map(id => pool.find(e => e.id === id))
    .filter((e): e is Exercise => !!e);
  const review = reviewPool.filter(e => !used.has(e.id)).slice(0, nReview);
  for (const e of review) used.add(e.id);
  queue.push(...review);

  // 3. Evidence gap — levels with insufficient unseen evidence.
  const gapLevels = est?.evidenceQuality.levelsWithInsufficientEvidence ?? [];
  const gapPool = gapLevels.length > 0
    ? pool.filter(e => gapLevels.includes(e.cefrLevel))
    : pool;
  queue.push(...take(gapPool, nGap));

  // 4. Target-level stretch.
  const stretchPool = pool.filter(e => e.cefrLevel === input.targetLevel);
  queue.push(...take(stretchPool.length > 0 ? stretchPool : pool, nStretch));

  // Backfill any shortfall.
  if (queue.length < count) queue.push(...take(pool, count - queue.length));

  return {
    queue: shuffle(queue).slice(0, count),
    reviewCount: review.length,
    notEnoughFresh: reusedRecent,
    composition: { bottleneck: nBottleneck, review: nReview, evidenceGap: nGap, stretch: nStretch },
  };
}
