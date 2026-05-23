import type { Exercise, ReadingText, WritingPromptMeta, LanguagePackMetadata } from '../../types';
import { exercises as legacySpanishExercises } from '../../data/exercises';
import { readingTexts as legacySpanishReadings } from '../../data/readingTexts';
import { writingPrompts as legacySpanishWritingPrompts } from '../../data/prompts';
import { spanishA1Exercises, spanishA2Exercises, spanishA1A2Readings, spanishA1A2WritingPrompts } from './a1a2';
import { spanishExtraExercises, spanishExtraReadings, spanishExtraWritingPrompts } from './extra';
import { spanishMetadata } from './metadata';

export interface LanguagePack {
  metadata: LanguagePackMetadata;
  exercises: Exercise[];
  readingTexts: ReadingText[];
  writingPrompts: WritingPromptMeta[];
}

const allExercises: Exercise[] = [
  ...spanishA1Exercises,
  ...spanishA2Exercises,
  ...spanishExtraExercises,
  ...legacySpanishExercises,
];

const allReadings: ReadingText[] = [
  ...spanishA1A2Readings,
  ...spanishExtraReadings,
  ...legacySpanishReadings,
];

const allWritingPrompts: WritingPromptMeta[] = [
  ...spanishA1A2WritingPrompts,
  ...spanishExtraWritingPrompts,
  ...legacySpanishWritingPrompts,
];

export const spanishPack: LanguagePack = {
  metadata: spanishMetadata,
  exercises: allExercises,
  readingTexts: allReadings,
  writingPrompts: allWritingPrompts,
};
