import type {
  CEFRLevel, LanguageId, EvidenceEvent, Skill,
  EvidenceConfidence, ReadinessBand, LevelReadiness, SkillReadiness,
  EvidenceQuality, ProficiencyEstimate,
} from '../types';
import { CEFR_ORDER, SCORED_SKILLS, SKILL_LABELS } from '../types';
import { getEvidence } from './storage';
import { getActiveProfile } from './profile';

// ─── Tunables ───────────────────────────────────────────────────────────────

/** Unseen-item thresholds that define each confidence band. */
const CONFIDENCE_THRESHOLDS: { min: number; band: EvidenceConfidence }[] = [
  { min: 40, band: 'strong' },
  { min: 20, band: 'medium' },
  { min: 10, band: 'low' },
  { min: 5, band: 'very_low' },
  { min: 0, band: 'insufficient' },
];

/** A level is "stable" — usable as a floor — at this accuracy + sample. */
const STABLE_ACCURACY = 0.7;
const STABLE_MIN_UNSEEN = 5;

/** Bayesian shrinkage constant pulling readiness toward "not ready" (0). */
const SHRINK_K = 6;

const BAND_ORDER: ReadinessBand[] = [
  'insufficient', 'early_signal', 'developing', 'likely_ready', 'strong',
];

export function confidenceForUnseen(unseen: number): EvidenceConfidence {
  for (const t of CONFIDENCE_THRESHOLDS) if (unseen >= t.min) return t.band;
  return 'insufficient';
}

function capBand(band: ReadinessBand, cap: ReadinessBand): ReadinessBand {
  return BAND_ORDER.indexOf(band) <= BAND_ORDER.indexOf(cap) ? band : cap;
}

/** The strongest band a given unseen-sample size can justify. */
function sampleCap(unseen: number): ReadinessBand {
  if (unseen < 5) return 'insufficient';
  if (unseen < 10) return 'early_signal';
  if (unseen < 20) return 'likely_ready';
  return 'strong';
}

function rawBand(unseen: number, accuracy: number): ReadinessBand {
  if (unseen < 5) return 'insufficient';
  const base: ReadinessBand =
    accuracy >= 0.85 ? 'strong'
      : accuracy >= 0.75 ? 'likely_ready'
        : accuracy >= 0.55 ? 'developing'
          : 'early_signal';
  return capBand(base, sampleCap(unseen));
}

// ─── Per-event classification ───────────────────────────────────────────────

function isObjective(e: EvidenceEvent): boolean {
  return e.scoringMode === 'objective';
}

/** First-attempt, objective, non-skipped item — the gold standard evidence. */
function isUnseenCalibrated(e: EvidenceEvent): boolean {
  return isObjective(e) && e.firstAttempt && !e.skipped && !e.isReview;
}

// ─── Main estimator ─────────────────────────────────────────────────────────

export function estimateProficiency(
  language: LanguageId,
  allEvidence: EvidenceEvent[],
): ProficiencyEstimate {
  const evidence = allEvidence.filter(e => e.languageId === language);

  const readinessByLevel = computeLevelReadiness(evidence);
  applyGating(readinessByLevel);
  const readinessBySkill = computeSkillReadiness(evidence);
  const evidenceQuality = computeEvidenceQuality(evidence, readinessByLevel);

  const { estimate, boundary } = pickEstimate(readinessByLevel);
  const estLevel = readinessByLevel.find(l => l.level === estimate)!;
  const estimateConfidence = estLevel.unseenItems >= STABLE_MIN_UNSEEN
    ? estLevel.confidence
    : evidenceQuality.latestConfidence;

  const ci = CEFR_ORDER.indexOf(estimate);
  const nextTarget = ci < CEFR_ORDER.length - 1 ? CEFR_ORDER[ci + 1] : null;

  const bottlenecks = computeBottlenecks(readinessByLevel, readinessBySkill);
  const evidenceWarnings = computeWarnings(evidence, readinessByLevel, evidenceQuality);
  const recommendedNextActions = computeActions(
    readinessByLevel, readinessBySkill, evidenceQuality, estimate, nextTarget,
  );

  return {
    language,
    currentEstimate: estimate,
    boundary,
    estimateConfidence,
    nextTarget,
    readinessByLevel,
    readinessBySkill,
    bottlenecks,
    evidenceWarnings,
    recommendedNextActions,
    evidenceQuality,
  };
}

