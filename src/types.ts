// ─── CEFR & languages ───────────────────────────────────────────────────────

export type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1';

export const CEFR_ORDER: CEFRLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1'];

export type LanguageId = 'spanish' | 'english';

export interface LanguagePackMetadata {
  id: LanguageId;
  label: string;
  nativeLabel: string;
  cefrSupportedLevels: CEFRLevel[];
  /** Show the accent helper toolbar in inputs. */
  keyboardHelpers: boolean;
  /** Default accent leniency for objective answers. */
  defaultAccentMode: 'lenient' | 'strict';
  /** True if accent marks affect correctness; informs writing analyzer too. */
  accentSensitive: boolean;
  examTargets: { id: string; label: string }[];
  /** Localised flavor strings used in shared UI. */
  promptCopy: {
    diagnosticIntro: string;
    coachTagline: string;
  };
  /** Mistake categories displayed in the weakness heatmap for this language. */
  weaknessCategories: MistakeCategory[];
}

// ─── Skills & mistakes ──────────────────────────────────────────────────────

export type Skill =
  | 'reading'
  | 'listening'
  | 'writing'
  | 'speaking'
  | 'grammar'
  | 'vocabulary'
  | 'collocations'
  | 'connectors'
  | 'formal_register'
  | 'accent_punctuation'
  | 'exam_timing';

/** Skills that the current MVP actively scores. Listening + speaking are excluded. */
export const SCORED_SKILLS: Skill[] = [
  'grammar',
  'vocabulary',
  'reading',
  'writing',
  'connectors',
  'collocations',
  'formal_register',
  'accent_punctuation',
];

/** Skills that are shown in the UI as "Coming soon" rather than scored. */
export const COMING_SOON_SKILLS: Skill[] = ['listening', 'speaking'];

export type MistakeCategory =
  // Spanish-leaning categories (kept for migration / Spanish content)
  | 'subjunctive'
  | 'tense_choice'
  | 'ser_estar'
  | 'por_para'
  | 'pronouns'
  | 'articles'
  | 'prepositions'
  | 'connector_misuse'
  | 'weak_collocation'
  | 'false_friend'
  | 'weak_inference'
  | 'weak_paraphrase'
  | 'informal_register'
  | 'weak_argument_structure'
  | 'literal_translation'
  | 'accent_error'
  | 'punctuation_error'
  | 'spelling'
  | 'slow_response'
  | 'low_confidence'
  // English-leaning categories (additional)
  | 'article_use'
  | 'word_order'
  | 'phrasal_verb'
  | 'collocation_en'
  | 'tense_aspect'
  | 'preposition_en'
  | 'register_en';

export type ExerciseType =
  | 'multipleChoice'
  | 'cloze'
  | 'sentenceTransformation'
  | 'connectorChoice'
  | 'registerRewrite'
  | 'collocationChoice'
  | 'readingQuestion'
  | 'writingPrompt'
  | 'speakingPrompt'
  | 'listeningLikePrompt'
  | 'accentPractice'
  | 'punctuationPractice';

export type WritingTaskType =
  | 'formal_email'
  | 'opinion'
  | 'narrative'
  | 'report'
  | 'argumentative'
  | 'register_rewrite'
  | 'summary'
  | 'general';

export interface RubricItem {
  criterion: string;
  description: string;
  maxScore: number;
}

export interface Exercise {
  id: string;
  type: ExerciseType;
  skill: Skill;
  cefrLevel: CEFRLevel;
  prompt: string;
  context?: string;
  choices?: string[];
  correctAnswer?: string;
  acceptableAnswers?: string[];
  explanation: string;
  mistakeCategories: MistakeCategory[];
  tags: string[];
  estimatedSeconds: number;
  difficulty: 1 | 2 | 3 | 4 | 5;
  rubric?: RubricItem[];
  exampleAnswer?: string;
  accentSensitive: boolean;
  keyboardHelp: boolean;
  readingTextId?: string;
  isDiagnostic?: boolean;
  taskType?: WritingTaskType;
  wordTargetMin?: number;
  wordTargetMax?: number;
  requiredElements?: string[];
  checklist?: string[];
  // ─── Calibration metadata (optional; defaults derived for legacy items) ───
  /** Content revision; bump when an item's wording/answer changes. */
  itemVersion?: number;
  /** Groups near-identical items so repeats of a family don't re-count. */
  itemFamilyId?: string;
  /** Finer-grained tag within a skill (e.g. "preterite_imperfect"). */
  subskill?: string;
  /** The competence the item targets (e.g. "verb aspect contrast"). */
  construct?: string;
  /** Which language this item belongs to (tagged at pack-build time). */
  languageId?: LanguageId;
  /** Whether the item may appear in readiness exams. Defaults by type. */
  examEligible?: boolean;
  diagnosticEligible?: boolean;
  sprintEligible?: boolean;
  reviewEligible?: boolean;
}

