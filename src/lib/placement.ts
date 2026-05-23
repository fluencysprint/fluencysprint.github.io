import type {
  CEFRLevel, LanguageId, Exercise, DiagnosticAnswer,
  PlacementResult, LevelEvidence, LevelEvidenceStatus, PlacementConfidence,
  SkillEstimate, Skill,
} from '../types';
import { CEFR_ORDER, SCORED_SKILLS } from '../types';
import { getLanguagePack } from '../languages';
import { shuffle } from './utils';

// ─── Public planning ───────────────────────────────────────────────────────

export interface DiagnosticPlanOptions {
  language: LanguageId;
  /** What the user said about themselves at onboarding. */
  selfEstimatedLevel: CEFRLevel | 'beginner' | 'not_sure';
  /** Include a writing prompt as the final item (recommended; user can still skip). */
  includeWriting?: boolean;
}

const ITEMS_PER_LEVEL: Record<CEFRLevel, number> = {
  A1: 4,
  A2: 4,
  B1: 3,
  B2: 3,
  C1: 3,
};

/**
 * Build a level-balanced diagnostic queue with conservative branching:
 *  - "beginner" / "not_sure" → full A1→A2 floor, lighter B1+ stretch.
 *  - "A1" / "A2" → full A1/A2 with 1-2 stretch items per upper level.
 *  - "B1" / "B2" → start at A2 with a couple of A1 anchor items, then climb.
 * Total ~12–17 objective items. Caller may append a single writing prompt.
 */
export function buildAdaptiveDiagnosticPlan(opts: DiagnosticPlanOptions): Exercise[] {
  const pack = getLanguagePack(opts.language);

  // Filter pool: drop coming-soon skills entirely.
  const pool = pack.exercises.filter(
    e => e.skill !== 'listening' && e.skill !== 'speaking' && e.type !== 'writingPrompt'
  );
  const byLevel: Record<CEFRLevel, Exercise[]> = {
    A1: pool.filter(e => e.cefrLevel === 'A1'),
    A2: pool.filter(e => e.cefrLevel === 'A2'),
    B1: pool.filter(e => e.cefrLevel === 'B1'),
    B2: pool.filter(e => e.cefrLevel === 'B2'),
    C1: pool.filter(e => e.cefrLevel === 'C1'),
  };

  const startIndex = startingLevelIndex(opts.selfEstimatedLevel);
  const queue: Exercise[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < CEFR_ORDER.length; i++) {
    const level = CEFR_ORDER[i];
    const items = byLevel[level];
    if (items.length === 0) continue;
    let target: number;
    if (i < startIndex) {
      // Below user's claimed level: include a couple of anchor items so we can
      // confirm or contradict their self-estimate.
      target = Math.min(2, items.length);
    } else if (i === startIndex) {
      target = Math.min(ITEMS_PER_LEVEL[level], items.length);
    } else {
      // Stretch items above claimed level.
      target = Math.min(Math.max(2, ITEMS_PER_LEVEL[level] - 1), items.length);
    }
    for (const ex of shuffle(items)) {
      if (queue.length === 0 || !seen.has(ex.id)) {
        queue.push(ex);
        seen.add(ex.id);
        if (queueCountAtLevel(queue, level) >= target) break;
      }
    }
  }

  // Reorder: easier items first, harder items last; skills mixed.
  queue.sort((a, b) => CEFR_ORDER.indexOf(a.cefrLevel) - CEFR_ORDER.indexOf(b.cefrLevel));

  // Optionally append a single appropriately-leveled writing prompt at the end.
  if (opts.includeWriting) {
    const targetLevel = inferWritingTarget(opts.selfEstimatedLevel);
    const writingPool = pack.exercises.filter(
      e => e.type === 'writingPrompt' && e.cefrLevel === targetLevel
    );
    const writing = writingPool[0] ?? pack.exercises.find(e => e.type === 'writingPrompt');
    if (writing) queue.push(writing);
  }

  return queue;
}

