import { describe, it, expect } from 'vitest';
import { analyzeWriting } from '../writingAnalysis';
import { englishPack } from '../../languages/english';

// The canonical "Alex" sample — a realistic A1 English intro with the "work since" issue.
const ALEX_A1 =
  'My name is Alex. I live in the city of Netanya in Israel. I work as a Technical Services VPN engineer at Check Point Software since August 2024. I have a variety of hobbies, but my favorite hobby is playing the guitar.';

const EN_A1_OPTS = {
  prompt: 'Write a short introduction about yourself.',
  languageId: 'english' as const,
  cefrLevel: 'A1' as const,
  taskType: 'narrative' as const,
  wordTargetMin: 40,
  wordTargetMax: 60,
  requiredElements: [
    'name (I am / my name is / I\'m)',
    'origin or location (I am from / I live in / I come from)',
    'work or study (I work / I study / I am a)',
    'hobby (I like / I enjoy / my hobby / I play / I love)',
  ],
};

describe('English A1 intro — Alex sample', () => {
  it('scores ≥60 (not the erroneous 49 from the old Spanish-only analysis)', () => {
    const r = analyzeWriting({ text: ALEX_A1, ...EN_A1_OPTS });
    expect(r.score).toBeGreaterThanOrEqual(60);
  });

  it('detects name element', () => {
    const r = analyzeWriting({ text: ALEX_A1, ...EN_A1_OPTS });
    expect(r.missingRequirements.some(m => m.toLowerCase().includes('name'))).toBe(false);
  });

  it('detects location element', () => {
    const r = analyzeWriting({ text: ALEX_A1, ...EN_A1_OPTS });
    expect(r.missingRequirements.some(m => m.toLowerCase().includes('origin') || m.toLowerCase().includes('location'))).toBe(false);
  });

  it('detects work element', () => {
    const r = analyzeWriting({ text: ALEX_A1, ...EN_A1_OPTS });
    expect(r.missingRequirements.some(m => m.toLowerCase().includes('work'))).toBe(false);
  });

  it('detects hobby element', () => {
    const r = analyzeWriting({ text: ALEX_A1, ...EN_A1_OPTS });
    expect(r.missingRequirements.some(m => m.toLowerCase().includes('hobby'))).toBe(false);
  });

  it('does NOT flag "I" as an error', () => {
    const r = analyzeWriting({ text: ALEX_A1, ...EN_A1_OPTS });
    const intruderIssues = r.detectedIssues.filter(i =>
      i.category === 'literal_translation' && i.matchedText?.toLowerCase() === 'i',
    );
    expect(intruderIssues).toHaveLength(0);
  });

  it('does NOT flag "and" as an error', () => {
    const r = analyzeWriting({ text: ALEX_A1, ...EN_A1_OPTS });
    const intruderIssues = r.detectedIssues.filter(i =>
      i.category === 'literal_translation' && i.matchedText?.toLowerCase() === 'and',
    );
    expect(intruderIssues).toHaveLength(0);
  });

  it('does NOT flag "the" as an error', () => {
    const r = analyzeWriting({ text: ALEX_A1, ...EN_A1_OPTS });
    const intruderIssues = r.detectedIssues.filter(i =>
      i.category === 'literal_translation' && i.matchedText?.toLowerCase() === 'the',
    );
    expect(intruderIssues).toHaveLength(0);
  });

  it('does NOT flag "because" as an error', () => {
    const text = 'My name is Sam. I live in London. I work as a teacher. I like reading because it is relaxing.';
    const r = analyzeWriting({ text, ...EN_A1_OPTS });
    const intruderIssues = r.detectedIssues.filter(i =>
      i.category === 'literal_translation' && i.matchedText?.toLowerCase() === 'because',
    );
    expect(intruderIssues).toHaveLength(0);
  });

  it('detects "work since" as a present-perfect grammar suggestion', () => {
    const r = analyzeWriting({ text: ALEX_A1, ...EN_A1_OPTS });
    const tenseIssue = r.detectedIssues.find(i => i.id === 'present-since-grammar');
    expect(tenseIssue).toBeDefined();
    expect(tenseIssue?.category).toBe('tense_aspect');
  });

  it('has no accent-related issues (accents do not apply to English)', () => {
    const r = analyzeWriting({ text: ALEX_A1, ...EN_A1_OPTS });
    const accentIssues = r.detectedIssues.filter(i => i.category === 'accent_error');
    expect(accentIssues).toHaveLength(0);
  });
});

