import type { LanguagePackMetadata } from '../../types';

export const spanishMetadata: LanguagePackMetadata = {
  id: 'spanish',
  label: 'Spanish',
  nativeLabel: 'Español',
  cefrSupportedLevels: ['A1', 'A2', 'B1', 'B2', 'C1'],
  keyboardHelpers: true,
  defaultAccentMode: 'lenient',
  accentSensitive: true,
  examTargets: [
    { id: 'general', label: 'General CEFR' },
    { id: 'A2', label: 'A2 (Plataforma)' },
    { id: 'B1', label: 'B1 (Umbral)' },
    { id: 'B2', label: 'B2' },
    { id: 'C1', label: 'C1' },
    { id: 'DELE_B2', label: 'DELE B2 prep' },
    { id: 'DELE_C1', label: 'DELE C1 prep' },
    { id: 'SIELE', label: 'SIELE prep' },
  ],
  promptCopy: {
    diagnosticIntro:
      'Quick adaptive placement across grammar, vocabulary, reading, and (optional) writing. Starts easy and only branches up if you show you are ready.',
    coachTagline: 'Adaptive Spanish coach · A1 → C1',
  },
  weaknessCategories: [
    'subjunctive', 'tense_choice', 'ser_estar', 'por_para', 'pronouns',
    'connector_misuse', 'weak_collocation', 'false_friend', 'weak_inference',
    'informal_register', 'weak_argument_structure', 'accent_error',
  ],
};