function queueCountAtLevel(queue: Exercise[], level: CEFRLevel): number {
  return queue.filter(e => e.cefrLevel === level).length;
}

function startingLevelIndex(self: CEFRLevel | 'beginner' | 'not_sure'): number {
  if (self === 'beginner' || self === 'not_sure') return 0; // A1
  return CEFR_ORDER.indexOf(self);
}

function inferWritingTarget(self: CEFRLevel | 'beginner' | 'not_sure'): CEFRLevel {
  if (self === 'beginner' || self === 'not_sure' || self === 'A1') return 'A1';
  return self;
}

// ─── Scoring ───────────────────────────────────────────────────────────────

const LEVEL_STATUS_THRESHOLDS = {
  strong: 0.85,
  developing: 0.7,
  emerging: 0.5,
  // < 0.5 → not_yet
};

const MIN_ATTEMPTS_FOR_STATUS = 2;

export function computePlacement(
  language: LanguageId,
  answers: DiagnosticAnswer[],
): PlacementResult {
  const perLevel = computePerLevel(answers);
  const skillEstimates = computeSkillEstimates(answers);
  const itemsAttempted = answers.filter(a => !a.skipped).length;
  const itemsSkipped = answers.filter(a => a.skipped).length;
  const writingAttempted = answers.some(a => a.skill === 'writing' && !a.skipped);

  const { estimatedLevel, boundary, notes: levelNotes } = pickEstimatedLevel(perLevel);
  const confidence = computeConfidence({
    perLevel, itemsAttempted, itemsSkipped, writingAttempted,
  });

  const notes = [...levelNotes];
  if (!writingAttempted) notes.push('Writing estimate unavailable — take a writing check later.');
  if (itemsSkipped > 0) notes.push(`${itemsSkipped} item${itemsSkipped === 1 ? '' : 's'} skipped.`);

  return {
    language,
    estimatedLevel,
    boundary,
    confidence,
    perLevel,
    skillEstimates,
    itemsAttempted,
    itemsSkipped,
    writingAttempted,
    notes,
  };
}

function computePerLevel(answers: DiagnosticAnswer[]): LevelEvidence[] {
  return CEFR_ORDER.map(level => {
    const forLevel = answers.filter(a => a.cefrLevel === level);
    const attempted = forLevel.filter(a => !a.skipped).length;
    const correct = forLevel.filter(a => a.correct && !a.skipped).length;
    const skipped = forLevel.filter(a => a.skipped).length;
    const accuracy = attempted > 0 ? correct / attempted : 0;
    const status = levelStatus(attempted, accuracy);
    const readiness = Math.round(Math.max(0, Math.min(100, accuracy * 100)));
    return { level, attempted, correct, skipped, accuracy, status, readiness };
  });
}

function levelStatus(attempted: number, accuracy: number): LevelEvidenceStatus {
  if (attempted < MIN_ATTEMPTS_FOR_STATUS) return 'unknown';
  if (accuracy >= LEVEL_STATUS_THRESHOLDS.strong) return 'strong';
  if (accuracy >= LEVEL_STATUS_THRESHOLDS.developing) return 'developing';
  if (accuracy >= LEVEL_STATUS_THRESHOLDS.emerging) return 'emerging';
  return 'not_yet';
}

/**
 * Pick the highest CEFR level that is supported by enough evidence at that
 * level AND by passing accuracy at all lower levels. This is the rule that
 * stops a single lucky C1 answer from inflating an A1 user to C1.
 */
