export type Creator = {
  id: string;
  name: string;
  handle: string;
  initials: string;
  tagline: string;
  followers: string;
  live?: boolean;
};

export const me = {
  name: 'Kit Marlowe',
  handle: 'kit',
  initials: 'KM',
  joined: 'Joined Nov 2026',
  stats: [
    { value: '12', label: 'Cases solved' },
    { value: '7', label: 'Squads' },
    { value: '#1', label: 'Best placement' },
    { value: '$83.33', label: 'Bounty earned' },
  ],
  packs: [
    { id: 's01', season: 'Season 01', title: 'The Aurora Seed', creator: 'Nova', episodes: '4', owned: 2 },
    { id: 'glass', season: 'Season 01', title: 'Glass Harbor', creator: 'Rook', episodes: '3', owned: 3 },
  ],
  squads: [
    { id: 'q14', squad: 'Squad 14', members: ['Kit', 'Lou', 'Ana'], drop: 'The Aurora Seed', placement: '#2', earned: '$33.33', when: 'Today' },
    { id: 'q9', squad: 'Squad 9', members: ['Kit', 'Mae'], drop: 'Glass Harbor', placement: '#1', earned: '$50.00', when: 'Nov 8' },
    { id: 'q3', squad: 'Squad 3', members: ['Kit', 'Theo', 'Ivy'], drop: 'Night Ferry', placement: '#6', earned: null, when: 'Nov 1' },
  ],
};

export const creators: Creator[] = [
  { id: 'nova', name: 'Nova', handle: 'nova', initials: 'N', tagline: 'Mystery drops, Sundays at 7', followers: '12.4k', live: true },
  { id: 'rook', name: 'Rook', handle: 'rook', initials: 'R', tagline: 'Harbor noir', followers: '8.1k' },
  { id: 'juno', name: 'Juno', handle: 'juno', initials: 'J', tagline: 'Cold cases, warm rooms', followers: '5.6k' },
  { id: 'pax', name: 'Pax', handle: 'pax', initials: 'P', tagline: 'Puzzles with a pulse', followers: '3.2k' },
];

export const nova = {
  ...creators[0],
  bio: 'I write the case. You bring the squad. First squads to crack it split the pool.',
  drops: '9 drops',
  players: '2.3k players',
  next: {
    title: 'The Second Seed',
    when: 'Sunday · 7:00 PM',
    stakes: '$500 · first 5 squads',
    startsInSeconds: 2 * 3600 + 14 * 60 + 9,
  },
  season: { title: 'Season 01: Aurora', episodes: ['The Aurora Seed', 'The Second Seed', 'Low Tide', 'Last Light'], released: 2 },
  past: [
    { id: 'aurora', title: 'The Aurora Seed', date: 'Nov 15', players: 64, winners: 'Squad 3 · Mae, Theo, Ivy', solve: '2:41' },
    { id: 'orchard', title: 'Orchard Lights', date: 'Nov 8', players: 51, winners: 'Squad 9 · Kit, Mae', solve: '3:07' },
    { id: 'ferry', title: 'Night Ferry', date: 'Nov 1', players: 47, winners: 'Squad 2 · Lou, Ana, Rae', solve: '4:12' },
  ],
};

export const feed = {
  live: [{ id: 'live-nova', creator: 'Nova', initials: 'N', title: 'Orchard Lights: Encore', here: 38, stakes: '$200 · first 2 squads', code: 'KQTZ' }],
  upcoming: [
    { id: 'u1', creator: 'Nova', initials: 'N', title: 'The Second Seed', when: 'Sun 7 PM', stakes: '$500', reminded: true },
    { id: 'u2', creator: 'Rook', initials: 'R', title: 'Glass Harbor II', when: 'Tue 8:30 PM', stakes: '$150', reminded: false },
    { id: 'u3', creator: 'Juno', initials: 'J', title: 'The Cold Room', when: 'Thu 6 PM', stakes: '$120', reminded: false },
  ],
  results: [
    { id: 'r1', creator: 'Nova', initials: 'N', title: 'The Aurora Seed', line: 'Squad 3 won in 2:41', you: 'You placed #2 · $33.33' },
    { id: 'r2', creator: 'Rook', initials: 'R', title: 'Glass Harbor', line: 'Squad 9 won in 3:07', you: 'You placed #1 · $50.00' },
    { id: 'r3', creator: 'Pax', initials: 'P', title: 'Static', line: 'Squad 5 won in 1:58', you: null },
  ],
};

export type Note = {
  id: string;
  kind: 'drop' | 'result' | 'invite' | 'episode';
  initials: string;
  title: string;
  body: string;
  when: string;
  unread?: boolean;
  action?: string;
  group: 'Today' | 'Earlier';
};

export const notes: Note[] = [
  { id: 'n1', kind: 'drop', initials: 'N', title: "Nova's drop goes live in 10 min", body: 'The Second Seed · $500 · first 5 squads', when: '6:50 PM', unread: true, action: 'Open', group: 'Today' },
  { id: 'n2', kind: 'result', initials: 'KM', title: 'Your squad placed #2 · $33.33', body: 'Squad 14 · Kit, Lou, Ana · The Aurora Seed', when: '3:12 PM', unread: true, group: 'Today' },
  { id: 'n3', kind: 'invite', initials: 'L', title: 'Lou invited you to a squad', body: 'For The Second Seed on Sunday', when: '1:40 PM', unread: true, action: 'Join squad', group: 'Today' },
  { id: 'n4', kind: 'episode', initials: 'N', title: 'New episode: The Second Seed', body: 'Season 01: Aurora · episode 2 of 4', when: 'Fri', group: 'Earlier' },
  { id: 'n5', kind: 'result', initials: 'R', title: 'Rook posted results', body: 'Glass Harbor · Squad 9 won in 3:07', when: 'Nov 8', group: 'Earlier' },
];

export const push = { app: 'SIGNAL', when: 'now', title: "Nova's drop goes live in 10 min", body: 'The Second Seed · $500 · first 5 squads. Your squad is ready.' };