function computeLevelReadiness(evidence: EvidenceEvent[]): LevelReadiness[] {
  return CEFR_ORDER.map(level => {
    const atLevel = evidence.filter(e => e.cefrLevel === level && !e.skipped);
    // Weighted accuracy uses each event's evidenceWeight (repeats/legacy small).
    let weightedEvidence = 0;
    let weightedCorrect = 0;
    for (const e of atLevel) {
      if (e.evidenceWeight <= 0) continue;
      weightedEvidence += e.evidenceWeight;
      if (e.correct) weightedCorrect += e.evidenceWeight;
    }
    const accuracyWeighted = weightedEvidence > 0 ? weightedCorrect / weightedEvidence : 0;
    const unseenItems = atLevel.filter(isUnseenCalibrated).length;
    const repeatedItems = atLevel.filter(e => e.isRepeat).length;
    const confidence = confidenceForUnseen(unseenItems);

    // Conservative, confidence-shrunk readiness: little evidence → low number.
    const readiness = Math.round(
      accuracyWeighted * (weightedEvidence / (weightedEvidence + SHRINK_K)) * 100,
    );
    const band = rawBand(unseenItems, accuracyWeighted);

    return {
      level, readiness, band, confidence,
      unseenItems, repeatedItems, weightedEvidence, accuracyWeighted,
    };
  });
}

/**
 * Lower-level instability caps higher levels. Contradicting weak evidence at a
 * lower level forces higher levels down to "early signal"; merely-insufficient
 * lower evidence prevents "likely ready"/"strong".
 */
function applyGating(levels: LevelReadiness[]): void {
  for (let i = 1; i < levels.length; i++) {
    const lvl = levels[i];
    if (lvl.band === 'insufficient') continue;
    for (let j = 0; j < i; j++) {
      const lower = levels[j];
      const lowerStable = lower.unseenItems >= STABLE_MIN_UNSEEN
        && lower.accuracyWeighted >= STABLE_ACCURACY;
      if (lowerStable) continue;
      const contradicts = lower.unseenItems >= 3 && lower.accuracyWeighted < STABLE_ACCURACY;
      const cap: ReadinessBand = contradicts ? 'early_signal' : 'developing';
      if (BAND_ORDER.indexOf(lvl.band) > BAND_ORDER.indexOf(cap)) {
        lvl.band = cap;
        lvl.gatedBy = lower.level;
        // Reflect the cap numerically too so the UI ring matches the label.
        if (contradicts) lvl.readiness = Math.min(lvl.readiness, 45);
        else lvl.readiness = Math.min(lvl.readiness, 70);
      }
    }
  }
}

function pickEstimate(levels: LevelReadiness[]): { estimate: CEFRLevel; boundary?: CEFRLevel } {
  let supportedThrough: CEFRLevel = 'A1';
  let boundary: CEFRLevel | undefined;
  for (let i = 0; i < levels.length; i++) {
    const ev = levels[i];
    const stable = ev.unseenItems >= STABLE_MIN_UNSEEN && ev.accuracyWeighted >= STABLE_ACCURACY;
    if (stable && !ev.gatedBy) {
      supportedThrough = ev.level;
      continue;
    }
    // Emerging but not stable → mark a boundary above the supported floor.
    if (ev.unseenItems >= STABLE_MIN_UNSEEN && ev.accuracyWeighted >= 0.55 && i > 0) {
      boundary = ev.level;
    }
    break;
  }
  return { estimate: supportedThrough, boundary };
}

/** Minimum weighted evidence before a skill gets a (low-confidence) score. */
const SKILL_MIN_WEIGHT = 1.5;

function computeSkillReadiness(evidence: EvidenceEvent[]): SkillReadiness[] {
  return SCORED_SKILLS.map(skill => {
    const forSkill = evidence.filter(e => e.skill === skill && !e.skipped);
    // First-attempt items (any scoring mode) — used for the displayed counts.
    const unseen = forSkill.filter(e => e.firstAttempt && !e.isReview);
    const calibratedUnseen = forSkill.filter(isUnseenCalibrated).length;
    const repeated = forSkill.filter(e => e.isRepeat);

    let wEv = 0, wCorrect = 0;
    for (const e of forSkill) {
      if (e.evidenceWeight <= 0) continue;
      wEv += e.evidenceWeight;
      if (e.correct) wCorrect += e.evidenceWeight;
    }
    // Needs enough weighted evidence — one writing sample (0.7) is not enough.
    const proficiency = wEv >= SKILL_MIN_WEIGHT
      ? Math.round((wCorrect / wEv) * 100)
      : null;

    // Practice score: raw accuracy over everything attempted (incl. repeats).
    const attemptable = forSkill.filter(e => !e.isReview);
    const practiceScore = attemptable.length > 0
      ? Math.round((attemptable.filter(e => e.correct).length / attemptable.length) * 100)
      : null;

    return {
      skill,
      proficiency,
      practiceScore,
      confidence: confidenceForUnseen(calibratedUnseen),
      unseenItems: unseen.length,
      repeatedItems: repeated.length,
    };
  });
}

