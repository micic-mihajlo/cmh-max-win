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
  { streamerId: 'nova', name: 'Nova', followerCount: 12400, live: true, following: true },
  { streamerId: 'pax', name: 'Pax', followerCount: 3200, live: true, following: true },
  { streamerId: 'rook', name: 'Rook', followerCount: 8100, live: false, following: true },
  { streamerId: 'juno', name: 'Juno', followerCount: 5600, live: false, following: true },
];

const live: FeedLiveRow[] = [
  { streamerId: 'nova', streamerName: 'Nova', dropId: 'd-nova', title: 'The Aurora Seed', joinCode: 'K7QX', dropStatus: 'scheduled', entrantCount: 38, bounty: bounty(300, 3), liveSince: serverNow - 120_000 },
  { streamerId: 'pax', streamerName: 'Pax', dropId: 'd-pax', title: 'Signal Fire', joinCode: 'MBRT', dropStatus: 'live', entrantCount: 21, bounty: bounty(100, 2), liveSince: serverNow - 3_600_000 },
];

const upcoming: FeedUpcomingRow[] = [
  { streamerId: 'juno', streamerName: 'Juno', dropId: 'u-juno', title: 'The Cold Room', joinCode: 'COLD', startsAt: serverNow + 120_000, bounty: bounty(120, 2), reminded: true, squadmates: ['Lou', 'Ana'] },
  { streamerId: 'rook', streamerName: 'Rook', dropId: 'u-rook', title: 'Glass Harbor II', joinCode: 'HRBR', startsAt: at(17, 20), bounty: bounty(150, 3), reminded: false },
  { streamerId: 'nova', streamerName: 'Nova', dropId: 'u-nova', title: 'The Second Seed', joinCode: 'SEED', startsAt: at(20, 21), bounty: bounty(500, 5), reminded: false },
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
  nova: [result('nova', 'Nova', 'Orchard Lights', 8, 'Squad 3', ['Mae', 'Theo', 'Ivy']), result('nova', 'Nova', 'Night Ferry', 1, 'Squad 2', ['Lou', 'Ana', 'Rae'])],
  pax: [result('pax', 'Pax', 'Blue Hour', 9, 'Squad 5', ['Kit', 'Mae'])],
  rook: [result('rook', 'Rook', 'Glass Harbor', 10, 'Squad 9', ['Kit', 'Mae']), result('rook', 'Rook', 'Low Water', 3, 'Squad 1', ['Ivy', 'Theo'])],
  juno: [result('juno', 'Juno', 'Paper Moon', 7, 'Squad 4', ['Ana', 'Lou', 'Rae'])],
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
