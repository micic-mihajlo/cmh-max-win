import { BountyResultScreen, type CreditedMember } from '@/components/drops/bounty-result';
import {
  RACE_REVEAL_MS,
  type DropView,
  type LeaderboardRow,
  type LeaderboardView,
  type SquadAwardView,
  type SquadMemberView,
} from '@/components/drops/contract';
import { CreatorSetupScreen, type CreatorDraft } from '@/components/drops/creator-setup';
import { DropEntryScreen } from '@/components/drops/drop-entry';
import { LeaderboardScreen } from '@/components/drops/leaderboard';
import { SquadRevealScreen } from '@/components/drops/squad-reveal';
import { WaitingRoomScreen } from '@/components/drops/waiting-room';

import type { MockState } from './gallery';

// Fixture times are relative to when the gallery loads, with a server offset of 0, so countdowns tick live.
const loadedAt = Date.now();
const opensIn = loadedAt + 161_000;
const startedAgo = (raceMs: number) => loadedAt - RACE_REVEAL_MS - raceMs;
const startsAt = opensIn;

const crowd = ['Kit', 'Maya', 'Jo', 'Ana', 'Lou', 'Hal', 'Ivy', 'Fay', 'Sam', 'Noor'];

function drop(over: Partial<DropView> = {}, me: Partial<DropView['me']> = {}): DropView {
  return {
    dropId: 'aurora-demo',
    title: 'The Aurora Seed',
    creatorName: '@nova',
    caseId: 'case01',
    squadSize: 3,
    startsAt,
    status: 'scheduled',
    entrantCount: 212,
    bounty: { totalCents: 30000, currency: 'usd', winnerSlots: 3, perSquadCents: 10000, mode: 'concept' },
    winnersSoFar: 0,
    entrants: [...crowd.map((name) => ({ name, isMe: false })), { name: 'Ravi', isMe: true }],
    me: { entered: true, name: 'Ravi', squad: null, unmatched: false, ...me },
    ...over,
  };
}

const live = (size: 2 | 3) =>
  drop({ status: 'live', startsAt: startedAgo(0) }, { squad: { code: size === 3 ? 'SQ14' : 'SQ15', size, label: size === 3 ? 'Squad 14' : 'Squad 15' } });

const trio: SquadMemberView[] = [
  { memberId: 'm_ravi', name: 'Ravi', role: 'hacker', roles: ['hacker'], isMe: true },
  { memberId: 'm_ivy', name: 'Ivy', role: 'witness', roles: ['witness'], isMe: false },
  { memberId: 'm_jo', name: 'Jo', role: 'detective', roles: ['detective'], isMe: false },
];
const duo: SquadMemberView[] = [
  { memberId: 'm_ravi', name: 'Ravi', role: 'hacker', roles: ['hacker', 'witness'], isMe: true },
  { memberId: 'm_lou', name: 'Lou', role: 'detective', roles: ['detective'], isMe: false },
];

const row = (rank: number | null, n: number, status: LeaderboardRow['status'], solveMs: number | null, wrongGuesses = 0, isMine = false): LeaderboardRow => ({
  rank,
  squadLabel: `Squad ${n}`,
  memberNames: [],
  status,
  solveMs,
  attempts: wrongGuesses,
  isMine,
});
const solving = (from: number, count: number) => Array.from({ length: count }, (_, i) => row(null, from + i, 'solving', null));
const board = (rows: LeaderboardRow[], raceMs: number): LeaderboardView => ({
  dropId: 'aurora-demo',
  status: 'live',
  startsAt: startedAgo(raceMs),
  winnerSlots: 3,
  rows,
});

const racingBoard = board([row(1, 7, 'winner', 41_000), row(2, 22, 'winner', 58_000), row(null, 14, 'solving', null, 0, true), ...solving(30, 68)], 72_000);
const moneyBoard = board(
  [
    row(1, 7, 'winner', 41_000),
    row(2, 22, 'winner', 58_000),
    row(3, 14, 'winner', 86_000, 0, true),
    row(4, 3, 'solved', 91_000),
    row(5, 40, 'solved', 104_000),
    ...solving(50, 60),
  ],
  110_000,
);
const missedBoard = board(
  [
    row(1, 7, 'winner', 41_000),
    row(2, 22, 'winner', 58_000),
    row(3, 3, 'winner', 86_000),
    ...[4, 5, 6, 7, 8].map((rank) => row(rank, 40 + rank, 'solved', 90_000 + rank * 4_000)),
    row(9, 14, 'solved', 123_000, 1, true),
    ...solving(60, 40),
  ],
  130_000,
);

const award = (over: Partial<SquadAwardView> = {}): SquadAwardView => ({
  place: 3,
  amountCents: 10000,
  perPlayerCents: 3333,
  currency: 'usd',
  mode: 'concept',
  status: 'ready',
  claimUrl: null,
  expiresAt: null,
  redeemableCount: 3,
  label: 'Concept payout — no real money moves',
  ...over,
});
const winAt = loadedAt;
const realAward = award({
  mode: 'sandbox',
  claimUrl: 'https://whop.com/claim/aurora-demo-3',
  expiresAt: winAt + 24 * 3600_000 - 60_000,
  label: 'Squad 14 · 3rd place',
});

