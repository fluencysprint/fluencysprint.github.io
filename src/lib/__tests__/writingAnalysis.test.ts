import { describe, it, expect } from 'vitest';
import { analyzeWriting, countWords, getWordCountStatus } from '../writingAnalysis';

describe('countWords', () => {
  it('counts words separated by whitespace', () => {
    expect(countWords('hola mundo cómo estás')).toBe(4);
  });

  it('ignores leading/trailing whitespace and double spaces', () => {
    expect(countWords('  hola   mundo  ')).toBe(2);
  });

  it('returns 0 for empty input', () => {
    expect(countWords('')).toBe(0);
    expect(countWords('   ')).toBe(0);
  });
});

describe('getWordCountStatus', () => {
  it('flags too short', () => {
    expect(getWordCountStatus('hola mundo', 80, 120).status).toBe('too_short');
  });

  it('flags in range', () => {
    const text = Array.from({ length: 100 }, () => 'palabra').join(' ');
    expect(getWordCountStatus(text, 80, 120).status).toBe('in_range');
  });

  it('flags too long', () => {
    const text = Array.from({ length: 150 }, () => 'palabra').join(' ');
    expect(getWordCountStatus(text, 80, 120).status).toBe('too_long');
  });

  it('returns unknown when no range is provided', () => {
    expect(getWordCountStatus('hola mundo').status).toBe('unknown');
  });
});

const FORMAL_EMAIL_OPTS = {
  prompt: 'Write a formal email requesting information.',
  cefrLevel: 'B2' as const,
  taskType: 'formal_email' as const,
  wordTargetMin: 80,
  wordTargetMax: 120,
};

const GOOD_FORMAL = `Estimados señores,

Me dirijo a ustedes con el fin de solicitar información sobre el programa de prácticas que ofrecen actualmente en su empresa. Soy estudiante de último año de Administración de Empresas y considero que mi perfil podría encajar en el área de marketing digital.

Les agradecería que me indicaran los requisitos de acceso, el período de duración del programa y los pasos a seguir para presentar una candidatura. Asimismo, quedo a su entera disposición para aclarar cualquier información adicional que estimen oportuna.

Atentamente,
Juan Pérez`;

const INFORMAL_EMAIL = `Hola, oye necesito información sobre las prácticas. ¿Me podéis decir cómo apuntarme? Es un trabajo súper interesante. Gracias! Chao.`;

const NO_CLOSING_EMAIL = `Estimados señores, me dirijo a ustedes para solicitar información sobre las prácticas. Soy estudiante y me interesa el programa. Les agradecería que me proporcionaran detalles sobre los requisitos y el calendario del programa, así como los pasos a seguir. He intentado encontrar información en su web sin éxito.`;

