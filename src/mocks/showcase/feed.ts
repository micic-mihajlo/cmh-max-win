import type { BountyView, FeedLiveRow, FeedResultRow, FeedUpcomingRow, FollowingFeedView, StreamerCardView, StreamerPageView } from '@/lib/contract';

const at = (day: number, hour: number) => new Date(2026, 10, day, hour).getTime();
const serverNow = at(15, 14);
const bounty = (dollars: number, slots: number): BountyView => ({
  totalCents: dollars * 100,
  currency: 'usd',
  winnerSlots: slots,
  perSquadCents: Math.floor((dollars * 100) / slots),
  mode: 'concept',
});

const cards: StreamerCardView[] = [
  { streamerId: 'danny', name: 'Danny Ortiz', followerCount: 12400, live: true, following: true },
  { streamerId: 'kevin', name: 'Kevin', followerCount: 3200, live: true, following: true },
  { streamerId: 'brandon', name: 'Brandon', followerCount: 8100, live: false, following: true },
  { streamerId: 'kayla', name: 'Kayla Brooks', followerCount: 5600, live: false, following: true },
];

const live: FeedLiveRow[] = [
  { streamerId: 'danny', streamerName: 'Danny Ortiz', dropId: 'd-danny', title: 'The Aurora Seed', joinCode: 'K7QX', dropStatus: 'scheduled', entrantCount: 38, bounty: bounty(300, 3), liveSince: serverNow - 120_000 },
  { streamerId: 'kevin', streamerName: 'Kevin', dropId: 'd-kevin', title: 'Signal Fire', joinCode: 'MBRT', dropStatus: 'live', entrantCount: 21, bounty: bounty(100, 2), liveSince: serverNow - 3_600_000 },
];

const upcoming: FeedUpcomingRow[] = [
  { streamerId: 'kayla', streamerName: 'Kayla Brooks', dropId: 'u-kayla', title: 'The Cold Room', joinCode: 'COLD', startsAt: serverNow + 120_000, bounty: bounty(120, 2), reminded: true, squadmates: ['Sarah', 'Jen'] },
  { streamerId: 'brandon', streamerName: 'Brandon', dropId: 'u-brandon', title: 'Glass Harbor II', joinCode: 'HRBR', startsAt: at(17, 20), bounty: bounty(150, 3), reminded: false },
  { streamerId: 'danny', streamerName: 'Danny Ortiz', dropId: 'u-danny', title: 'The Second Seed', joinCode: 'SEED', startsAt: at(20, 21), bounty: bounty(500, 5), reminded: false },
];

const result = (streamerId: string, streamerName: string, title: string, day: number, squad: string, names: string[]): FeedResultRow => ({
  streamerId,
  streamerName,
  dropId: `r-${streamerId}-${day}`,
  title,
  playerCount: 48,
  endedAt: at(day, 21),
  winner: { squadLabel: squad, memberNames: names, solveMs: 161_000 },
  mine: null,
});

const past: Record<string, FeedResultRow[]> = {
  danny: [result('danny', 'Danny Ortiz', 'Orchard Lights', 8, 'Squad 3', ['Nicole', 'Matt', 'Megan']), result('danny', 'Danny Ortiz', 'Night Ferry', 1, 'Squad 2', ['Sarah', 'Jen', 'Steph'])],
  kevin: [result('kevin', 'Kevin', 'Blue Hour', 9, 'Squad 5', ['Chris', 'Nicole'])],
  brandon: [result('brandon', 'Brandon', 'Glass Harbor', 10, 'Squad 9', ['Chris', 'Nicole']), result('brandon', 'Brandon', 'Low Water', 3, 'Squad 1', ['Megan', 'Matt'])],
  kayla: [result('kayla', 'Kayla Brooks', 'Paper Moon', 7, 'Squad 4', ['Jen', 'Sarah', 'Steph'])],
};

export const feed: FollowingFeedView = { following: cards, live, upcoming, results: Object.values(past).flat().slice(0, 5), serverNow };

export const streamers = cards;

export function streamerPage(id: string): StreamerPageView | null {
  const card = cards.find((c) => c.streamerId === id);
  if (!card) return null;
  return {
    ...card,
    liveDrop: live.find((l) => l.streamerId === id) ?? null,
    nextDrop: upcoming.find((u) => u.streamerId === id) ?? null,
    past: past[id] ?? [],
    serverNow,
  };
}
