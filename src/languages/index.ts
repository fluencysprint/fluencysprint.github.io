import type { LanguageId, LanguagePackMetadata } from '../types';
import { spanishPack, type LanguagePack } from './spanish';
import { englishPack } from './english';

export type { LanguagePack };

const REGISTRY: Record<LanguageId, LanguagePack> = {
  spanish: spanishPack,
  english: englishPack,
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