const credits: CreditedMember[] = [
  { name: 'Ravi', isMe: true, roles: ['hacker'] },
  { name: 'Ivy', isMe: false, roles: ['witness'] },
  { name: 'Jo', isMe: false, roles: ['detective'] },
];
const duoCredits: CreditedMember[] = [
  { name: 'Ravi', isMe: true, roles: ['hacker', 'witness'] },
  { name: 'Lou', isMe: false, roles: ['detective'] },
];
const bounty = drop().bounty;

const draft: CreatorDraft = { title: 'The Aurora Seed', squadSize: 3, totalCents: 30000, winnerSlots: 3, startsIn: '5' };

export const DropStates: MockState[] = [
  { id: '10-creator-setup', ref: 'D1', section: 'Drops', title: 'Creator · set up a drop (trios)', render: () => <CreatorSetupScreen draft={draft} /> },
  {
    id: '10-creator-duos',
    ref: 'D1',
    section: 'Drops',
    title: 'Creator · duos, start now',
    render: () => <CreatorSetupScreen draft={{ ...draft, squadSize: 2, startsIn: 'now' }} />,
  },
  { id: '10-creator-opening', ref: 'D1', section: 'Drops', title: 'Creator · opening the drop', render: () => <CreatorSetupScreen draft={draft} opening /> },
  {
    id: '11-entry',
    ref: 'D2',
    section: 'Drops',
    title: 'Follower · drop card + Join',
    render: () => <DropEntryScreen offset={0} drop={drop({ entrantCount: 211 }, { entered: false })} />,
  },
  {
    id: '11-entry-closed',
    ref: 'D2',
    section: 'Drops',
    title: 'Follower · DROP_CLOSED (late)',
    render: () => <DropEntryScreen offset={0} drop={drop({ status: 'live', startsAt: startedAgo(30_000) }, { entered: false })} error="DROP_CLOSED" />,
  },
  { id: '12-waiting', ref: 'D3', section: 'Drops', title: 'Waiting room · countdown', render: () => <WaitingRoomScreen offset={0} drop={drop()} /> },
  {
    id: '12-waiting-unmatched',
    ref: 'D3',
    section: 'Drops',
    title: 'Waiting room · unmatched (lone entrant)',
    render: () => (
      <WaitingRoomScreen
        offset={0}
        drop={drop({ status: 'live', startsAt: startedAgo(0), entrantCount: 1, entrants: [{ name: 'Ravi', isMe: true }] }, { unmatched: true })}
      />
    ),
  },
  {
    id: '13-squad-trio',
    ref: 'D4',
    section: 'Drops',
    title: 'Squad reveal · squad of 3 (2.4 s hold)',
    render: () => <SquadRevealScreen drop={live(3)} members={trio} />,
  },
  {
    id: '13-squad-duo',
    ref: 'D4',
    section: 'Drops',
    title: 'Squad reveal · squad of 2 (2 + 1 pieces)',
    render: () => <SquadRevealScreen drop={live(2)} members={duo} />,
  },
  {
    id: '14-race',
    ref: 'D5',
    section: 'Drops',
    title: 'Race · racing + wrong pick',
    render: () => (
      <LeaderboardScreen
        offset={0}
        drop={live(3)}
        board={racingBoard}
        racing={{ pick: 'Ines Vale', locked: 2, size: 3, nudge: 'Not Ines. Ask Jo to read the Scene Notes.', cooldownMs: 8_000 }}
      />
    ),
  },
  {
    id: '14-race-money',
    ref: 'D5',
    section: 'Drops',
    title: 'Race · solved, in the money (#3)',
    render: () => <LeaderboardScreen offset={0} drop={live(3)} board={moneyBoard} roles={['hacker', 'witness', 'detective']} />,
  },
  {
    id: '14-race-missed',
    ref: 'D5',
    section: 'Drops',
    title: 'Race · solved #9, no bounty this time',
    render: () => <LeaderboardScreen offset={0} drop={live(3)} board={missedBoard} />,
  },
  {
    id: '15-win-concept',
    ref: 'D6',
    section: 'Drops',
    title: 'Win · CONCEPT payout (demo path)',
    render: () => <BountyResultScreen award={award()} bounty={bounty} squadLabel="Squad 14" members={credits} offset={0} />,
  },
  {
    id: '15-win-concept-duo',
    ref: 'D6',
    section: 'Drops',
    title: 'Win · CONCEPT payout, duo',
    render: () => (
      <BountyResultScreen award={award({ perPlayerCents: 5000, redeemableCount: 2 })} bounty={bounty} squadLabel="Squad 15" members={duoCredits} offset={0} />
    ),
  },
  {
    id: '16-win-real-not-demo',
    ref: 'D6',
    section: 'Drops',
    title: 'Not in demo · verified claim link (needs Whop KYC)',
    render: () => <BountyResultScreen award={realAward} bounty={bounty} squadLabel="Squad 14" members={credits} offset={0} />,
  },
];
