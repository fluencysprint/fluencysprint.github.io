import type { WritingPromptMeta } from '../../types';

export const englishWritingPrompts: WritingPromptMeta[] = [
  {
    id: 'en-wp-a1-01',
    title: 'Introduce yourself (A1)',
    prompt: 'Write a short introduction about yourself (40–60 words): your name, where you are from or where you live, what you do (work or study), and one hobby.',
    mode: '5min', cefrLevel: 'A1', genre: 'personal introduction',
    wordTarget: '40–60 words', wordMin: 40, wordMax: 60,
    taskType: 'general',
    requiredElements: ['name (I am / my name is / I\'m)', 'origin or location (I am from / I live in / I come from)', 'work or study (I work / I study / I am a)', 'hobby (I like / I enjoy / my hobby / I play / I love)'],
    exampleAnswer:
      'My name is Anna. I am twenty-three years old and I am from Berlin. I work as a graphic designer in a small studio. In my free time I like reading novels and walking in the park. I also enjoy cooking simple meals at the weekend with my friends.',
    tip: 'Use present simple verbs and short sentences. Common openers: "My name is...", "I live in...", "I work as...".',
  },
  {
    id: 'en-wp-a2-01',
    title: 'Invite a friend (A2)',
    prompt: 'Write a short message (60–80 words) to a friend inviting them to your birthday. Include the day, time, place and what you will do.',
    mode: '5min', cefrLevel: 'A2', genre: 'informal message',
    wordTarget: '60–80 words', wordMin: 60, wordMax: 80,
    taskType: 'general',
    requiredElements: ['day (Saturday/15th)', 'time (at 7 p.m.)', 'place (at my flat)', 'plan (we are going to / we\'ll)'],
    exampleAnswer:
      'Hi Mark! I am having a birthday party this Saturday and I would love you to come. We are meeting at my flat at 7 p.m. We will have some pizza, listen to music, and probably play a few games. Feel free to bring something to drink if you like. Please let me know if you can make it. See you soon!',
    tip: 'Keep it informal: "Hi", "Feel free to...", "See you". Use going to / will for plans.',
  },
  {
    id: 'en-wp-b1-01',
    title: 'Email a hotel (B1)',
    prompt: 'Write a 100–120 word email to a hotel: book a room for two nights, ask about breakfast and request late check-in.',
    mode: '10min', cefrLevel: 'B1', genre: 'semi-formal email',
    wordTarget: '100–120 words', wordMin: 100, wordMax: 120,
    taskType: 'formal_email',
    requiredElements: [
      'salutation (Dear Sir/Madam, Hello)',
      'booking dates and room',
      'question about breakfast',
      'request about late check-in',
      'polite closing (Best regards / Yours sincerely)',
    ],
    exampleAnswer:
      'Dear Sir or Madam,\n\nI would like to book a double room at your hotel from Friday 5 July to Sunday 7 July, for two nights in total. Could you please confirm whether breakfast is included in the room rate, and let me know the price if it is not?\n\nIn addition, my train arrives quite late on Friday evening, around 11 p.m. Would it be possible to arrange a late check-in on that night?\n\nThank you in advance for your help. I look forward to your reply.\n\nBest regards,\nSarah Mitchell',
    tip: 'Use polite formulas: "I would like to...", "Could you please...", "Thank you in advance".',
  },
  {
    id: 'en-wp-b2-01',
    title: 'Opinion essay (B2)',
    prompt: 'Write a 150–180 word opinion paragraph: "Working from home is better than working in an office." Take a clear position, give two arguments, and end with a brief conclusion.',
    mode: '10min', cefrLevel: 'B2', genre: 'opinion paragraph',
    wordTarget: '150–180 words', wordMin: 150, wordMax: 180,
    taskType: 'opinion',
    requiredElements: [
      'clear position (In my opinion / I believe)',
      'first argument with example (Firstly / For example)',
      'second argument (Furthermore / In addition)',
      'conclusion (Overall / In conclusion)',
    ],
    exampleAnswer:
      'In my opinion, working from home can be more productive than working in an office, although it depends largely on the individual and the role. Firstly, eliminating the commute frees up significant time and energy that can be redirected to focused work or personal wellbeing. For example, an employee who used to spend two hours travelling each day can now invest that time in either deeper work or family responsibilities. Furthermore, the home environment tends to offer fewer interruptions than a typical open-plan office, where conversations and impromptu meetings can repeatedly break concentration. Of course, remote work requires self-discipline and is not equally suitable for every job — collaborative creative work, for instance, often benefits from face-to-face contact. Overall, however, I believe a flexible, hybrid model that gives employees the freedom to choose where they work best is more conducive to high performance than a strict in-office requirement.',
    tip: 'Structure: position → argument 1 + example → argument 2 → counterpoint/concession → conclusion.',
  },
  {
    id: 'en-wp-c1-01',
    title: 'Argumentative essay (C1)',
    prompt: 'Write a 200–250 word essay analysing the impact of artificial intelligence on entry-level professional jobs. Take a balanced position, support it with concrete examples, and consider one counter-argument.',
    mode: '20min', cefrLevel: 'C1', genre: 'argumentative essay',
    wordTarget: '200–250 words', wordMin: 200, wordMax: 250,
    taskType: 'argumentative',
    requiredElements: [
      'thesis statement',
      'at least one concrete example',
      'counter-argument acknowledged',
      'rebuttal or qualification',
      'formal academic register (no contractions, precise vocabulary)',
    ],
    tip: 'Use formal connectors: "Notwithstanding", "While it is true that...", "That said", "Consequently".',
  },
];