export interface ReadingText {
  id: string;
  title: string;
  text: string;
  cefrLevel: CEFRLevel;
  topic: string;
  wordCount: number;
}

export interface WritingPromptMeta {
  id: string;
  title: string;
  prompt: string;
  mode: '5min' | '10min' | '20min';
  cefrLevel: CEFRLevel;
  genre: string;
  wordTarget: string;
  wordMin: number;
  wordMax: number;
  taskType: WritingTaskType;
  requiredElements?: string[];
  exampleAnswer?: string;
  tip: string;
}

export interface SpeakingPromptMeta {
  id: string;
  title: string;
  prompt: string;
  mode: '30s' | '60s' | '2min';
  cefrLevel: CEFRLevel;
  topic: string;
  planningSeconds: number;
  tip: string;
}

// ─── Mistake records ────────────────────────────────────────────────────────

export interface MistakeRecord {
  id: string;
  exerciseId: string;
  date: string;
  userAnswer: string;
  correctAnswer: string;
  explanation: string;
  mistakeCategories: MistakeCategory[];
  cefrLevel: CEFRLevel;
  skill: Skill;
  confidence: 'low' | 'medium' | 'high';
  timeSpent: number;
  nextReviewDate: string;
  reviewInterval: number;
  attempts: number;
  status: 'new' | 'learning' | 'reviewing' | 'mastered';
  prompt: string;
}

// ─── Diagnostic & placement ────────────────────────────────────────────────

export interface DiagnosticAnswer {
  exerciseId: string;
  cefrLevel: CEFRLevel;
  skill: Skill;
  userAnswer: string;
  correct: boolean;
  confidence: 'low' | 'medium' | 'high';
  timeSpent: number;
  skipped: boolean;
}

export type LevelEvidenceStatus =
  | 'unknown' // not enough attempts
  | 'not_yet' // < 50% accuracy with enough evidence
  | 'emerging' // 50-69%
  | 'developing' // 70-84%
  | 'strong'; // >= 85%

export interface LevelEvidence {
  level: CEFRLevel;
  attempted: number;
  correct: number;
  skipped: number;
  accuracy: number;
  status: LevelEvidenceStatus;
  /** 0..100 readiness estimate for this level. */
  readiness: number;
}

export type PlacementConfidence = 'low' | 'medium' | 'high';

export interface SkillEstimate {
  skill: Skill;
  /** 0..100. May be null when no evidence (e.g. writing skipped). */
  score: number | null;
  confidence: PlacementConfidence;
  /** True when this skill was deliberately skipped during the diagnostic. */
  unattempted: boolean;
}

export interface PlacementResult {
  language: LanguageId;
  /** Conservative single-letter estimate; may be a boundary like "A2/B1". */
  estimatedLevel: CEFRLevel;
  /** Whether the estimate sits on a level boundary; UI should show "X/Y boundary". */
  boundary?: CEFRLevel;
  confidence: PlacementConfidence;
  perLevel: LevelEvidence[];
  skillEstimates: SkillEstimate[];
  itemsAttempted: number;
  itemsSkipped: number;
  writingAttempted: boolean;
  notes: string[];
}

export interface DiagnosticResult {
  id: string;
  date: string;
  language: LanguageId;
  answers: DiagnosticAnswer[];
  placement: PlacementResult;
  timeSpent: number;
  itemCount: number;
}

// ─── Settings, progress, sessions ──────────────────────────────────────────

export type WritingFrequency = 'never' | 'sometimes' | 'often';

export interface AppSettings {
  theme: 'light' | 'dark' | 'system';
  accentMode: 'lenient' | 'strict';
  keyboardMode: 'us' | 'spanish';
  targetLevel: CEFRLevel;
  dailyTime: 5 | 10 | 20;
  showTimers: boolean;
  autoAdvance: boolean;
  /** How often to include writing in daily sprints. */
  writingFrequency: WritingFrequency;
}

