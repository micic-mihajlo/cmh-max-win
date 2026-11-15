import { BountyResultScreen } from '@/components/drops/bounty-result';
import type { DropView, LeaderboardRow, LeaderboardView, SquadAwardView, SquadMemberView } from '@/components/drops/contract';
import { CreatorSetupScreen, type CreatorDraft } from '@/components/drops/creator-setup';
import { DropEntryScreen } from '@/components/drops/drop-entry';
import { LeaderboardScreen } from '@/components/drops/leaderboard';
import { SquadRevealScreen } from '@/components/drops/squad-reveal';
import { WaitingRoomScreen } from '@/components/drops/waiting-room';

import type { MockState } from './gallery';

const startsAt = 1_763_236_800_000;
const before = startsAt - 252_000;
const during = startsAt + 94_000;

const crowd = ['Kit', 'Lou', 'Hal', 'Ivy', 'Jo', 'Fay', 'Sam', 'Noor', 'Ade', 'Bea', 'Cal', 'Dev', 'Eli', 'Gus', 'Ana', 'Rio', 'Tess', 'Maya'];

function drop(over: Partial<DropView> = {}, me: Partial<DropView['me']> = {}): DropView {
  const entrants = [...crowd.map((name) => ({ name, isMe: false })), { name: 'Ravi', isMe: true }];
  return {
    dropId: 'aurora-demo',
    title: 'The Aurora Seed',
    creatorName: '@nova',
    caseId: 'case01',
    startsAt,
    status: 'scheduled',
    entrantCount: 37,
    bounty: {
      totalCents: 15000,
      currency: 'usd',
      winnerSlots: 3,
      perSquadCents: 5000,
      mode: 'sandbox',
    },
    winnersSoFar: 0,
    entrants,
    me: { entered: true, name: 'Ravi', squad: null, unmatched: false, ...me },
    ...over,
  };
}

const live = (size: 2 | 3) => drop({ status: 'live', entrantCount: 37 }, { squad: { code: size === 3 ? 'SQ4A' : 'SQ4B', size, label: 'Squad 4' } });

const trio: SquadMemberView[] = [
  {
    memberId: 'm_ravi',
    name: 'Ravi',
    role: 'hacker',
    roles: ['hacker'],
    isMe: true,
  },
  {
    memberId: 'm_maya',
    name: 'Maya',
    role: 'detective',
    roles: ['detective'],
    isMe: false,
  },
  {
    memberId: 'm_lena',
    name: 'Lena',
    role: 'witness',
    roles: ['witness'],
    isMe: false,
  },
];
const duo: SquadMemberView[] = [
  {
    memberId: 'm_ravi',
    name: 'Ravi',
    role: 'hacker',
    roles: ['hacker', 'witness'],
    isMe: true,
  },
  {
    memberId: 'm_maya',
    name: 'Maya',
    role: 'detective',
    roles: ['detective'],
    isMe: false,
  },
];

const r = (
  rank: number | null,
  n: number,
  names: string[],
  status: LeaderboardRow['status'],
  solveMs: number | null,
  attempts = 1,
  isMine = false,
): LeaderboardRow => ({
  rank,
  squadLabel: `Squad ${n}`,
  memberNames: names,
  status,
  solveMs,
  attempts,
  isMine,
});

const board = (rows: LeaderboardRow[]): LeaderboardView => ({
  dropId: 'aurora-demo',
  status: 'live',
  startsAt,
  winnerSlots: 3,
  rows,
});

const raceRows = [
  r(1, 7, ['Kit', 'Lou', 'Hal'], 'winner', 31_000),
  r(2, 2, ['Ivy', 'Jo'], 'winner', 44_000, 2),
  r(null, 1, ['Fay', 'Sam', 'Noor'], 'solving', null),
  r(null, 3, ['Ade', 'Bea', 'Cal'], 'solving', null),
  r(null, 4, ['Ravi', 'Maya', 'Lena'], 'solving', null, 1, true),
  r(null, 5, ['Dev', 'Eli', 'Gus'], 'solving', null),
  r(null, 6, ['Ana', 'Rio'], 'solving', null),
];
const fullRows = [
  r(1, 7, ['Kit', 'Lou', 'Hal'], 'winner', 31_000),
  r(2, 2, ['Ivy', 'Jo'], 'winner', 44_000, 2),
  r(3, 4, ['Ravi', 'Maya', 'Lena'], 'winner', 52_000, 1, true),
  r(4, 5, ['Dev', 'Eli', 'Gus'], 'solved', 61_000),
  r(5, 1, ['Fay', 'Sam', 'Noor'], 'solved', 73_000, 2),
  r(null, 3, ['Ade', 'Bea', 'Cal'], 'solving', null),
  r(null, 6, ['Ana', 'Rio'], 'solving', null),
];

