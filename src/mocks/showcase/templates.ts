export const challengeTemplates = [
  { id: 'mystery', name: 'Mystery', line: 'Each player holds a true piece that clears one suspect; only the whole squad can name who did it.', ready: true },
  { id: 'split-passphrase', name: 'Split Passphrase', line: 'Each player holds one word; the team wins by saying every word in color order.', ready: false },
  { id: 'find-your-teammate', name: 'Find Your Teammate', line: 'Everyone gets a color and a private fragment; find one player of each color to complete your team.', ready: false },
  { id: 'quick-quiz', name: 'Quick Quiz', line: 'A fast round of questions; the first team to answer them all correctly wins.', ready: false },
] as const;

export type ChallengeTemplateId = (typeof challengeTemplates)[number]['id'];
