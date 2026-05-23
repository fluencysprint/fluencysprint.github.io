import type { LanguagePack } from '../spanish';
import { englishMetadata } from './metadata';
import { englishExercises } from './exercises';
import { englishExercises2 } from './exercises2';
import { englishReadingTexts } from './readingTexts';
import { englishReadingTexts2 } from './readingTexts2';
import { englishWritingPrompts } from './writingPrompts';
import { englishWritingPrompts2 } from './writingPrompts2';

export const englishPack: LanguagePack = {
  metadata: englishMetadata,
  exercises: [...englishExercises, ...englishExercises2],
  readingTexts: [...englishReadingTexts, ...englishReadingTexts2],
  writingPrompts: [...englishWritingPrompts, ...englishWritingPrompts2],
};
