import { BountyResultScreen } from '@/components/drops/bounty-result';
import { RACE_REVEAL_MS, type DossierView, type DropView, type LeaderboardRow, type LeaderboardView, type SquadAwardView } from '@/lib/contract';
import { CreatorSetupScreen } from '@/components/drops/creator-setup';
import { DropEntryScreen } from '@/components/drops/drop-entry';
import { JoinCodeScreen } from '@/components/drops/join-code';
import { LeaderboardScreen } from '@/components/drops/leaderboard';
import { SquadRevealScreen, type SquadMemberView } from '@/components/drops/squad-reveal';
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

const piece = (role: DossierView['role'], docLabel: string, title: string, text: string): DossierView => ({ role, docLabel, title, lines: [{ text }] });
const camera = piece('hacker', 'CAMERA LOG', 'Station systems', 'The dock camera shows Theo at the docking ring from 21:30 to 21:50. He never left.');
const witness = piece('witness', 'STATEMENT', 'Dr. Sam Reyes, medic', 'Priya played Go with me in the lounge from 21:30 to 21:50. Neither of us got up.');

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
  myPayout: { status: 'concept', amountCents: 3333 },
  split: [
    { name: 'Nova', cents: 3333, isMe: true },
    { name: 'Rex', cents: 3333, isMe: false },
    { name: 'Ivy', cents: 3333, isMe: false },
  ],
  ...over,
});
const paid = (myPayout: SquadAwardView['myPayout']) =>
  award({
    mode: 'sandbox',
    label: 'Squad 14 · 3rd place',
    myPayout,
    split: [
      { name: 'Kit', cents: 3333, isMe: true },
      { name: 'Lou', cents: 3333, isMe: false },
      { name: 'Ana', cents: 3333, isMe: false },
    ],
  });

const bounty = drop().bounty;
const nova = { title: 'The Aurora Seed', totalCents: 30000, winnerSlots: 3 };

export const DropStates: MockState[] = [
  { id: '10-creator-card', ref: 'beat 2', section: 'Drops', title: 'Creator · prefilled drop card', render: () => <CreatorSetupScreen drop={nova} /> },
  {
    id: '10-creator-live',
    ref: 'beat 2',
    section: 'Drops',
    title: 'Creator · live drop card (live count in the app)',
    render: () => <CreatorSetupScreen drop={nova} live={{ entrantCount: 212, shareUrl: 'signal.gg/aurora' }} />,
  },
  {
    id: '11-join-empty',
    ref: 'host.md',
    section: 'Drops',
    title: 'Join · code tiles empty',
    render: () => <JoinCodeScreen code="" phase="typing" name="Kit" onScan={() => {}} />,
  },
  {
    id: '11-join-typing',
    ref: 'host.md',
    section: 'Drops',
    title: 'Join · typing',
    render: () => <JoinCodeScreen code="KR" phase="typing" name="Kit" onScan={() => {}} />,
  },
  {
    id: '11-join-error',
    ref: 'host.md',
    section: 'Drops',
    title: 'Join · no drop with that code',
    render: () => <JoinCodeScreen code="KRQZ" phase="error" name="Kit" />,
  },
  { id: '11-join-in', ref: 'host.md', section: 'Drops', title: 'Join · you’re in', render: () => <JoinCodeScreen code="KRQX" phase="joined" name="Kit" /> },
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
  { id: '12-waiting', ref: 'beat 3', section: 'Drops', title: 'Waiting room · countdown', render: () => <WaitingRoomScreen offset={0} drop={drop()} /> },
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
    ref: 'beat 4',
    section: 'Drops',
    title: 'Squad reveal · squad of 3',
    render: () => <SquadRevealScreen drop={live(3)} members={trio} pieces={[camera]} />,
  },
  {
    id: '13-squad-duo',
    ref: 'D4',
    section: 'Drops',
    title: 'Squad reveal · squad of 2 (2 + 1 pieces)',
    render: () => <SquadRevealScreen drop={live(2)} members={duo} pieces={[camera, witness]} />,
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
        racing={{ pick: 'Ines Vale', locked: 2, size: 3, nudge: 'Not Ines. Ask Ana to read the Scene Notes.', cooldownUntil: loadedAt + 20_000 }}
      />
    ),
  },
  {
    id: '14-race-money',
    ref: 'beat 7',
    section: 'Drops',
    title: 'Race · landing at #3',
    render: () => <LeaderboardScreen offset={0} drop={live(3)} board={moneyBoard} roles={['hacker', 'witness', 'detective']} />,
  },
  {
    id: '15-win-concept',
    ref: 'beat 8',
    section: 'Drops',
    title: 'Payout · static CONCEPT card',
    render: () => <BountyResultScreen award={award()} bounty={bounty} />,
  },
  { id: '16-payout-sign-in', ref: 'payout', section: 'Payout', title: 'Payout · sign in with Whop', render: () => <BountyResultScreen award={paid({ status: 'sign_in_required', amountCents: 3333 })} bounty={bounty} /> },
  { id: '16-payout-sending', ref: 'payout', section: 'Payout', title: 'Payout · sending', render: () => <BountyResultScreen award={paid({ status: 'sending', amountCents: 3333 })} bounty={bounty} /> },
  { id: '16-payout-sent', ref: 'payout', section: 'Payout', title: 'Payout · sent', render: () => <BountyResultScreen award={paid({ status: 'sent', amountCents: 3333 })} bounty={bounty} /> },
  {
    id: '16-payout-failed',
    ref: 'payout',
    section: 'Payout',
    title: 'Payout · failed (KYC)',
    render: () => <BountyResultScreen award={paid({ status: 'failed', amountCents: 3333, failureCode: 'kyc_required' })} bounty={bounty} />,
  },
];