function computeEvidenceQuality(
  evidence: EvidenceEvent[],
  levels: LevelReadiness[],
): EvidenceQuality {
  const unseenCalibratedItems = evidence.filter(isUnseenCalibrated).length;
  const repeatedItems = evidence.filter(e => e.isRepeat).length;
  const writingSamples = evidence.filter(
    e => e.scoringMode === 'heuristic_writing' || e.activityType === 'writing',
  ).length;
  const legacyItems = evidence.filter(e => e.scoringMode === 'legacy').length;
  const levelsWithInsufficientEvidence = levels
    .filter(l => l.unseenItems < STABLE_MIN_UNSEEN)
    .map(l => l.level);
  return {
    unseenCalibratedItems,
    repeatedItems,
    writingSamples,
    legacyItems,
    levelsWithInsufficientEvidence,
    latestConfidence: confidenceForUnseen(unseenCalibratedItems),
  };
}

function computeBottlenecks(levels: LevelReadiness[], skills: SkillReadiness[]): string[] {
  const out: string[] = [];
  for (const l of levels) {
    if (l.gatedBy) {
      out.push(`${l.level} readiness is limited by unstable ${l.gatedBy} evidence.`);
    }
  }
  const weak = skills
    .filter(s => s.proficiency !== null && s.proficiency < 65)
    .sort((a, b) => (a.proficiency ?? 0) - (b.proficiency ?? 0))
    .slice(0, 2);
  for (const s of weak) {
    out.push(`Weak ${SKILL_LABELS[s.skill].toLowerCase()} (${s.proficiency}%) is holding back higher levels.`);
  }
  return out;
}

function computeWarnings(
  evidence: EvidenceEvent[],
  levels: LevelReadiness[],
  quality: EvidenceQuality,
): string[] {
  const out: string[] = [];
  if (quality.unseenCalibratedItems < 5) {
    out.push('Not enough unseen calibrated evidence yet — estimates are provisional.');
  }
  if (quality.writingSamples === 0) {
    out.push('No writing evidence — productive-skill readiness is unavailable.');
  }
  // Memorisation risk: a level looks accurate but is mostly repeats.
  for (const l of levels) {
    if (l.repeatedItems >= 4 && l.repeatedItems > l.unseenItems * 2 && l.accuracyWeighted >= 0.8) {
      out.push(`${l.level}: high score comes mostly from repeated items — memorised-set risk, not new evidence.`);
    }
  }
  const skips = evidence.filter(e => e.skipped).length;
  if (skips >= 4 && skips > evidence.length * 0.25) {
    out.push('Many items were skipped — confidence in the estimate is reduced.');
  }
  if (quality.legacyItems > 0 && quality.unseenCalibratedItems < 10) {
    out.push('Older activity was preserved, but your level estimate now uses stricter evidence.');
  }
  return out;
}

function computeActions(
  levels: LevelReadiness[],
  skills: SkillReadiness[],
  quality: EvidenceQuality,
  estimate: CEFRLevel,
  nextTarget: CEFRLevel | null,
): string[] {
  const out: string[] = [];
  if (nextTarget) {
    const tgt = levels.find(l => l.level === nextTarget);
    if (tgt && tgt.unseenItems < 20) {
      out.push(`You need more unseen ${nextTarget} evidence — answer fresh ${nextTarget} items.`);
    }
  }
  const weakest = skills
    .filter(s => s.proficiency !== null)
    .sort((a, b) => (a.proficiency ?? 0) - (b.proficiency ?? 0))[0];
  if (weakest && (weakest.proficiency ?? 100) < 70) {
    out.push(`Practice ${SKILL_LABELS[weakest.skill].toLowerCase()} to firm up your floor.`);
  }
  if (quality.writingSamples === 0) {
    out.push('Submit a short writing sample to unlock writing readiness.');
  }
  for (const l of levels) {
    if (l.gatedBy) {
      out.push(`Stabilise ${l.gatedBy} before attempting more ${l.level} items.`);
      break;
    }
  }
  if (out.length === 0) out.push('Keep taking short, fresh sprints to broaden your evidence.');
  return out;
}

// ─── Storage-backed convenience ─────────────────────────────────────────────

export function getProficiency(): ProficiencyEstimate | null {
  const profile = getActiveProfile();
  if (!profile) return null;
  return estimateProficiency(profile.targetLanguage, getEvidence());
}

export { READINESS_BAND_LABELS, EVIDENCE_CONFIDENCE_LABELS } from '../types';
