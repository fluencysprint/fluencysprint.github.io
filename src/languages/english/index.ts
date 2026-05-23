import type { LanguagePack } from '../spanish';
import { englishMetadata } from './metadata';
import { englishExercises } from './exercises';
import { englishExercises2 } from './exercises2';
import { englishReadingTexts } from './readingTexts';
import { englishReadingTexts2 } from './readingTexts2';
import { englishWritingPrompts } from './writingPrompts';
import { englishWritingPrompts2 } from './writingPrompts2';
import { englishCalibratedExercises, englishCalibratedReadings, englishCalibratedWritingPrompts } from './calibrated';

export const englishPack: LanguagePack = {
  metadata: englishMetadata,
  exercises: [...englishExercises, ...englishExercises2, ...englishCalibratedExercises],
  readingTexts: [...englishReadingTexts, ...englishReadingTexts2, ...englishCalibratedReadings],
  writingPrompts: [...englishWritingPrompts, ...englishWritingPrompts2, ...englishCalibratedWritingPrompts],
};