export interface UserProgress {
  onboardingComplete: boolean;
  diagnosticComplete: boolean;
  selectedLevel: CEFRLevel | 'beginner' | 'not_sure';
  targetLevel: CEFRLevel;
  dailyTime: 5 | 10 | 20;
  keyboardType: 'us' | 'spanish';
  skillScores: Partial<Record<Skill, number>>;
  /** Per-level readiness 0..100 derived from latest placement + practice. */
  levelReadiness: Partial<Record<CEFRLevel, number>>;
  sessionCount: number;
  totalMinutes: number;
  streakDays: number;
  lastSessionDate: string;
  completedExercises: string[];
  masteredExercises: string[];
  createdAt: string;
  totalCorrect: number;
  totalAttempted: number;
}

export interface Session {
  id: string;
  date: string;
  type: 'diagnostic' | 'sprint' | 'review' | 'writing' | 'speaking' | 'exam';
  durationSeconds: number;
  exercisesAttempted: number;
  exercisesCorrect: number;
  accuracy: number;
  skillsWorked: Skill[];
  mistakesAdded: string[];
  recommendation?: string;
}

export interface WritingEntry {
  id: string;
  promptId: string;
  date: string;
  text: string;
  durationSeconds: number;
  activeSeconds?: number;
  selfScores: Partial<Record<string, number>>;
  weakCategories: MistakeCategory[];
  mode: '5min' | '10min' | '20min' | 'diagnostic';
  analysisScore?: number;
  wordCount?: number;
  rubricScores?: Record<string, number>;
  cefrLevel?: CEFRLevel;
  exampleAnswer?: string;
}

export interface SpeakingEntry {
  id: string;
  promptId: string;
  date: string;
  durationSeconds: number;
  selfScores: Partial<Record<string, number>>;
  weakCategories: MistakeCategory[];
  mode: '30s' | '60s' | '2min';
  notes: string;
}

// ─── Profiles ───────────────────────────────────────────────────────────────

export interface Profile {
  id: string;
  displayName?: string;
  targetLanguage: LanguageId;
  selfEstimatedLevel: CEFRLevel | 'beginner' | 'not_sure';
  targetLevel: CEFRLevel;
  dailyTime: 5 | 10 | 20;
  createdAt: string;
  updatedAt: string;
}

// ─── Resumable session state ───────────────────────────────────────────────

export interface ResumableDiagnosticState {
  language: LanguageId;
  itemIds: string[];
  currentIndex: number;
  answers: DiagnosticAnswer[];
  startedAt: string;
  lastSavedAt: string;
  activeSeconds?: number;
}

export interface ResumableSprintState {
  language: LanguageId;
  itemIds: string[];
  currentIndex: number;
  correct: number;
  attempted: number;
  mistakesAdded: string[];
  skillsWorked: Skill[];
  durationMins: 5 | 10 | 20;
  startedAt: string;
  lastSavedAt: string;
}

// ─── Evidence ledger ────────────────────────────────────────────────────────

export type ActivityType =
  | 'diagnostic' | 'sprint' | 'readiness_exam' | 'review' | 'writing' | 'drill';

export type ScoringMode =
  | 'objective' | 'heuristic_writing' | 'self_rating' | 'legacy';

/**
 * A single recorded action. Every answer/skip/submission produces one of these.
 * The evidenceWeight field encodes how much this event may move a level
 * estimate (repeats, reviews, low confidence and legacy items are discounted).
 */
export interface EvidenceEvent {
  id: string;
  profileId: string;
  languageId: LanguageId;
  activityType: ActivityType;
  exerciseId: string;
  itemVersion: number;
  itemFamilyId: string;
  skill: Skill;
  subskill?: string;
  cefrLevel: CEFRLevel;
  construct?: string;
  firstAttempt: boolean;
  seenCountBefore: number;
  correct: boolean;
  skipped: boolean;
  userAnswer: string;
  confidence: 'low' | 'medium' | 'high';
  timeSpentSeconds: number;
  activeTimeSeconds: number;
  mistakeCategories: MistakeCategory[];
  scoringMode: ScoringMode;
  /** 0..1 contribution toward level promotion. */
  evidenceWeight: number;
  isRepeat: boolean;
  isReview: boolean;
  createdAt: string;
}

// ─── Proficiency estimation outputs ─────────────────────────────────────────

/** How much trustworthy evidence backs an estimate. */
export type EvidenceConfidence =
  | 'insufficient' // 0-4 unseen calibrated items
  | 'very_low'     // 5-9
  | 'low'          // 10-19
  | 'medium'       // 20-39
  | 'strong';      // 40+

