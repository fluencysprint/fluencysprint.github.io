import type { Exercise } from '../types';

export type AuditSeverity = 'error' | 'warning';

export type AuditIssueType =
  | 'duplicate_choices'
  | 'answer_not_in_choices'
  | 'empty_explanation'
  | 'confused_explanation'
  | 'duplicate_temporal_marker'
  | 'choice_creates_duplicate'
  | 'ambiguous_tense_context'
  | 'spanish_superlative_order';

export interface AuditResult {
  id: string;
  severity: AuditSeverity;
  type: AuditIssueType;
  message: string;
  suggestedFix?: string;
}

// Exercise types that are expected to have explanations and testable answers
const OBJECTIVE_TYPES = new Set([
  'multipleChoice', 'cloze', 'connectorChoice', 'collocationChoice',
  'accentPractice', 'readingQuestion', 'sentenceTransformation', 'punctuationPractice',
]);

// Temporal/aspectual markers that must not appear twice in the same sentence
const TEMPORAL_MARKERS = [
  'yet', 'already', 'never', 'still', 'ever', 'just',
  'yesterday', 'ago', 'recently', 'lately',
];

// Markers that, if present, disambiguate tense context
const TIME_CONTEXT_MARKERS = [
  'last night', 'last week', 'last year', 'last month',
  'yesterday', 'this morning', 'tomorrow', 'tonight',
  'recently', 'just', 'already', 'never', 'always', 'usually', 'often',
  'right now', 'at the moment', 'currently', 'these days',
  'when the', 'when i ', 'when she', 'when he', 'when they',
  'if i ', 'if you ', 'if he ', 'if she ', 'if they ',
  'since ', 'for two', 'for three', 'twice', 'three times',
  'used to', 'at that time', 'in those days', 'back then',
  // Spanish
  'ayer', 'anoche', 'la semana pasada', 'el año pasado',
  'últimamente', 'ahora', 'siempre', 'nunca', 'normalmente',
  'cuando era', 'cuando tenía', 'de niño', 'de pequeña',
  'todos los días', 'cada día', 'a menudo', 'mañana',
];

const BE_VERB_CHOICES = new Set([
  'is', 'are', 'was', 'were', 'been', 'be', 'am',
  'es', 'son', 'está', 'están', 'fue', 'fueron', 'era', 'eran',
]);

const CONFUSED_PATTERNS = [/wait\s*[—-]/i, /let'?s reconsider/i];

function insertAnswer(prompt: string, answer: string): string {
  return prompt.replace(/_{2,}/, answer);
}

function hasClozeHint(prompt: string): boolean {
  // Patterns like (already / finish) or (llegar) used as instructional hints
  return /\([^)]+\/[^)]+\)/.test(prompt) || /\([a-záéíóúüñA-Z]+(?: \/ [a-záéíóúüñA-Z]+)?\)/.test(prompt);
}

function findDuplicateMarkers(sentence: string): string[] {
  const lower = sentence.toLowerCase();
  return TEMPORAL_MARKERS.filter(marker => {
    const pattern = new RegExp(`\\b${marker}\\b`, 'g');
    const matches = lower.match(pattern);
    return matches !== null && matches.length >= 2;
  });
}