describe('English analysis — language isolation', () => {
  it('does not run Spanish accent checks on English text', () => {
    const text = 'My name is Maria. I live in Madrid. I study Spanish at the university. I enjoy reading.';
    const r = analyzeWriting({
      text, prompt: 'introduce yourself', languageId: 'english',
      cefrLevel: 'A1', taskType: 'narrative',
    });
    const accentIssues = r.detectedIssues.filter(i => i.category === 'accent_error');
    expect(accentIssues).toHaveLength(0);
  });

  it('does not flag "this", "that", "from" as intruder words in English', () => {
    const text =
      'This is my city. I come from a small town. I travel from home to work every day. That is my routine.';
    const r = analyzeWriting({
      text, prompt: 'describe yourself', languageId: 'english',
      cefrLevel: 'A2', taskType: 'narrative',
    });
    const intruders = r.detectedIssues.filter(i => i.category === 'literal_translation');
    expect(intruders).toHaveLength(0);
  });

  it('still runs Spanish accent checks when languageId is "spanish"', () => {
    const r = analyzeWriting({
      text: 'Estimados senores, solicito informacion sobre el programa.',
      prompt: 'formal email',
      languageId: 'spanish',
      cefrLevel: 'B2',
      taskType: 'formal_email',
    });
    const accentIssues = r.detectedIssues.filter(i => i.category === 'accent_error');
    expect(accentIssues.length).toBeGreaterThan(0);
  });

  it('English intruder detector is NOT triggered when text is Spanish', () => {
    const r = analyzeWriting({
      text: 'Soy estudiante. Vivo en Madrid. Me gusta mucho la música. Tengo muchos amigos aquí.',
      prompt: 'describir', languageId: 'spanish',
      cefrLevel: 'A1', taskType: 'narrative',
    });
    // No Spanish-specific intruder check should fire for normal Spanish words
    const intruders = r.detectedIssues.filter(i => i.category === 'literal_translation');
    expect(intruders).toHaveLength(0);
  });
});

describe('English formal email analysis', () => {
  const EN_FORMAL_OPTS = {
    prompt: 'Write a formal complaint letter to a hotel.',
    languageId: 'english' as const,
    cefrLevel: 'B2' as const,
    taskType: 'formal_email' as const,
    wordTargetMin: 150,
    wordTargetMax: 180,
  };

  const GOOD_EN_FORMAL = `Dear Sir or Madam,

I am writing to express my dissatisfaction with my recent stay at your hotel from 10 to 12 October. The room had not been cleaned properly and the air conditioning was completely non-functional throughout my stay. Despite reporting this problem twice to reception, the staff showed little interest in resolving the issue.

I feel that the standard of service I received was entirely unacceptable given the price I paid. I would therefore like to request a partial refund of at least 50% of the room rate as compensation for the inconvenience caused.

I look forward to your prompt response.

Yours sincerely,
A. Taylor`;

  it('rates a well-formed English formal letter highly', () => {
    const r = analyzeWriting({ text: GOOD_EN_FORMAL, ...EN_FORMAL_OPTS });
    expect(r.score).toBeGreaterThanOrEqual(70);
    expect(r.rubricScores.formalRegister).toBeGreaterThanOrEqual(4);
  });

  it('detects formal greeting in English formal email', () => {
    const r = analyzeWriting({ text: GOOD_EN_FORMAL, ...EN_FORMAL_OPTS });
    expect(r.detectedIssues.some(i => i.id === 'no-formal-greeting')).toBe(false);
  });

  it('detects formal closing in English formal email', () => {
    const r = analyzeWriting({ text: GOOD_EN_FORMAL, ...EN_FORMAL_OPTS });
    expect(r.detectedIssues.some(i => i.id === 'no-formal-closing')).toBe(false);
  });

  it('flags missing formal greeting in English email', () => {
    const r = analyzeWriting({
      text: 'Hello! I want to complain about my recent stay. The room was dirty. Thanks.',
      ...EN_FORMAL_OPTS,
    });
    expect(r.detectedIssues.some(i => i.id === 'no-formal-greeting')).toBe(true);
  });

  it('flags informal expressions in English formal email', () => {
    const r = analyzeWriting({
      text: 'Heya! Wanna complain about the hotel. Gonna need my money back. Cheers!',
      ...EN_FORMAL_OPTS,
    });
    expect(r.detectedIssues.some(i => i.id.startsWith('informal-'))).toBe(true);
  });
});

