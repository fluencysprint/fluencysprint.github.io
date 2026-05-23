import type { MistakeCategory, WritingTaskType, CEFRLevel } from '../types';

export interface WritingAnalysisInput {
  text: string;
  prompt: string;
  /** Defaults to 'spanish' for backward compatibility. */
  languageId?: 'spanish' | 'english';
  cefrLevel: CEFRLevel;
  taskType: WritingTaskType;
  wordTargetMin?: number;
  wordTargetMax?: number;
  requiredElements?: string[];
}

export interface DetectedIssue {
  id: string;
  category: MistakeCategory;
  severity: 'low' | 'medium' | 'high';
  message: string;
  suggestion: string;
  matchedText?: string;
}

export interface WritingRubricScores {
  taskCompletion: number;
  grammarControl: number;
  vocabularyRange: number;
  coherence: number;
  formalRegister: number;
  connectors: number;
  accentsPunctuation: number;
}

export type EstimatedBand =
  | 'below_target'
  | 'near_target'
  | 'target_developing'
  | 'target_strong';

export interface WritingAnalysisResult {
  wordCount: number;
  sentenceCount: number;
  paragraphCount: number;
  uniqueWordRatio: number;
  score: number;
  estimatedBand: EstimatedBand;
  bandLabel: string;
  rubricScores: WritingRubricScores;
  detectedStrengths: string[];
  detectedIssues: DetectedIssue[];
  missingRequirements: string[];
  suggestedFocusAreas: MistakeCategory[];
  improvedVersion?: string;
  nextPracticeRecommendation: string;
}

// ─── tokenization ──────────────────────────────────────────────────────────

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function countSentences(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  const matches = trimmed.match(/[.!?…]+/g);
  return matches ? matches.length : 1;
}

function countParagraphs(text: string): number {
  const blocks = text
    .split(/\n\s*\n/)
    .map(b => b.trim())
    .filter(Boolean);
  return blocks.length;
}