const award = (over: Partial<SquadAwardView> = {}): SquadAwardView => ({
  place: 3,
  amountCents: 5000,
  perPlayerCents: 1666,
  currency: 'usd',
  mode: 'sandbox',
  status: 'ready',
  claimUrl: 'https://whop.com/claim/aurora-demo-3-k2f9q',
  redeemableCount: 3,
  label: 'Squad 4 · 3rd place',
  ...over,
});
const conceptAward = award({
  mode: 'concept',
  claimUrl: null,
  label: 'Concept payout — no real money moves',
});
const myWin = fullRows[2];
const mySixth = r(6, 4, ['Ravi', 'Maya', 'Lena'], 'solved', 88_000, 3, true);

const draft: CreatorDraft = {
  title: 'The Aurora Seed',
  squadSize: 3,
  totalCents: 15000,
  winnerSlots: 3,
  startsInMin: 5,
  mode: 'sandbox',
};
const squad = ['Ravi', 'Maya', 'Lena'];

export const DropStates: MockState[] = [
  {
    id: '10-creator-setup',
    ref: 'D1',
    section: 'Drops',
    title: 'Creator · set up a drop (trios)',
    render: () => <CreatorSetupScreen draft={draft} />,
  },
  {
    id: '10-creator-duos-concept',
    ref: 'D1',
    section: 'Drops',
    title: 'Creator · duos, concept payout',
    render: () => (
      <CreatorSetupScreen
        draft={{
          ...draft,
          squadSize: 2,
          totalCents: 10000,
          winnerSlots: 5,
          mode: 'concept',
        }}
      />
    ),
  },
  {
    id: '10-creator-publishing',
    ref: 'D1',
    section: 'Drops',
    title: 'Creator · going live',
    render: () => <CreatorSetupScreen draft={draft} publishing />,
  },
  {
    id: '11-entry',
    ref: 'D2',
    section: 'Drops',
    title: 'Follower · drop card + Join',
    render: () => <DropEntryScreen drop={drop({ entrantCount: 36 }, { entered: false })} now={before} />,
  },
  {
    id: '11-entry-closed',
    ref: 'D2',
    section: 'Drops',
    title: 'Follower · DROP_CLOSED (late)',
    render: () => <DropEntryScreen drop={drop({ status: 'live' }, { entered: false })} now={during} error="DROP_CLOSED" />,
  },
  {
    id: '12-waiting',
    ref: 'D3',
    section: 'Drops',
    title: 'Waiting room · countdown',
    render: () => <WaitingRoomScreen drop={drop()} now={before} />,
  },
  {
    id: '12-waiting-forming',
    ref: 'D3',
    section: 'Drops',
    title: 'Waiting room · forming squads',
    render: () => <WaitingRoomScreen drop={drop()} now={startsAt} forming />,
  },
  {
    id: '12-waiting-unmatched',
    ref: 'D3',
    section: 'Drops',
    title: 'Waiting room · unmatched (lone entrant)',
    render: () => (
      <WaitingRoomScreen
        drop={drop(
          {
            status: 'live',
            entrantCount: 1,
            entrants: [{ name: 'Ravi', isMe: true }],
          },
          { unmatched: true },
        )}
        now={during}
      />
    ),
  },
  {
    id: '13-squad-trio',
    ref: 'D4',
    section: 'Drops',
    title: 'Squad reveal · squad of 3',
    render: () => <SquadRevealScreen drop={live(3)} members={trio} />,
  },
  {
    id: '13-squad-duo',
    ref: 'D4',
    section: 'Drops',
    title: 'Squad reveal · squad of 2 (2+1 pieces)',
    render: () => <SquadRevealScreen drop={live(2)} members={duo} />,
  },
  {
    id: '14-race',
    ref: 'D5',
    section: 'Drops',
    title: 'Leaderboard · racing, 1 slot left',
    render: () => <LeaderboardScreen drop={live(3)} board={board(raceRows)} now={during} />,
  },
  {
    id: '14-race-full',
    ref: 'D5',
    section: 'Drops',
    title: 'Leaderboard · slots taken, we placed 3rd',
    render: () => <LeaderboardScreen drop={live(3)} board={board(fullRows)} now={during + 30_000} />,
  },
  {
    id: '15-bounty-real',
    ref: 'D6',
    section: 'Drops',
    title: 'Bounty · winner, verified claim link',
    render: () => <BountyResultScreen drop={live(3)} row={myWin} award={award()} squad={squad} />,
  },
  {
    id: '15-bounty-pending',
    ref: 'D6',
    section: 'Drops',
    title: 'Bounty · winner, link pending',
    render: () => <BountyResultScreen drop={live(3)} row={myWin} award={award({ status: 'pending', claimUrl: null })} squad={squad} />,
  },
  {
    id: '15-bounty-concept',
    ref: 'D6',
    section: 'Drops',
    title: 'Bounty · winner, CONCEPT',
    render: () => <BountyResultScreen drop={live(3)} row={myWin} award={conceptAward} squad={squad} />,
  },
  {
    id: '15-bounty-none',
    ref: 'D6',
    section: 'Drops',
    title: 'Bounty · solved 6th, no bounty',
    render: () => <BountyResultScreen drop={live(3)} row={mySixth} award={null} squad={squad} />,
  },
];
