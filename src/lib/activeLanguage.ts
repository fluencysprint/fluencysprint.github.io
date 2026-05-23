import type { LanguageId } from '../types';
import { getActiveProfile } from './profile';
import { getLanguagePack, type LanguagePack } from '../languages';

/** Default language used before any profile has been created (Spanish, for backwards compatibility). */
const DEFAULT_LANGUAGE: LanguageId = 'spanish';

export function getActiveLanguageId(): LanguageId {
  return getActiveProfile()?.targetLanguage ?? DEFAULT_LANGUAGE;
}

export function getActiveLanguagePack(): LanguagePack {
  return getLanguagePack(getActiveLanguageId());
}