function pickEstimatedLevel(perLevel: LevelEvidence[]): {
  estimatedLevel: CEFRLevel;
  boundary?: CEFRLevel;
  notes: string[];
} {
  const notes: string[] = [];
  let supportedThrough: CEFRLevel = 'A1';
  let boundary: CEFRLevel | undefined;

  for (let i = 0; i < CEFR_ORDER.length; i++) {
    const lvl = CEFR_ORDER[i];
    const ev = perLevel.find(p => p.level === lvl)!;
    const minOk = ev.attempted >= MIN_ATTEMPTS_FOR_STATUS;
    const pass = ev.accuracy >= LEVEL_STATUS_THRESHOLDS.developing && minOk;
    const partial = ev.accuracy >= LEVEL_STATUS_THRESHOLDS.emerging && minOk;

    if (pass) {
      supportedThrough = lvl;
      continue;
    }
    if (partial) {
      // Boundary: emerging at this level but supported through the previous.
      if (i > 0) boundary = lvl;
      notes.push(`${lvl}: emerging (${Math.round(ev.accuracy * 100)}% on ${ev.attempted} items).`);
      break;
    }
    if (!minOk) {
      notes.push(`${lvl}: not enough evidence — answer more ${lvl} items to confirm.`);
    } else {
      notes.push(`${lvl}: not yet (${Math.round(ev.accuracy * 100)}% on ${ev.attempted} items).`);
    }
    break;
  }

  return { estimatedLevel: supportedThrough, boundary, notes };
}

function computeSkillEstimates(answers: DiagnosticAnswer[]): SkillEstimate[] {
  return SCORED_SKILLS.map(skill => {
    const forSkill = answers.filter(a => a.skill === skill);
    const attempted = forSkill.filter(a => !a.skipped).length;
    const correct = forSkill.filter(a => a.correct && !a.skipped).length;
    if (attempted === 0) {
      return { skill, score: null, confidence: 'low' as PlacementConfidence, unattempted: true };
    }
    const raw = (correct / attempted) * 100;
    // Confidence penalty for low-confidence answers
    const lowConf = forSkill.filter(a => !a.skipped && a.confidence === 'low').length;
    const penalty = (lowConf / attempted) * 10;
    const score = Math.round(Math.max(0, raw - penalty));
    const confidence: PlacementConfidence = attempted >= 4 ? 'medium' : 'low';
    return { skill, score, confidence, unattempted: false };
  });
}

function computeConfidence(opts: {
  perLevel: LevelEvidence[];
  itemsAttempted: number;
  itemsSkipped: number;
  writingAttempted: boolean;
}): PlacementConfidence {
  const { perLevel, itemsAttempted, itemsSkipped } = opts;
  // Many skips → low.
  if (itemsSkipped >= 4 && itemsSkipped >= itemsAttempted / 2) return 'low';
  // Very few items attempted → low.
  if (itemsAttempted < 6) return 'low';
  // Enough A1/A2 baseline + at least one upper level with evidence → medium.
  const baselineLevels = perLevel.filter(p =>
    (p.level === 'A1' || p.level === 'A2') && p.attempted >= MIN_ATTEMPTS_FOR_STATUS
  ).length;
  const upperLevels = perLevel.filter(p =>
    (p.level === 'B1' || p.level === 'B2' || p.level === 'C1') && p.attempted >= MIN_ATTEMPTS_FOR_STATUS
  ).length;
  if (itemsAttempted >= 12 && baselineLevels >= 2 && upperLevels >= 2) return 'high';
  if (itemsAttempted >= 8 && baselineLevels >= 2) return 'medium';
  return 'low';
}

// ─── Aggregation helpers used by Dashboard/Skills ─────────────────────────

export function levelReadinessFromPlacement(
  placement: PlacementResult,
): Partial<Record<CEFRLevel, number>> {
  const out: Partial<Record<CEFRLevel, number>> = {};
  for (const ev of placement.perLevel) out[ev.level] = ev.readiness;
  return out;
}

export function skillScoresFromPlacement(
  placement: PlacementResult,
): Partial<Record<Skill, number>> {
  const out: Partial<Record<Skill, number>> = {};
  for (const s of placement.skillEstimates) {
    if (s.score !== null) out[s.skill] = s.score;
  }
  return out;
}

export function placementHeadline(p: PlacementResult): string {
  if (p.boundary) {
    return `${p.estimatedLevel}/${p.boundary} boundary`;
  }
  return p.estimatedLevel;
}