function uniqueWordRatio(text: string): number {
  const words = text
    .toLowerCase()
    .replace(/[.,;:!?¿¡()«»"]/g, '')
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return 0;
  const unique = new Set(words);
  return unique.size / words.length;
}

// ─── shared helpers ─────────────────────────────────────────────────────────

interface Tally {
  issues: DetectedIssue[];
  strengths: string[];
  rubric: WritingRubricScores;
  focus: Set<MistakeCategory>;
}

function makeIssue(
  id: string,
  category: MistakeCategory,
  severity: 'low' | 'medium' | 'high',
  message: string,
  suggestion: string,
  matchedText?: string,
): DetectedIssue {
  return { id, category, severity, message, suggestion, matchedText };
}

function checkWordCount(text: string, min: number | undefined, max: number | undefined, tally: Tally): void {
  const wc = countWords(text);
  if (min && wc < min) {
    tally.issues.push(
      makeIssue(
        'too-short',
        'weak_argument_structure',
        wc < min * 0.5 ? 'high' : 'medium',
        `Your answer is too short (${wc} words; target ${min}–${max ?? '∞'}).`,
        `Aim for at least ${min} words. Add one more example or a development sentence.`,
      ),
    );
    tally.rubric.taskCompletion = Math.min(tally.rubric.taskCompletion, wc < min * 0.5 ? 1 : 2);
    tally.focus.add('weak_argument_structure');
  } else if (max && wc > max) {
    tally.issues.push(
      makeIssue(
        'too-long',
        'weak_argument_structure',
        'low',
        `Your answer is a little longer than the target (${wc} words; target ${min ?? 0}–${max}).`,
        'Trim repetitive ideas to stay within the word limit.',
      ),
    );
  } else if (min && max) {
    tally.strengths.push(`Word count is in range (${wc} / ${min}–${max} words).`);
  }
}

function checkLongSentences(text: string, tally: Tally, threshold = 40): void {
  const sentences = text.split(/[.!?…]+/).map(s => s.trim()).filter(Boolean);
  const tooLong = sentences.filter(s => s.split(/\s+/).length > threshold);
  if (tooLong.length > 0) {
    tally.issues.push(
      makeIssue(
        'long-sentence',
        'weak_argument_structure',
        'low',
        `${tooLong.length} sentence${tooLong.length > 1 ? 's' : ''} exceed${tooLong.length === 1 ? 's' : ''} ${threshold} words.`,
        'Break long sentences into shorter ones for clarity.',
        tooLong[0].slice(0, 80) + (tooLong[0].length > 80 ? '…' : ''),
      ),
    );
    tally.rubric.coherence = Math.max(0, tally.rubric.coherence - 1);
  }
}

function checkParagraphing(text: string, taskType: WritingTaskType, tally: Tally): void {
  const paras = countParagraphs(text);
  const wc = countWords(text);
  if (wc < 60) return;

  const needsParas = taskType === 'formal_email' || taskType === 'opinion' ||
    taskType === 'argumentative' || taskType === 'report';
  if (!needsParas) return;

  if (paras < 2) {
    tally.issues.push(
      makeIssue(
        'no-paragraphs',
        'weak_argument_structure',
        'medium',
        'Single block of text with no paragraph breaks.',
        'Break your answer into 2–3 paragraphs: opening, development, closing.',
      ),
    );
    tally.rubric.coherence = Math.max(0, tally.rubric.coherence - 1);
    tally.focus.add('weak_argument_structure');
  } else if (paras >= 2) {
    tally.strengths.push(`Answer is organized into ${paras} paragraphs.`);
    tally.rubric.coherence = Math.max(tally.rubric.coherence, 4);
  }
}

// ─── Spanish-specific lexicons ─────────────────────────────────────────────

const ES_FORMAL_GREETINGS = [
  /\bestimad[oa]s?\b/i,
  /\bdistinguid[oa]s?\b/i,
  /\bmuy se[ñn]or(?:es)?\s+m[ií]o?s?\b/i,
];

const ES_FORMAL_OPENERS = [
  /\bme dirijo a\b/i,
  /\bme pongo en contacto\b/i,
  /\ble[s]? escribo\b/i,
  /\bpor la presente\b/i,
];

const ES_FORMAL_REQUESTS = [
  /\bles? agradecer[ií]a\b/i,
  /\bquisiera (solicitar|saber|conocer|consultar)\b/i,
  /\bagradecer[ií]a\b/i,
  /\bsolicito\b/i,
  /\bdesear[ií]a\b/i,
  /\brogar[ií]a\b/i,
];

const ES_FORMAL_CLOSINGS = [
  /\batentamente\b/i,
  /\bcordialmente\b/i,
  /\bun (cordial )?saludo\b/i,
  /\breciba[n]? un (cordial )?saludo\b/i,
  /\bquedo a su disposici[oó]n\b/i,
  /\bquedo a la espera\b/i,
];

const ES_INFORMAL_RED_FLAGS: Array<{ pattern: RegExp; suggestion: string }> = [
  { pattern: /\b(hola|holaaa+|holi+)\b/i, suggestion: 'Use "Estimados/as" or "Distinguidos/as" for formal mail.' },
  { pattern: /\bbuenas\b/i, suggestion: 'Avoid "buenas" in formal mail. Use "Estimados señores".' },
  { pattern: /\bquiero saber\b/i, suggestion: 'Replace with "quisiera saber" or "agradecería conocer".' },
  { pattern: /\bdime\b/i, suggestion: 'Replace with "le agradecería que me indicara".' },
  { pattern: /\bchao\b/i, suggestion: 'Use a formal closing like "Atentamente".' },
  { pattern: /\bnos vemos\b/i, suggestion: 'Inappropriate in formal mail. Use "Quedo a su disposición".' },
  { pattern: /\bsúper\b/i, suggestion: 'Avoid colloquial intensifiers in formal writing.' },
  { pattern: /\bguay\b/i, suggestion: 'Colloquial. Replace with "interesante" or "satisfactorio".' },
  { pattern: /\bun montón\b/i, suggestion: 'Replace with "una gran cantidad" or "considerablemente".' },
  { pattern: /\boye\b/i, suggestion: 'Highly informal. Avoid in formal correspondence.' },
  { pattern: /\bgenial\b/i, suggestion: 'Colloquial. Use "excelente" or "muy satisfactorio".' },
  { pattern: /\bok\b/i, suggestion: 'Use "de acuerdo" or "conforme".' },
];

const ES_CONNECTORS_B1 = ['pero', 'porque', 'aunque', 'por eso', 'además', 'también'];
const ES_CONNECTORS_B2 = [
  'sin embargo', 'no obstante', 'por lo tanto', 'por consiguiente',
  'debido a', 'ya que', 'a pesar de', 'en cambio', 'mientras que',
  'asimismo', 'por otra parte', 'por un lado', 'por otro lado',
];
const ES_CONNECTORS_C1 = [
  'de ahí que', 'por ello', 'si bien', 'cabe destacar', 'cabe señalar',
  'en consecuencia', 'a tenor de', 'por cuanto', 'pese a que',
  'en lo que respecta', 'por mucho que',
];

const ES_ACCENT_PAIRS: Array<{ wrong: RegExp; correct: string; reason: string }> = [
  { wrong: /\binformacion\b/gi, correct: 'información', reason: '-ción always carries an accent.' },
  { wrong: /\beducacion\b/gi, correct: 'educación', reason: '-ción always takes an accent.' },
  { wrong: /\badministracion\b/gi, correct: 'administración', reason: '-ción always takes an accent.' },
  { wrong: /\borganizacion\b/gi, correct: 'organización', reason: '-ción always takes an accent.' },
  { wrong: /\bcomunicacion\b/gi, correct: 'comunicación', reason: '-ción always takes an accent.' },
  { wrong: /\bpoblacion\b/gi, correct: 'población', reason: '-ción always takes an accent.' },
  { wrong: /\bdigitalizacion\b/gi, correct: 'digitalización', reason: '-ción always takes an accent.' },
  { wrong: /\bsituacion\b/gi, correct: 'situación', reason: '-ción always takes an accent.' },
  { wrong: /\batencion\b/gi, correct: 'atención', reason: '-ción always takes an accent.' },
  { wrong: /\brazon\b/gi, correct: 'razón', reason: '-zón takes an accent on the o.' },
  { wrong: /\bcorazon\b/gi, correct: 'corazón', reason: '-zón takes an accent on the o.' },
  { wrong: /\bespanol\b/gi, correct: 'español', reason: 'Missing tilde on the ñ.' },
  { wrong: /\bcompania\b/gi, correct: 'compañía', reason: 'Missing tilde on the ñ and accent.' },
  { wrong: /\bsenor\b/gi, correct: 'señor', reason: 'Missing tilde on the ñ.' },
  { wrong: /\bsenores\b/gi, correct: 'señores', reason: 'Missing tilde on the ñ.' },
  { wrong: /\bsenora\b/gi, correct: 'señora', reason: 'Missing tilde on the ñ.' },
  { wrong: /\banos\b/gi, correct: 'años', reason: 'Missing tilde on the ñ.' },
  { wrong: /\bmanana\b/gi, correct: 'mañana', reason: 'Missing tilde on the ñ.' },
  { wrong: /\bpractico\b/gi, correct: 'práctico', reason: 'Esdrújulas always take an accent.' },
  { wrong: /\bpracticas\b/gi, correct: 'prácticas', reason: 'Esdrújulas always take an accent.' },
  { wrong: /\butil\b/gi, correct: 'útil', reason: 'Llana ending in consonant other than n/s — accent required.' },
  { wrong: /\bfacil\b/gi, correct: 'fácil', reason: 'Same rule — accent required.' },
  { wrong: /\bdificil\b/gi, correct: 'difícil', reason: 'Same rule — accent required.' },
  { wrong: /\binteres\b/gi, correct: 'interés', reason: 'Aguda ending in -s — accent required.' },
];

const ES_VAGUE_NOUNS = ['cosa', 'cosas', 'gente', 'algo', 'esto', 'eso', 'aquello'];

// English intruders in Spanish text (only used for Spanish analysis)
const ES_COMMON_ENGLISH_INTRUDERS = [
  /\b(the|and|but|because|so that|without|from|that|this)\b/i,
  /\b(will|would|should|could)\b/i,
  /\b(actually|finally|however|moreover|therefore)\b/i,
];

// ─── English-specific lexicons ──────────────────────────────────────────────

const EN_FORMAL_GREETINGS = [
  /\bdear\s+(sir|madam|mr\.|ms\.|mrs\.|dr\.)/i,
  /\bto whom it may concern\b/i,
  /\bdear\s+(sir or madam|hiring manager|team)\b/i,
];

const EN_FORMAL_OPENERS = [
  /\bi am writing (to|regarding|with regard to|in connection with)\b/i,
  /\bi am contacting you\b/i,
  /\bi would like to (enquire|inquire|book|request|inform)\b/i,
];

const EN_FORMAL_REQUESTS = [
  /\bcould you (please|kindly)\b/i,
  /\bwould you (be able to|mind)\b/i,
  /\bi would (appreciate|be grateful)\b/i,
  /\bplease (let me know|advise|confirm)\b/i,
  /\bi am writing to (request|enquire|inform|confirm)\b/i,
];

const EN_FORMAL_CLOSINGS = [
  /\byours (sincerely|faithfully|truly)\b/i,
  /\bbest (regards|wishes)\b/i,
  /\bkind regards\b/i,
  /\bi look forward to (hearing|your reply|your response)\b/i,
];

const EN_INFORMAL_FLAGS: Array<{ pattern: RegExp; suggestion: string }> = [
  { pattern: /\bheya?\b/i, suggestion: 'Use "Dear Sir/Madam" or "Hello" for formal emails.' },
  { pattern: /\bwanna\b/i, suggestion: 'Use "want to" in formal writing.' },
  { pattern: /\bgonna\b/i, suggestion: 'Use "going to" in formal writing.' },
  { pattern: /\bkinda\b/i, suggestion: 'Use "somewhat" or "rather" in formal writing.' },
  { pattern: /\bcheers\b/i, suggestion: 'Use "Best regards" or "Yours sincerely" as a closing.' },
  { pattern: /\bthx\b/i, suggestion: 'Write "Thank you" in full in formal email.' },
  { pattern: /\btbh\b/i, suggestion: 'Avoid abbreviations in formal writing.' },
  { pattern: /\bomg\b/i, suggestion: 'Avoid informal abbreviations in formal writing.' },
  { pattern: /\blol\b/i, suggestion: 'Avoid informal abbreviations in formal writing.' },
];

// ─── English register-rewrite lexicons ──────────────────────────────────────

const EN_REWRITE_FORMAL_VOCAB: RegExp[] = [
  /\bposition\b/i,
  /\brole\b/i,
  /\bopportunity\b/i,
  /\bvacancy\b/i,
  /\bpost\b/i,
];

const EN_REWRITE_POLITE_REQUEST: RegExp[] = [
  /\bcould you (please )?(provide|give|send|share|clarify|inform|advise|tell)\b/i,
  /\bwould you (be able to |please )?(provide|give|send|share|clarify|inform|advise)\b/i,
  /\bplease (provide|give|send|share|clarify|inform|advise|let me know)\b/i,
  /\bi would (like to |appreciate |be grateful (for |if ))\b/i,
  /\bi am writing to (enquire|request|ask|find out|seek)\b/i,
];

const EN_REWRITE_POLITE_GREETING: RegExp[] = [
  /\bdear\b/i,
  /\bhello\b/i,
  /\bgood (morning|afternoon|evening)\b/i,
  /\bto whom it may concern\b/i,
];

const EN_CONNECTORS_A1A2 = ['and', 'but', 'because', 'also', 'then', 'so', 'or'];
const EN_CONNECTORS_B1B2 = [
  'however', 'although', 'therefore', 'in addition', 'on the other hand',
  'as a result', 'furthermore', 'despite', 'even though', 'while',
  'in contrast', 'consequently',
];
const EN_CONNECTORS_C1 = [
  'nevertheless', 'consequently', 'whereas', 'notwithstanding', 'moreover',
  'in light of this', 'that said', 'inasmuch as', 'to that end',
];

// ─── Spanish analyzers ─────────────────────────────────────────────────────

function checkFormalEmailSpanish(text: string, tally: Tally): void {
  const lower = text.toLowerCase();
  const firstLine = text.trim().split(/\n/)[0] ?? '';
  const lastLines = text.trim().split(/\n/).slice(-3).join(' ');

  const hasGreeting = ES_FORMAL_GREETINGS.some(r => r.test(firstLine)) ||
    ES_FORMAL_GREETINGS.some(r => r.test(lower));
  const hasOpener = ES_FORMAL_OPENERS.some(r => r.test(lower));
  const hasRequest = ES_FORMAL_REQUESTS.some(r => r.test(lower));
  const hasClosing = ES_FORMAL_CLOSINGS.some(r => r.test(lastLines)) ||
    ES_FORMAL_CLOSINGS.some(r => r.test(lower));

  if (!hasGreeting) {
    tally.issues.push(makeIssue('no-formal-greeting', 'informal_register', 'high',
      'No formal salutation detected.',
      'Open with "Estimados señores," / "Estimado/a [cargo]," for formal mail.',
    ));
    tally.rubric.formalRegister = Math.min(tally.rubric.formalRegister, 2);
    tally.focus.add('informal_register');
  } else {
    tally.strengths.push('Uses a formal salutation.');
    tally.rubric.formalRegister = Math.max(tally.rubric.formalRegister, 3);
  }
  if (hasOpener) {
    tally.strengths.push('Uses a formal opening formula.');
    tally.rubric.formalRegister = Math.min(5, tally.rubric.formalRegister + 1);
  }
  if (!hasRequest) {
    tally.issues.push(makeIssue('no-formal-request', 'informal_register', 'medium',
      'No formal request phrasing detected.',
      'Use phrases like "Les agradecería que…", "Quisiera solicitar…"',
    ));
    tally.focus.add('informal_register');
  } else {
    tally.strengths.push('Frames requests with formal phrasing.');
  }
  if (!hasClosing) {
    tally.issues.push(makeIssue('no-formal-closing', 'informal_register', 'high',
      'No formal closing detected.',
      'Close with "Atentamente," / "Cordialmente," / "Quedo a su disposición."',
    ));
    tally.rubric.formalRegister = Math.min(tally.rubric.formalRegister, 2);
    tally.focus.add('informal_register');
  } else {
    tally.strengths.push('Uses a formal closing.');
    tally.rubric.formalRegister = Math.max(tally.rubric.formalRegister, 4);
  }
}

function checkInformalFlagsSpanish(text: string, taskType: WritingTaskType, tally: Tally): void {
  const isFormal = taskType === 'formal_email' || taskType === 'argumentative' ||
    taskType === 'report' || taskType === 'register_rewrite';
  if (!isFormal) return;
  const found: string[] = [];
  for (const { pattern, suggestion } of ES_INFORMAL_RED_FLAGS) {
    const m = text.match(pattern);
    if (m) {
      found.push(m[0]);
      tally.issues.push(makeIssue(`informal-${m[0].toLowerCase()}`, 'informal_register', 'medium',
        `Informal expression: "${m[0]}".`, suggestion, m[0],
      ));
    }
  }
  if (found.length > 0) {
    tally.rubric.formalRegister = Math.max(0, tally.rubric.formalRegister - Math.min(3, found.length));
    tally.focus.add('informal_register');
  } else {
    tally.strengths.push('No obvious informal expressions detected.');
  }
}

function hasConnector(text: string, connector: string): boolean {
  const escaped = connector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(^|[\\s,;:.()])${escaped}(?=[\\s,;:.()]|$)`, 'i');
  return re.test(text);
}

function checkConnectorsSpanish(text: string, cefrLevel: CEFRLevel, tally: Tally): void {
  const b1Hits = ES_CONNECTORS_B1.filter(c => hasConnector(text, c)).length;
  const b2Hits = ES_CONNECTORS_B2.filter(c => hasConnector(text, c)).length;
  const c1Hits = ES_CONNECTORS_C1.filter(c => hasConnector(text, c)).length;
  const totalHits = b1Hits + b2Hits + c1Hits;

  if (totalHits === 0 && countWords(text) > 40) {
    tally.issues.push(makeIssue('no-connectors', 'connector_misuse', 'high',
      'No discourse connectors detected.',
      'Add connectors such as "sin embargo", "además", "por consiguiente", "no obstante".',
    ));
    tally.rubric.connectors = 1;
    tally.rubric.coherence = Math.min(tally.rubric.coherence, 2);
    tally.focus.add('connector_misuse');
  } else if (totalHits >= 4 && (cefrLevel === 'B2' || cefrLevel === 'C1') && b2Hits + c1Hits >= 2) {
    tally.strengths.push(`Good range of connectors (${totalHits} found, including B2/C1 level).`);
    tally.rubric.connectors = 5;
  } else if (totalHits >= 2) {
    tally.strengths.push(`Uses connectors to link ideas (${totalHits} found).`);
    tally.rubric.connectors = Math.max(4, tally.rubric.connectors);
  } else if (totalHits >= 1) {
    tally.rubric.connectors = Math.max(3, tally.rubric.connectors);
  } else {
    tally.rubric.connectors = 2;
    tally.focus.add('connector_misuse');
  }

  if (cefrLevel === 'C1' && c1Hits === 0 && countWords(text) > 80) {
    tally.issues.push(makeIssue('no-c1-connectors', 'connector_misuse', 'medium',
      'No C1-level connectors used.',
      'For C1 writing, try: "de ahí que + subjunctive", "si bien", "cabe destacar", "en consecuencia".',
    ));
    tally.focus.add('connector_misuse');
  }
}

function checkAccentsSpanish(text: string, tally: Tally): void {
  let count = 0;
  const seen = new Set<string>();
  for (const { wrong, correct, reason } of ES_ACCENT_PAIRS) {
    const matches = text.match(wrong);
    if (matches) {
      for (const m of matches) {
        const lowered = m.toLowerCase();
        if (seen.has(lowered)) continue;
        seen.add(lowered);
        count++;
        tally.issues.push(makeIssue(`accent-${lowered}`, 'accent_error', 'low',
          `Likely missing accent: "${m}" → "${correct}".`, reason, m,
        ));
      }
    }
  }
  if (count === 0) {
    tally.strengths.push('No common accent omissions detected.');
    tally.rubric.accentsPunctuation = Math.max(4, tally.rubric.accentsPunctuation);
  } else {
    tally.rubric.accentsPunctuation = Math.max(0, 4 - count);
    tally.focus.add('accent_error');
  }
}

function checkPunctuationSpanish(text: string, tally: Tally): void {
  const questionMarks = (text.match(/\?/g) || []).length;
  const openMarks = (text.match(/¿/g) || []).length;
  if (questionMarks > openMarks) {
    tally.issues.push(makeIssue('missing-open-question', 'punctuation_error', 'low',
      `Missing opening "¿" — ${questionMarks - openMarks} question(s) lack it.`,
      'In Spanish, every "?" must be preceded by "¿" at the start of the question.',
    ));
    tally.rubric.accentsPunctuation = Math.max(0, tally.rubric.accentsPunctuation - 1);
    tally.focus.add('punctuation_error');
  }
  const excMarks = (text.match(/!/g) || []).length;
  const openExc = (text.match(/¡/g) || []).length;
  if (excMarks > openExc) {
    tally.issues.push(makeIssue('missing-open-exclamation', 'punctuation_error', 'low',
      `Missing opening "¡" — ${excMarks - openExc} exclamation(s) lack it.`,
      'In Spanish, every "!" must be preceded by "¡".',
    ));
    tally.rubric.accentsPunctuation = Math.max(0, tally.rubric.accentsPunctuation - 1);
    tally.focus.add('punctuation_error');
  }
  if (/\s{2,}/.test(text)) {
    tally.issues.push(makeIssue('double-space', 'spelling', 'low', 'Repeated spaces detected.', 'Use single spaces between words.'));
  }
  if (/\.\s+[a-záéíóúñ]/.test(text)) {
    tally.issues.push(makeIssue('lowercase-after-period', 'punctuation_error', 'low',
      'A sentence starts with a lowercase letter after a period.',
      'Capitalize the first letter of each sentence.',
    ));
    tally.rubric.accentsPunctuation = Math.max(0, tally.rubric.accentsPunctuation - 1);
  }
}

function checkEnglishIntrudersSpanish(text: string, tally: Tally): void {
  for (const re of ES_COMMON_ENGLISH_INTRUDERS) {
    const m = text.match(re);
    if (m) {
      tally.issues.push(makeIssue(`english-${m[0].toLowerCase()}`, 'literal_translation', 'medium',
        `Possible English word in Spanish text: "${m[0]}".`,
        'Translate this phrase into Spanish.',
        m[0],
      ));
      tally.focus.add('literal_translation');
      tally.rubric.vocabularyRange = Math.max(0, tally.rubric.vocabularyRange - 1);
    }
  }
}

function checkVagueLanguageSpanish(text: string, taskType: WritingTaskType, tally: Tally): void {
  if (taskType !== 'argumentative' && taskType !== 'opinion' && taskType !== 'report') return;
  const lower = text.toLowerCase();
  const vagueCount = ES_VAGUE_NOUNS.reduce((sum, w) => {
    const m = lower.match(new RegExp(`\\b${w}\\b`, 'g'));
    return sum + (m ? m.length : 0);
  }, 0);
  if (vagueCount >= 3) {
    tally.issues.push(makeIssue('vague-language', 'weak_collocation', 'medium',
      `Vague nouns used ${vagueCount} times ("cosa", "gente", "algo"…).`,
      'For C1-level writing, replace vague nouns with precise terms: "asunto", "fenómeno", "individuos".',
    ));
    tally.rubric.vocabularyRange = Math.max(0, tally.rubric.vocabularyRange - 1);
    tally.focus.add('weak_collocation');
  }
}

function checkVocabularyRangeSpanish(text: string, cefrLevel: CEFRLevel, tally: Tally): void {
  const ratio = uniqueWordRatio(text);
  const wc = countWords(text);
  if (wc < 30) return;
  if (cefrLevel === 'C1' || cefrLevel === 'B2') {
    if (ratio < 0.5) {
      tally.issues.push(makeIssue('low-vocabulary-range', 'weak_collocation', 'low',
        'Low vocabulary variety — many words are repeated.',
        'Vary your vocabulary with synonyms and more precise academic terms.',
      ));
      tally.rubric.vocabularyRange = Math.max(0, tally.rubric.vocabularyRange - 1);
    } else if (ratio >= 0.65) {
      tally.strengths.push('Good vocabulary variety.');
      tally.rubric.vocabularyRange = Math.min(5, tally.rubric.vocabularyRange + 1);
    }
  }
}

// ─── English analyzers ─────────────────────────────────────────────────────

function checkFormalEmailEnglish(text: string, tally: Tally): void {
  const lower = text.toLowerCase();
  const firstLine = text.trim().split(/\n/)[0] ?? '';
  const lastLines = text.trim().split(/\n/).slice(-3).join(' ');

  const hasGreeting = EN_FORMAL_GREETINGS.some(r => r.test(firstLine)) ||
    EN_FORMAL_GREETINGS.some(r => r.test(lower));
  const hasOpener = EN_FORMAL_OPENERS.some(r => r.test(lower));
  const hasRequest = EN_FORMAL_REQUESTS.some(r => r.test(lower));
  const hasClosing = EN_FORMAL_CLOSINGS.some(r => r.test(lastLines)) ||
    EN_FORMAL_CLOSINGS.some(r => r.test(lower));

  if (!hasGreeting) {
    tally.issues.push(makeIssue('no-formal-greeting', 'informal_register', 'high',
      'No formal salutation detected.',
      'Open with "Dear Sir or Madam," / "Dear [Title Last Name]," for formal email.',
    ));
    tally.rubric.formalRegister = Math.min(tally.rubric.formalRegister, 2);
    tally.focus.add('informal_register');
  } else {
    tally.strengths.push('Uses a formal salutation.');
    tally.rubric.formalRegister = Math.max(tally.rubric.formalRegister, 3);
  }
  if (hasOpener) {
    tally.strengths.push('Uses a formal opening formula.');
    tally.rubric.formalRegister = Math.min(5, tally.rubric.formalRegister + 1);
  }
  if (!hasRequest) {
    tally.issues.push(makeIssue('no-formal-request', 'informal_register', 'medium',
      'No formal request phrasing detected.',
      'Use phrases like "Could you please…", "I would appreciate it if…", "I am writing to enquire…"',
    ));
    tally.focus.add('informal_register');
  } else {
    tally.strengths.push('Frames requests politely.');
  }
  if (!hasClosing) {
    tally.issues.push(makeIssue('no-formal-closing', 'informal_register', 'high',
      'No formal closing detected.',
      'Close with "Yours sincerely," / "Best regards," / "I look forward to hearing from you."',
    ));
    tally.rubric.formalRegister = Math.min(tally.rubric.formalRegister, 2);
    tally.focus.add('informal_register');
  } else {
    tally.strengths.push('Uses a formal closing.');
    tally.rubric.formalRegister = Math.max(tally.rubric.formalRegister, 4);
  }
}

function checkInformalFlagsEnglish(text: string, taskType: WritingTaskType, tally: Tally): void {
  const isFormal = taskType === 'formal_email' || taskType === 'argumentative' ||
    taskType === 'report' || taskType === 'register_rewrite';
  if (!isFormal) return;
  const found: string[] = [];
  for (const { pattern, suggestion } of EN_INFORMAL_FLAGS) {
    const m = text.match(pattern);
    if (m) {
      found.push(m[0]);
      tally.issues.push(makeIssue(`informal-${m[0].toLowerCase()}`, 'informal_register', 'medium',
        `Informal expression: "${m[0]}".`, suggestion, m[0],
      ));
    }
  }
  if (found.length > 0) {
    tally.rubric.formalRegister = Math.max(0, tally.rubric.formalRegister - Math.min(3, found.length));
    tally.focus.add('informal_register');
  } else if (isFormal) {
    tally.strengths.push('No obvious informal expressions detected.');
  }
}

function checkConnectorsEnglish(text: string, cefrLevel: CEFRLevel, tally: Tally): void {
  const lower = text.toLowerCase();
  const isA1A2 = cefrLevel === 'A1' || cefrLevel === 'A2';

  const a1a2Hits = EN_CONNECTORS_A1A2.filter(c => hasConnector(lower, c)).length;
  const b1b2Hits = EN_CONNECTORS_B1B2.filter(c => {
    const escaped = c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(escaped, 'i').test(text);
  }).length;
  const c1Hits = EN_CONNECTORS_C1.filter(c => {
    const escaped = c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(escaped, 'i').test(text);
  }).length;

  const wc = countWords(text);
  if (wc < 40) { tally.rubric.connectors = 4; return; }

  if (isA1A2) {
    // For A1/A2, basic connectors like "and", "but", "because" are sufficient.
    if (a1a2Hits >= 1) {
      tally.strengths.push(`Uses basic connectors (${a1a2Hits} found).`);
      tally.rubric.connectors = Math.max(4, tally.rubric.connectors);
    } else {
      tally.issues.push(makeIssue('no-connectors', 'connector_misuse', 'low',
        'No connecting words detected.',
        'Link ideas with simple connectors: "and", "but", "because", "also".',
      ));
      tally.rubric.connectors = 2;
    }
    return;
  }

  const total = a1a2Hits + b1b2Hits + c1Hits;
  if (total === 0 && wc > 40) {
    tally.issues.push(makeIssue('no-connectors', 'connector_misuse', 'high',
      'No discourse connectors detected.',
      'Link ideas with connectors: "however", "although", "therefore", "in addition", "as a result".',
    ));
    tally.rubric.connectors = 1;
    tally.rubric.coherence = Math.min(tally.rubric.coherence, 2);
    tally.focus.add('connector_misuse');
  } else if (total >= 4 && (cefrLevel === 'B2' || cefrLevel === 'C1') && b1b2Hits + c1Hits >= 2) {
    tally.strengths.push(`Good range of connectors (${total} found, including advanced level).`);
    tally.rubric.connectors = 5;
  } else if (total >= 2) {
    tally.strengths.push(`Uses connectors to link ideas (${total} found).`);
    tally.rubric.connectors = Math.max(4, tally.rubric.connectors);
  } else if (total >= 1) {
    tally.rubric.connectors = Math.max(3, tally.rubric.connectors);
  } else {
    tally.rubric.connectors = 2;
  }

  if (cefrLevel === 'C1' && c1Hits === 0 && wc > 80) {
    tally.issues.push(makeIssue('no-c1-connectors', 'connector_misuse', 'medium',
      'No C1-level connectors used.',
      'For C1 writing, try: "nevertheless", "consequently", "whereas", "notwithstanding", "that said".',
    ));
    tally.focus.add('connector_misuse');
  }
}

function checkPunctuationEnglish(text: string, tally: Tally): void {
  if (/\s{2,}/.test(text)) {
    tally.issues.push(makeIssue('double-space', 'spelling', 'low',
      'Repeated spaces detected.',
      'Use single spaces between words.',
    ));
  }

  // Check for missing capital "I" (standalone)
  if (/(?<!\w)i(?!\w)/.test(text)) {
    tally.issues.push(makeIssue('lowercase-i', 'punctuation_error', 'low',
      'Lowercase "i" found where "I" is expected.',
      'Always capitalize the pronoun "I" in English.',
    ));
    tally.rubric.accentsPunctuation = Math.max(0, tally.rubric.accentsPunctuation - 1);
    tally.focus.add('punctuation_error');
  }

  // Sentence starting with lowercase after period (English)
  if (/\.\s+[a-z]/.test(text)) {
    tally.issues.push(makeIssue('lowercase-after-period', 'punctuation_error', 'low',
      'A sentence appears to start with a lowercase letter after a period.',
      'Capitalize the first letter of each sentence.',
    ));
    tally.rubric.accentsPunctuation = Math.max(0, tally.rubric.accentsPunctuation - 1);
    tally.focus.add('punctuation_error');
  }
}

function checkGrammarEnglish(text: string, cefrLevel: CEFRLevel, tally: Tally): void {
  // "I work ... since [year/month]" → should be "I have worked ... since"
  const workSince = /\b(i|she|he|we|they)\s+(work|live|study|play|teach|run|own|manage)\s+[^.!?]*since\b/i;
  if (workSince.test(text)) {
    tally.issues.push(makeIssue('present-since-grammar', 'tense_aspect', 'low',
      'Possible tense issue: simple present + "since" usually requires present perfect in English.',
      'Try: "I have worked there since 2020" / "I have lived here since March" / "I started working there in 2020".',
    ));
    tally.focus.add('tense_aspect');
  }

  // "I am ... since" → should be "I have been ... since"
  const amSince = /\b(i|she|he|we|they)\s+(am|is|are)\s+[^.!?]*since\b/i;
  if (amSince.test(text) && !workSince.test(text)) {
    tally.issues.push(makeIssue('present-be-since-grammar', 'tense_aspect', 'low',
      'Possible tense issue: "am/is/are" + "since" may need present perfect continuous.',
      'Try: "I have been working here since 2020" / "I have been living here since March".',
    ));
    tally.focus.add('tense_aspect');
  }

  // Very long sentences for A1 level
  if (cefrLevel === 'A1' || cefrLevel === 'A2') {
    const sentences = text.split(/[.!?…]+/).map(s => s.trim()).filter(Boolean);
    const tooLong = sentences.filter(s => s.split(/\s+/).length > 25);
    if (tooLong.length >= 2) {
      tally.issues.push(makeIssue('long-for-level', 'weak_argument_structure', 'low',
        `Some sentences are quite long for ${cefrLevel} level.`,
        'At A1/A2 level, shorter and clearer sentences work best.',
      ));
    }
  }
}

function checkVocabularyRangeEnglish(text: string, cefrLevel: CEFRLevel, tally: Tally): void {
  const ratio = uniqueWordRatio(text);
  const wc = countWords(text);
  if (wc < 30) return;
  if (cefrLevel === 'C1' || cefrLevel === 'B2') {
    if (ratio < 0.5) {
      tally.issues.push(makeIssue('low-vocabulary-range', 'collocation_en', 'low',
        'Low vocabulary variety — many words are repeated.',
        'Vary your vocabulary with synonyms and more precise terms.',
      ));
      tally.rubric.vocabularyRange = Math.max(0, tally.rubric.vocabularyRange - 1);
    } else if (ratio >= 0.65) {
      tally.strengths.push('Good vocabulary variety.');
      tally.rubric.vocabularyRange = Math.min(5, tally.rubric.vocabularyRange + 1);
    }
  }
}

// ─── English register-rewrite analyzer ─────────────────────────────────────

function checkRegisterRewriteEnglish(text: string, tally: Tally): void {
  const hasFormalVocab = EN_REWRITE_FORMAL_VOCAB.some(r => r.test(text));
  if (hasFormalVocab) {
    tally.strengths.push('Uses a precise formal noun ("position", "role", or similar).');
    tally.rubric.vocabularyRange = Math.min(5, tally.rubric.vocabularyRange + 1);
    tally.rubric.taskCompletion = Math.min(5, tally.rubric.taskCompletion + 1);
  } else {
    tally.issues.push(makeIssue('rewrite-vague-noun', 'weak_collocation', 'medium',
      'Replace the vague "job thing" with a precise formal noun.',
      'Use "the position", "the role", "the vacancy", or "the opportunity".',
    ));
    tally.rubric.vocabularyRange = Math.max(0, tally.rubric.vocabularyRange - 1);
    tally.rubric.taskCompletion = Math.max(0, tally.rubric.taskCompletion - 1);
    tally.focus.add('weak_collocation');
  }

  const hasPoliteRequest = EN_REWRITE_POLITE_REQUEST.some(r => r.test(text));
  if (hasPoliteRequest) {
    tally.strengths.push('Uses a polite, formal request structure.');
    tally.rubric.formalRegister = Math.min(5, tally.rubric.formalRegister + 1);
  } else {
    tally.issues.push(makeIssue('rewrite-no-polite-request', 'informal_register', 'medium',
      'No polite request structure detected.',
      'Use "Could you please provide…", "I would like to enquire…", or "Please provide…".',
    ));
    tally.focus.add('informal_register');
  }

  const hasGreeting = EN_REWRITE_POLITE_GREETING.some(r => r.test(text));
  if (hasGreeting) {
    tally.strengths.push('Opens with a polite greeting.');
    tally.rubric.formalRegister = Math.min(5, tally.rubric.formalRegister + 1);
  }
}

// ─── Required elements ─────────────────────────────────────────────────────

function checkRequiredElements(text: string, requiredElements: string[]): string[] {
  const lower = text.toLowerCase();
  const missing: string[] = [];
  for (const el of requiredElements) {
    // Format: "label text (keyword1 / keyword2 / ...)" — parens hold the actual search terms.
    // Extract parens BEFORE splitting on "/" to avoid breaking paren contents.
    const parenMatch = el.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
    let candidates: string[];
    if (parenMatch) {
      const parenAlts = parenMatch[2].split('/').map(s => s.trim().toLowerCase()).filter(s => s.length > 1);
      const baseLabel = parenMatch[1].trim().toLowerCase();
      candidates = [...parenAlts, baseLabel];
    } else {
      candidates = el.toLowerCase().split(/[/,|]/).map(k => k.trim()).filter(k => k.length > 1);
    }
    const found = candidates.some(k => lower.includes(k));
    if (!found) missing.push(el);
  }
  return missing;
}

// ─── Main export ────────────────────────────────────────────────────────────

export function analyzeWriting(input: WritingAnalysisInput): WritingAnalysisResult {
  const { text, prompt: _prompt, languageId = 'spanish', cefrLevel, taskType,
    wordTargetMin, wordTargetMax, requiredElements } = input;
  const isEnglish = languageId === 'english';
  const isRewrite = taskType === 'register_rewrite';

  const tally: Tally = {
    issues: [],
    strengths: [],
    rubric: {
      taskCompletion: isRewrite ? 4 : 3,
      grammarControl: isRewrite ? 4 : 3,
      vocabularyRange: isRewrite ? 4 : 3,
      coherence: isRewrite ? 4 : 3,
      formalRegister: taskType === 'formal_email' ? 3 : 4,
      connectors: 3,
      accentsPunctuation: isEnglish ? 5 : 3,
    },
    focus: new Set<MistakeCategory>(),
  };

  const wc = countWords(text);
  const sc = countSentences(text);
  const pc = countParagraphs(text);
  const ratio = uniqueWordRatio(text);

  // ── Shared checks ──
  checkWordCount(text, wordTargetMin, wordTargetMax, tally);
  checkParagraphing(text, taskType, tally);

  // ── Language-specific checks ──
  if (isEnglish) {
    if (taskType === 'formal_email') checkFormalEmailEnglish(text, tally);
    if (taskType === 'register_rewrite') checkRegisterRewriteEnglish(text, tally);
    checkInformalFlagsEnglish(text, taskType, tally);
    checkConnectorsEnglish(text, cefrLevel, tally);
    checkPunctuationEnglish(text, tally);
    checkGrammarEnglish(text, cefrLevel, tally);
    checkVocabularyRangeEnglish(text, cefrLevel, tally);
    // DO NOT run: checkEnglishIntrudersSpanish, checkAccentsSpanish
  } else {
    // Spanish
    if (taskType === 'formal_email') checkFormalEmailSpanish(text, tally);
    checkInformalFlagsSpanish(text, taskType, tally);
    checkConnectorsSpanish(text, cefrLevel, tally);
    checkAccentsSpanish(text, tally);
    checkPunctuationSpanish(text, tally);
    checkLongSentences(text, tally);
    checkEnglishIntrudersSpanish(text, tally);
    checkVagueLanguageSpanish(text, taskType, tally);
    checkVocabularyRangeSpanish(text, cefrLevel, tally);
  }

  // ── Required elements ──
  const missing = requiredElements ? checkRequiredElements(text, requiredElements) : [];
  if (missing.length > 0) {
    const penalty = Math.min(missing.length, 2);
    tally.rubric.taskCompletion = Math.max(0, tally.rubric.taskCompletion - penalty);
    tally.focus.add('weak_argument_structure');
  } else if (requiredElements && requiredElements.length > 0) {
    tally.strengths.push('All required elements present.');
    tally.rubric.taskCompletion = Math.min(5, tally.rubric.taskCompletion + 1);
  }

  // ── Score ──
  const r = tally.rubric;
  const weighted =
    r.taskCompletion * 18 +
    r.grammarControl * 16 +
    r.vocabularyRange * 14 +
    r.coherence * 16 +
    r.formalRegister * 12 +
    r.connectors * 12 +
    r.accentsPunctuation * 12;
  let score = Math.round((weighted / 500) * 100);

  if (!isRewrite) {
    if (wc < 20) score = Math.min(score, 25);
    if (wc < 8) score = Math.min(score, 10);
  }

  let estimatedBand: EstimatedBand;
  let bandLabel: string;
  if (score < 40) {
    estimatedBand = 'below_target';
    bandLabel = `Below ${cefrLevel}`;
  } else if (score < 60) {
    estimatedBand = 'near_target';
    bandLabel = `Near ${cefrLevel}`;
  } else if (score < 80) {
    estimatedBand = 'target_developing';
    bandLabel = `${cefrLevel} developing`;
  } else {
    estimatedBand = 'target_strong';
    bandLabel = `${cefrLevel} strong`;
  }

  const severityRank = { high: 0, medium: 1, low: 2 };
  tally.issues.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);

  const focusArr = [...tally.focus];
  let nextPracticeRecommendation = 'Run a sprint to reinforce your strongest skill areas.';
  if (isEnglish) {
    if (focusArr.includes('informal_register')) {
      nextPracticeRecommendation = 'Drill formal register rewrites and English formal email phrases.';
    } else if (focusArr.includes('connector_misuse')) {
      nextPracticeRecommendation = 'Practice connectors: "however", "although", "therefore", "in addition", "as a result".';
    } else if (focusArr.includes('tense_aspect')) {
      nextPracticeRecommendation = 'Review present perfect ("have worked/lived/studied since…") vs simple present.';
    } else if (focusArr.includes('weak_argument_structure')) {
      nextPracticeRecommendation = 'Practice writing in clear paragraphs: opening → development → closing.';
    }
  } else {
    if (focusArr.includes('informal_register')) {
      nextPracticeRecommendation = 'Drill formal register rewrites and formal email phrases.';
    } else if (focusArr.includes('connector_misuse')) {
      nextPracticeRecommendation = 'Practice connector exercises ("sin embargo", "de ahí que", "no obstante").';
    } else if (focusArr.includes('accent_error')) {
      nextPracticeRecommendation = 'Review accent-practice drills in your skill map.';
    } else if (focusArr.includes('weak_argument_structure')) {
      nextPracticeRecommendation = 'Practice writing in paragraphs: introduction → development → conclusion.';
    } else if (focusArr.includes('weak_collocation')) {
      nextPracticeRecommendation = 'Drill collocations and vocabulary range.';
    }
  }

  return {
    wordCount: wc,
    sentenceCount: sc,
    paragraphCount: pc,
    uniqueWordRatio: ratio,
    score,
    estimatedBand,
    bandLabel,
    rubricScores: tally.rubric,
    detectedStrengths: tally.strengths,
    detectedIssues: tally.issues,
    missingRequirements: missing,
    suggestedFocusAreas: focusArr,
    nextPracticeRecommendation,
  };
}

// ─── word count status helper ───────────────────────────────────────────────

export interface WordCountStatus {
  count: number;
  status: 'too_short' | 'in_range' | 'too_long' | 'unknown';
  label: string;
}

export function getWordCountStatus(text: string, min?: number, max?: number): WordCountStatus {
  const count = countWords(text);
  if (!min && !max) return { count, status: 'unknown', label: `${count} words` };
  if (min && count < min) {
    return { count, status: 'too_short', label: `${count} / ${min}${max ? `–${max}` : '+'} words` };
  }
  if (max && count > max) {
    return { count, status: 'too_long', label: `${count} / ${min ?? 0}–${max} words` };
  }
  return { count, status: 'in_range', label: `${count} / ${min ?? 0}–${max ?? '∞'} words` };
}
