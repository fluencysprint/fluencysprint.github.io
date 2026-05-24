import type { LanguagePack } from '../spanish';
import { englishMetadata } from './metadata';
import { englishExercises } from './exercises';
import { englishExercises2 } from './exercises2';
import { englishReadingTexts } from './readingTexts';
import { englishReadingTexts2 } from './readingTexts2';
import { englishWritingPrompts } from './writingPrompts';
import { englishWritingPrompts2 } from './writingPrompts2';
import { englishCalibratedExercises, englishCalibratedReadings, englishCalibratedWritingPrompts } from './calibrated';
import { englishCalibratedExercises2, englishCalibratedReadings2, englishCalibratedWritingPrompts2 } from './calibrated2';

export const englishPack: LanguagePack = {
  metadata: englishMetadata,
  exercises: [...englishExercises, ...englishExercises2, ...englishCalibratedExercises, ...englishCalibratedExercises2],
  readingTexts: [...englishReadingTexts, ...englishReadingTexts2, ...englishCalibratedReadings, ...englishCalibratedReadings2],
  writingPrompts: [...englishWritingPrompts, ...englishWritingPrompts2, ...englishCalibratedWritingPrompts, ...englishCalibratedWritingPrompts2],
};
