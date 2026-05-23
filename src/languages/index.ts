import type { LanguageId, LanguagePackMetadata, Exercise } from '../types';
import { spanishPack, type LanguagePack } from './spanish';
import { englishPack } from './english';

export type { LanguagePack };

const OBJECTIVE_TYPES = new Set([
  'multipleChoice', 'cloze', 'connectorChoice', 'collocationChoice',
  'readingQuestion', 'sentenceTransformation', 'accentPractice', 'punctuationPractice',
]);

/**
 * Tag every pack item with its language and sensible calibration defaults so
 * legacy content satisfies the evidence contract without per-item edits.
 * Default family is the item's own id (unique) — only an explicit itemFamilyId
 * groups genuine near-duplicates.
 */
function normalizeExercises(exercises: Exercise[], languageId: LanguageId): Exercise[] {
  return exercises.map(e => {
    const objective = OBJECTIVE_TYPES.has(e.type);
    return {
      ...e,
      languageId,
      itemVersion: e.itemVersion ?? 1,
      itemFamilyId: e.itemFamilyId ?? e.id,
      construct: e.construct ?? (e.tags?.[0] ?? e.skill),
      examEligible: e.examEligible ?? objective,
      diagnosticEligible: e.diagnosticEligible ?? objective,
      sprintEligible: e.sprintEligible ?? (objective || e.type === 'writingPrompt'),
      reviewEligible: e.reviewEligible ?? objective,
    };
  });
}

function normalizePack(pack: LanguagePack, languageId: LanguageId): LanguagePack {
  return { ...pack, exercises: normalizeExercises(pack.exercises, languageId) };
}

const REGISTRY: Record<LanguageId, LanguagePack> = {
  spanish: normalizePack(spanishPack, 'spanish'),
  english: normalizePack(englishPack, 'english'),
};

export function getLanguagePack(id: LanguageId): LanguagePack {
  const pack = REGISTRY[id];
  if (!pack) throw new Error(`Unknown language pack: ${id}`);
  return pack;
}

export function getAllLanguageMetadata(): LanguagePackMetadata[] {
  return (Object.keys(REGISTRY) as LanguageId[]).map(id => REGISTRY[id].metadata);
}

export function isLanguageId(value: unknown): value is LanguageId {
  return value === 'spanish' || value === 'english';
}
