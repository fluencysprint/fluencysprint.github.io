import type { WritingPromptMeta } from '../../types';

export const englishWritingPrompts2: WritingPromptMeta[] = [
  {
    id: 'en-wp-a1-02',
    title: 'Your typical day (A1)',
    prompt: 'Write about your typical weekday (40–60 words): what time you get up, what you do in the morning, where you go, and what you do in the evening.',
    mode: '5min', cefrLevel: 'A1', genre: 'description',
    wordTarget: '40–60 words', wordMin: 40, wordMax: 60,
    taskType: 'narrative',
    requiredElements: [
      'morning (I get up / I wake up / I have breakfast)',
      'where you go (I go to / I travel to / I work at)',
      'evening (in the evening / at night / after work)',
    ],
    exampleAnswer:
      'I usually get up at seven o\'clock. I have breakfast and take the bus to work. I work in an office until five. In the evening I cook dinner and watch television. Sometimes I go for a walk. I go to bed at about ten o\'clock.',
    tip: 'Use "usually", "sometimes", "every day" to make your routine sound natural.',
  },
  {
    id: 'en-wp-a2-02',
    title: 'Write about a place you like (A2)',
    prompt: 'Write 60–80 words about a place you enjoy visiting. Describe what it looks like, why you like it, and what you do there.',
    mode: '5min', cefrLevel: 'A2', genre: 'description',
    wordTarget: '60–80 words', wordMin: 60, wordMax: 80,
    taskType: 'narrative',
    requiredElements: [
      'name or location (it is / there is / I go to)',
      'description (it is / there are / you can see)',
      'why you like it (I like it because / I love / it makes me feel)',
    ],
    exampleAnswer:
      'One of my favourite places is the park near my house. It has a small lake with ducks and beautiful trees. In spring the flowers are lovely. I go there every weekend to walk, read, or just sit and relax. It is very peaceful and I always feel better after spending time there.',
    tip: 'Use "there is / there are" for descriptions. Use "I like it because…" to explain your feelings.',
  },
  {
    id: 'en-wp-a2-03',
    title: 'Short informal message (A2)',
    prompt: 'Write a short message (60–80 words) to a friend telling them about a film you saw recently. Say what the film was about, whether you liked it, and recommend whether they should see it.',
    mode: '5min', cefrLevel: 'A2', genre: 'informal message',
    wordTarget: '60–80 words', wordMin: 60, wordMax: 80,
    taskType: 'general',
    requiredElements: [
      'what the film was about (it\'s about / the story is about)',
      'opinion (I really enjoyed / I liked / I didn\'t like)',
      'recommendation (you should see it / I recommend / don\'t miss it)',
    ],
    exampleAnswer:
      'Hi! I saw a great film at the cinema last night. It was called "The Journey" and it\'s about a young woman who travels across Europe by train. The story is very moving and the photography is beautiful. I really enjoyed it. I think you would love it too — you should definitely go and see it!',
    tip: 'Keep it friendly and natural. Use "I think", "I really", "definitely" to express opinions.',
  },
  {
    id: 'en-wp-b1-02',
    title: 'For and against social media (B1)',
    prompt: 'Write a 100–120 word paragraph discussing the advantages and disadvantages of social media for young people. Include your conclusion.',
    mode: '10min', cefrLevel: 'B1', genre: 'for and against paragraph',
    wordTarget: '100–120 words', wordMin: 100, wordMax: 120,
    taskType: 'opinion',
    requiredElements: [
      'advantage (one advantage is / social media helps / it allows)',
      'disadvantage (however / on the other hand / a disadvantage is)',
      'conclusion (overall / in conclusion / to sum up)',
    ],
    exampleAnswer:
      'Social media has both advantages and disadvantages for young people. On the positive side, it allows young people to stay connected with friends and family, even at a distance. It also provides a platform for creativity and sharing ideas. However, studies suggest that spending too much time on social media can negatively affect mental health and reduce concentration. Young people may compare themselves to others and feel anxious as a result. Overall, I believe social media is a useful tool if used in moderation, but young people need guidance on how to use it responsibly.',
    tip: 'Structure: advantage → disadvantage → conclusion. Use "however", "on the positive side", "overall".',
  },
  {
    id: 'en-wp-b1-03',
    title: 'Describe a challenge you overcame (B1)',
    prompt: 'Write 120–150 words about a challenge you faced and overcame. What was the problem? What did you do? What did you learn?',
    mode: '10min', cefrLevel: 'B1', genre: 'personal narrative',
    wordTarget: '120–150 words', wordMin: 120, wordMax: 150,
    taskType: 'narrative',
    requiredElements: [
      'the challenge (I had to / I faced / the problem was)',
      'what you did (I decided to / I started / I asked)',
      'what you learned (I learned / it taught me / I realized)',
    ],
    tip: 'Use past tenses to tell the story. Use "as a result", "thanks to", "because of" to show cause and effect.',
  },
  {
    id: 'en-wp-b2-02',
    title: 'Formal letter of complaint (B2)',
    prompt: 'Write a 150–180 word formal letter of complaint to a hotel. You booked a room for two nights but: the room was dirty, the air conditioning was broken, and the staff were unhelpful. Request compensation.',
    mode: '10min', cefrLevel: 'B2', genre: 'formal letter',
    wordTarget: '150–180 words', wordMin: 150, wordMax: 180,
    taskType: 'formal_email',
    requiredElements: [
      'salutation (Dear Sir/Madam)',
      'reason for complaint (I am writing to express my dissatisfaction)',
      'specific problems (the room was / the air conditioning / the staff)',
      'compensation request (I would like to request / I expect)',
      'formal closing (Yours sincerely)',
    ],
    exampleAnswer:
      'Dear Sir or Madam,\n\nI am writing to express my serious dissatisfaction with my recent stay at your hotel from 10 to 12 October.\n\nOn arrival, the room had not been cleaned properly — there was dirt on the floor and the bathroom was in an unsatisfactory state. The air conditioning was completely non-functional throughout my stay, despite reporting the problem twice to reception. Furthermore, the staff showed little interest in resolving either issue and failed to offer an alternative room or any form of apology.\n\nI feel that the standard of service I received was entirely unacceptable, given the price I paid. I would therefore like to request a partial refund of at least 50% of the room rate as compensation for the inconvenience caused.\n\nI look forward to your prompt response.\n\nYours sincerely,\nA. Taylor',
    tip: 'Use "I am writing to…", "Furthermore,", "I would therefore like to…", "I look forward to your prompt response."',
  },
  {
    id: 'en-wp-b2-03',
    title: 'Discuss a technology trend (B2)',
    prompt: 'Write a 160–190 word discursive paragraph on the following statement: "Artificial intelligence will create more jobs than it destroys." Present both sides and give your view.',
    mode: '10min', cefrLevel: 'B2', genre: 'discursive paragraph',
    wordTarget: '160–190 words', wordMin: 160, wordMax: 190,
    taskType: 'argumentative',
    requiredElements: [
      'introduce statement (the claim that / it is often argued)',
      'supporting argument (those who support argue that / on the one hand)',
      'opposing argument (however / critics point out / on the other hand)',
      'conclusion with personal view (in my view / I believe that / ultimately)',
    ],
    tip: 'Use "those who argue that…", "critics, however, point out that…", "in my view,". Include at least one concrete example.',
  },
];