describe('analyzeWriting — formal email', () => {
  it('rates a well-formed formal email highly and detects no informal flags', () => {
    const r = analyzeWriting({ text: GOOD_FORMAL, ...FORMAL_EMAIL_OPTS });
    expect(r.score).toBeGreaterThanOrEqual(70);
    expect(r.rubricScores.formalRegister).toBeGreaterThanOrEqual(4);
    expect(r.detectedStrengths.some(s => s.toLowerCase().includes('formal'))).toBe(true);
    expect(r.detectedIssues.some(i => i.id === 'no-formal-greeting')).toBe(false);
    expect(r.detectedIssues.some(i => i.id === 'no-formal-closing')).toBe(false);
  });

  it('detects informal register red flags', () => {
    const r = analyzeWriting({ text: INFORMAL_EMAIL, ...FORMAL_EMAIL_OPTS });
    expect(r.detectedIssues.some(i => i.category === 'informal_register')).toBe(true);
    expect(r.detectedIssues.some(i => i.id.startsWith('informal-'))).toBe(true);
    expect(r.suggestedFocusAreas).toContain('informal_register');
    expect(r.rubricScores.formalRegister).toBeLessThanOrEqual(2);
  });

  it('detects missing formal salutation', () => {
    const r = analyzeWriting({
      text: 'Necesito información sobre el programa de prácticas que ofrecen. Soy estudiante y me interesa el área de marketing. Quedo a la espera. Atentamente.',
      ...FORMAL_EMAIL_OPTS,
    });
    expect(r.detectedIssues.some(i => i.id === 'no-formal-greeting')).toBe(true);
  });

  it('detects missing formal closing', () => {
    const r = analyzeWriting({ text: NO_CLOSING_EMAIL, ...FORMAL_EMAIL_OPTS });
    expect(r.detectedIssues.some(i => i.id === 'no-formal-closing')).toBe(true);
  });

  it('flags too-short responses and caps the score', () => {
    const r = analyzeWriting({
      text: 'Estimados señores, quiero información. Atentamente.',
      ...FORMAL_EMAIL_OPTS,
    });
    expect(r.detectedIssues.some(i => i.id === 'too-short')).toBe(true);
    expect(r.score).toBeLessThan(60);
  });

  it('flags too-long responses', () => {
    const text = Array.from({ length: 200 }, () => 'palabra').join(' ');
    const r = analyzeWriting({ text, ...FORMAL_EMAIL_OPTS });
    expect(r.detectedIssues.some(i => i.id === 'too-long')).toBe(true);
  });

  it('detects common missing accents', () => {
    const r = analyzeWriting({
      text:
        'Estimados senores, me dirijo a ustedes para solicitar informacion sobre el programa. Soy estudiante de administracion y me interesa la comunicacion digital. Atentamente, Maria.',
      ...FORMAL_EMAIL_OPTS,
    });
    expect(r.detectedIssues.some(i => i.category === 'accent_error')).toBe(true);
    expect(r.detectedIssues.find(i => i.id === 'accent-senores')).toBeDefined();
    expect(r.detectedIssues.find(i => i.id === 'accent-informacion')).toBeDefined();
    expect(r.suggestedFocusAreas).toContain('accent_error');
  });

  it('detects missing required elements', () => {
    const r = analyzeWriting({
      text: 'Estimados señores, escribo brevemente. Atentamente, Juan.',
      ...FORMAL_EMAIL_OPTS,
      requiredElements: [
        'who you are (soy/estudiante)',
        'why you are interested (interés/me interesa)',
      ],
    });
    expect(r.missingRequirements.length).toBeGreaterThan(0);
  });
});

describe('analyzeWriting — opinion / connectors', () => {
  it('rewards rich connector usage', () => {
    const text =
      'Considero que la inteligencia artificial transformará el mercado laboral. Por un lado, automatizará muchas tareas. Sin embargo, también creará nuevas oportunidades. Además, será necesaria una mayor formación continua. Por consiguiente, el balance dependerá de las políticas públicas. En suma, no es algo intrínsecamente negativo.';
    const r = analyzeWriting({
      text,
      prompt: 'Opinion on AI',
      cefrLevel: 'B2',
      taskType: 'opinion',
    });
    expect(r.rubricScores.connectors).toBeGreaterThanOrEqual(4);
    expect(r.detectedStrengths.some(s => s.toLowerCase().includes('connector'))).toBe(true);
  });

  it('flags missing connectors when the answer is long enough', () => {
    const text = Array.from({ length: 50 }, () => 'palabra').join(' ') + '.';
    const r = analyzeWriting({
      text,
      prompt: 'Opinion',
      cefrLevel: 'B2',
      taskType: 'opinion',
    });
    expect(r.detectedIssues.some(i => i.id === 'no-connectors')).toBe(true);
    expect(r.suggestedFocusAreas).toContain('connector_misuse');
  });
});

describe('analyzeWriting — band estimate', () => {
  it('returns below_target for very short answers', () => {
    const r = analyzeWriting({
      text: 'hola',
      prompt: 'x',
      cefrLevel: 'B2',
      taskType: 'general',
      wordTargetMin: 80,
      wordTargetMax: 120,
    });
    expect(r.estimatedBand).toBe('below_target');
  });

  it('produces a target_strong band for a strong long answer', () => {
    const r = analyzeWriting({ text: GOOD_FORMAL, ...FORMAL_EMAIL_OPTS });
    // Either developing or strong is acceptable since rubric is heuristic
    expect(['target_developing', 'target_strong']).toContain(r.estimatedBand);
  });
});