describe('English connectors', () => {
  it('rewards B1/B2 connectors in English', () => {
    const text =
      'Social media has many advantages. However, it also has disadvantages. On the other hand, it allows people to communicate. Therefore, we should use it in moderation. In addition, young people need guidance. Although it can be harmful, it is useful.';
    const r = analyzeWriting({
      text, prompt: 'opinion', languageId: 'english',
      cefrLevel: 'B1', taskType: 'opinion',
    });
    expect(r.rubricScores.connectors).toBeGreaterThanOrEqual(4);
  });

  it('accepts basic connectors (and/but/because) for A1 level', () => {
    const text = 'I like music and I play the guitar. I also enjoy reading because it is relaxing. But sometimes I watch films.';
    const r = analyzeWriting({
      text, prompt: 'about yourself', languageId: 'english',
      cefrLevel: 'A1', taskType: 'narrative',
    });
    expect(r.rubricScores.connectors).toBeGreaterThanOrEqual(4);
    expect(r.detectedIssues.some(i => i.id === 'no-connectors')).toBe(false);
  });
});

describe('Required elements — age not required', () => {
  it('English A1 intro prompt does not require "age" element', () => {
    const a1Prompt = englishPack.writingPrompts.find(p => p.id === 'en-wp-a1-01');
    expect(a1Prompt).toBeDefined();
    const hasAge = a1Prompt!.requiredElements?.some(el =>
      el.toLowerCase().includes('age') || el.toLowerCase().includes('old'),
    );
    expect(hasAge).toBe(false);
  });

  it('text mentioning name/location/work/hobby satisfies the A1 intro prompt requirements', () => {
    const text = 'My name is Tom. I live in Paris. I work as a chef. I enjoy cycling.';
    const r = analyzeWriting({
      text,
      ...EN_A1_OPTS,
    });
    expect(r.missingRequirements).toHaveLength(0);
  });
});

describe('English register rewrite scoring', () => {
  const REWRITE_OPTS = {
    prompt: 'Rewrite formally: "Hey, can you tell me about the job thing?"',
    languageId: 'english' as const,
    cefrLevel: 'B2' as const,
    taskType: 'register_rewrite' as const,
    wordTargetMin: 8,
    wordTargetMax: 25,
  };

  const GOOD_REWRITE = 'Hello, could you provide me some more details about the position?';

  it('good formal rewrite scores strong (80–95)', () => {
    const r = analyzeWriting({ text: GOOD_REWRITE, ...REWRITE_OPTS });
    expect(r.score).toBeGreaterThanOrEqual(80);
    expect(r.score).toBeLessThanOrEqual(95);
  });

  it('does not apply the short-text score cap to rewrite tasks', () => {
    const r = analyzeWriting({ text: GOOD_REWRITE, ...REWRITE_OPTS });
    expect(r.score).toBeGreaterThan(25);
  });

  it('does not flag missing connectors for a one-sentence rewrite', () => {
    const r = analyzeWriting({ text: GOOD_REWRITE, ...REWRITE_OPTS });
    expect(r.detectedIssues.some(i => i.id === 'no-connectors')).toBe(false);
  });

  it('explains what was good (detects strengths)', () => {
    const r = analyzeWriting({ text: GOOD_REWRITE, ...REWRITE_OPTS });
    expect(r.detectedStrengths.length).toBeGreaterThan(0);
    expect(r.detectedStrengths.some(s => /position|role|formal noun/i.test(s))).toBe(true);
  });

  it('explains what can be improved for a poor rewrite', () => {
    const r = analyzeWriting({
      text: 'Hey, can you tell me about the job thing?',
      ...REWRITE_OPTS,
    });
    expect(r.detectedIssues.length).toBeGreaterThan(0);
  });

  it('poor rewrite scores substantially lower than a good formal rewrite', () => {
    const good = analyzeWriting({ text: GOOD_REWRITE, ...REWRITE_OPTS });
    const poor = analyzeWriting({
      text: 'Hey, can you tell me about the job thing?',
      ...REWRITE_OPTS,
    });
    expect(good.score).toBeGreaterThan(poor.score + 10);
  });

  it('does not use long-writing word count penalty for rewrite tasks', () => {
    const r = analyzeWriting({ text: GOOD_REWRITE, ...REWRITE_OPTS });
    expect(r.detectedIssues.some(i => i.id === 'too-short')).toBe(false);
  });
});