export function auditExercise(exercise: Exercise): AuditResult[] {
  const results: AuditResult[] = [];
  const { id, type, prompt = '', choices, correctAnswer, explanation } = exercise;

  if (!OBJECTIVE_TYPES.has(type)) return results;

  // 1. Duplicate choices
  if (choices && choices.length !== new Set(choices).size) {
    results.push({
      id, severity: 'error', type: 'duplicate_choices',
      message: 'Choices array contains duplicate values.',
      suggestedFix: 'Replace duplicate choice with a distinct, plausible distractor.',
    });
  }

  // 2. Correct answer not in choices (multipleChoice)
  if (type === 'multipleChoice' && choices && correctAnswer) {
    if (!choices.includes(correctAnswer)) {
      results.push({
        id, severity: 'error', type: 'answer_not_in_choices',
        message: `correctAnswer "${correctAnswer}" does not appear in choices.`,
        suggestedFix: 'Add the correct answer to the choices array.',
      });
    }
  }

  // 3. Empty explanation
  if (!explanation || explanation.trim() === '') {
    results.push({
      id, severity: 'error', type: 'empty_explanation',
      message: 'Explanation field is empty.',
    });
  }

  // 4. Confused explanation
  if (explanation) {
    for (const pattern of CONFUSED_PATTERNS) {
      if (pattern.test(explanation)) {
        results.push({
          id, severity: 'error', type: 'confused_explanation',
          message: 'Explanation contains self-doubt markers ("Wait —", "Let\'s reconsider").',
          suggestedFix: 'Rewrite explanation with a clear, confident statement.',
        });
        break;
      }
    }
  }

  // 5 & 6. Duplicate temporal markers when answer is inserted (skip cloze hints)
  if (prompt && /_{2,}/.test(prompt) && !hasClozeHint(prompt)) {
    // Check correct answer
    if (correctAnswer) {
      const full = insertAnswer(prompt, correctAnswer);
      const dups = findDuplicateMarkers(full);
      for (const dup of dups) {
        results.push({
          id, severity: 'error', type: 'duplicate_temporal_marker',
          message: `Correct answer creates repeated "${dup}": "${full}"`,
          suggestedFix: `Remove "${dup}" from the prompt, or rephrase so the marker appears only once.`,
        });
      }
    }

    // Check all choices for this pattern (warning only for incorrect choices)
    for (const choice of choices ?? []) {
      const full = insertAnswer(prompt, choice);
      const dups = findDuplicateMarkers(full);
      if (dups.length > 0 && choice !== correctAnswer) {
        results.push({
          id, severity: 'warning', type: 'choice_creates_duplicate',
          message: `Choice "${choice}" creates repeated "${dups[0]}": "${full}"`,
        });
      }
    }
  }

  // 6b. Spanish superlative word order: "article + más + NOUN + adjective" is wrong
  // Correct: "article + NOUN + más + adjective"
  // Pattern: detects "el|la|los|las más <word> <word> del|de la|de los|de las"
  if (prompt && /_{2,}/.test(prompt) && correctAnswer) {
    const full = insertAnswer(prompt, correctAnswer).toLowerCase();
    if (/\b(el|la|los|las)\s+más\s+[a-záéíóúüñ]+\s+[a-záéíóúüñ]+\s+(del|de la|de los|de las)\b/.test(full)) {
      results.push({
        id, severity: 'error', type: 'spanish_superlative_order',
        message: `Wrong superlative word order: "${full}" — correct order is "noun + más + adjective".`,
        suggestedFix: 'Rewrite as "Es el [noun] _____ [adjective] del..." with correctAnswer "más".',
      });
    }
  }

  // 7. Ambiguous tense context for be-verb questions
  const isTenseQuestion =
    (exercise.mistakeCategories?.includes('tense_aspect') ||
      exercise.mistakeCategories?.includes('tense_choice')) &&
    (choices?.some(c => BE_VERB_CHOICES.has(c.toLowerCase())) ?? false);

  if (isTenseQuestion) {
    const promptLower = prompt.toLowerCase();
    const hasContext = TIME_CONTEXT_MARKERS.some(m => promptLower.includes(m));
    // Only flag if choices contain BOTH a past and a present form
    const choicesLower = (choices ?? []).map(c => c.toLowerCase());
    const PAST_FORMS = new Set(['was', 'were', 'had', 'went', 'came', 'did', 'fue', 'fueron', 'era', 'eran']);
    const PRES_FORMS = new Set(['is', 'are', 'am', 'has', 'have', 'go', 'come', 'do', 'es', 'son', 'está', 'están']);
    const hasPast = choicesLower.some(c => PAST_FORMS.has(c));
    const hasPresent = choicesLower.some(c => PRES_FORMS.has(c));
    if (hasPast && hasPresent && !hasContext) {
      results.push({
        id, severity: 'warning', type: 'ambiguous_tense_context',
        message: 'Tense question has both past and present choices but no clear temporal context.',
        suggestedFix: 'Add a time marker (e.g. "last night", "yesterday", "when X happened") to disambiguate.',
      });
    }
  }

  return results;
}

export function auditExerciseBank(exercises: Exercise[]): AuditResult[] {
  return exercises.flatMap(e => auditExercise(e));
}
