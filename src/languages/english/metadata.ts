import type { LanguagePackMetadata } from '../../types';

export const englishMetadata: LanguagePackMetadata = {
  id: 'english',
  label: 'English',
  nativeLabel: 'English',
  cefrSupportedLevels: ['A1', 'A2', 'B1', 'B2', 'C1'],
  keyboardHelpers: false,
  defaultAccentMode: 'lenient',
  accentSensitive: false,
  examTargets: [
    { id: 'general', label: 'General CEFR' },
    { id: 'A2', label: 'A2 Key (KET)' },
    { id: 'B1', label: 'B1 Preliminary (PET)' },
    { id: 'B2', label: 'B2 First (FCE)' },
    { id: 'C1', label: 'C1 Advanced (CAE)' },
    { id: 'IELTS', label: 'IELTS prep (general)' },
    { id: 'TOEFL', label: 'TOEFL prep (general)' },
  ],
  promptCopy: {
    diagnosticIntro:
      'Adaptive placement covering articles, tense/aspect, prepositions, vocabulary, reading, and optional writing. Starts at A1 and only goes higher if your answers support it.',
    coachTagline: 'Adaptive English coach · A1 → C1',
  },
};
