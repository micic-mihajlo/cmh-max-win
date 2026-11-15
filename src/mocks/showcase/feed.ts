export type Streamer = { id: string; name: string; initials: string; bio: string; nextDrop: string; past: string[] };
export type LiveRoom = { streamerId: string; challenge: string; code: string };
export type ScheduledDrop = { id: string; streamerId: string; when: string; challenge: string; reminded: boolean };
export type FeedNotification =
  | { id: string; kind: 'live'; streamerId: string; challenge: string; code: string; when: string }
  | { id: string; kind: 'starting'; streamerId: string; minutes: number; when: string };

export const streamers: Streamer[] = [
  { id: 'nova', name: 'Nova', initials: 'N', bio: 'Mystery drops for squads of three.', nextDrop: 'Friday 9 pm', past: ['The Aurora Seed', 'Orchard Lights', 'Night Ferry'] },
  { id: 'rook', name: 'Rook', initials: 'R', bio: 'Harbor noir, one case a week.', nextDrop: 'Tuesday 8 pm', past: ['Glass Harbor', 'Low Water', 'The Lamplighter'] },
  { id: 'juno', name: 'Juno', initials: 'J', bio: 'Cold cases, warm rooms.', nextDrop: 'Thursday 6 pm', past: ['The Cold Room', 'Paper Moon', 'Static'] },
  { id: 'pax', name: 'Pax', initials: 'P', bio: 'Short puzzles, loud squads.', nextDrop: 'Sunday 7 pm', past: ['Signal Fire', 'Blue Hour', 'Tin Can'] },
];

export const live: LiveRoom[] = [
  { streamerId: 'nova', challenge: 'The Aurora Seed', code: 'K7QX' },
  { streamerId: 'pax', challenge: 'Signal Fire', code: 'MBRT' },
];

export const upcoming: ScheduledDrop[] = [
  { id: 'd1', streamerId: 'nova', when: 'Friday 9 pm', challenge: 'The Second Seed', reminded: true },
  { id: 'd2', streamerId: 'rook', when: 'Tuesday 8 pm', challenge: 'Glass Harbor II', reminded: false },
  { id: 'd3', streamerId: 'juno', when: 'Thursday 6 pm', challenge: 'The Cold Room', reminded: false },
];

export const notifications: FeedNotification[] = [
  { id: 'n1', kind: 'live', streamerId: 'nova', challenge: 'The Aurora Seed', code: 'K7QX', when: 'Now' },
  { id: 'n2', kind: 'starting', streamerId: 'nova', minutes: 2, when: '2 min ago' },
  { id: 'n3', kind: 'live', streamerId: 'pax', challenge: 'Signal Fire', code: 'MBRT', when: '1 h ago' },
];