/** User-facing readiness label for a level card. */
export type ReadinessBand =
  | 'insufficient'
  | 'early_signal'
  | 'developing'
  | 'likely_ready'
  | 'strong';

export interface LevelReadiness {
  level: CEFRLevel;
  /** 0..100 weighted readiness. */
  readiness: number;
  band: ReadinessBand;
  confidence: EvidenceConfidence;
  unseenItems: number;
  repeatedItems: number;
  /** Sum of evidence weights backing this level. */
  weightedEvidence: number;
  /** Weight-weighted accuracy 0..1. */
  accuracyWeighted: number;
  /** Set when a weaker lower level capped this estimate. */
  gatedBy?: CEFRLevel;
}

export interface SkillReadiness {
  skill: Skill;
  /** Weighted, unseen-based proficiency. Null when no usable evidence. */
  proficiency: number | null;
  /** Raw app accuracy including repeats — "practice score". */
  practiceScore: number | null;
  confidence: EvidenceConfidence;
  unseenItems: number;
  repeatedItems: number;
}

export interface EvidenceQuality {
  unseenCalibratedItems: number;
  repeatedItems: number;
  writingSamples: number;
  legacyItems: number;
  levelsWithInsufficientEvidence: CEFRLevel[];
  latestConfidence: EvidenceConfidence;
}

export interface ProficiencyEstimate {
  language: LanguageId;
  currentEstimate: CEFRLevel;
  boundary?: CEFRLevel;
  estimateConfidence: EvidenceConfidence;
  nextTarget: CEFRLevel | null;
  readinessByLevel: LevelReadiness[];
  readinessBySkill: SkillReadiness[];
  bottlenecks: string[];
  evidenceWarnings: string[];
  recommendedNextActions: string[];
  evidenceQuality: EvidenceQuality;
}

// ─── Labels ─────────────────────────────────────────────────────────────────

export const SKILL_LABELS: Record<Skill, string> = {
  reading: 'Reading',
  listening: 'Listening',
  writing: 'Writing',
  speaking: 'Speaking',
  grammar: 'Grammar',
  vocabulary: 'Vocabulary',
  collocations: 'Collocations',
  connectors: 'Connectors',
  formal_register: 'Formal Register',
  accent_punctuation: 'Accents & Punctuation',
  exam_timing: 'Exam Timing',
};

export const MISTAKE_LABELS: Record<MistakeCategory, string> = {
  subjunctive: 'Subjunctive',
  tense_choice: 'Tense Choice',
  ser_estar: 'Ser vs Estar',
  por_para: 'Por vs Para',
  pronouns: 'Pronouns',
  articles: 'Articles',
  prepositions: 'Prepositions',
  connector_misuse: 'Connector Misuse',
  weak_collocation: 'Weak Collocations',
  false_friend: 'False Friends',
  weak_inference: 'Weak Inference',
  weak_paraphrase: 'Weak Paraphrase',
  informal_register: 'Informal Register',
  weak_argument_structure: 'Argument Structure',
  literal_translation: 'Literal Translation',
  accent_error: 'Missing Accents',
  punctuation_error: 'Punctuation',
  spelling: 'Spelling',
  slow_response: 'Slow Response',
  low_confidence: 'Low Confidence',
  article_use: 'Articles (a/an/the)',
  word_order: 'Word Order',
  phrasal_verb: 'Phrasal Verbs',
  collocation_en: 'Collocations',
  tense_aspect: 'Tense & Aspect',
  preposition_en: 'Prepositions',
  register_en: 'Register',
};

export const LEVEL_STATUS_LABELS: Record<LevelEvidenceStatus, string> = {
  unknown: 'Not enough evidence',
  not_yet: 'Not yet',
  emerging: 'Emerging',
  developing: 'Developing',
  strong: 'Strong',
};

export const PLACEMENT_CONFIDENCE_LABELS: Record<PlacementConfidence, string> = {
  low: 'Low confidence',
  medium: 'Medium confidence',
  high: 'High confidence',
};

export const READINESS_BAND_LABELS: Record<ReadinessBand, string> = {
  insufficient: 'Insufficient evidence',
  early_signal: 'Early signal',
  developing: 'Developing',
  likely_ready: 'Likely ready for mock',
  strong: 'Strong evidence',
};

export const EVIDENCE_CONFIDENCE_LABELS: Record<EvidenceConfidence, string> = {
  insufficient: 'Insufficient evidence',
  very_low: 'Very low confidence',
  low: 'Low confidence',
  medium: 'Medium confidence',
  strong: 'Stronger confidence',
};
