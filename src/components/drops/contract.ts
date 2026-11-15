// Mirror of the drops block in src/lib/contract.ts on cmh-max-win#9 (capy/drops-contract, Lane B).
// Once #9 merges, delete this file and import these types from '@/lib/contract' instead.
import type { CaseId, Role } from '@/lib/contract';

export type SquadSize = 2 | 3;
export type DropStatus = 'scheduled' | 'live' | 'ended';
export type BountyMode = 'concept' | 'sandbox';

export type BountyView = {
  totalCents: number;
  currency: 'usd';
  winnerSlots: number;
  perSquadCents: number;
  mode: BountyMode;
};

export type DropSummaryView = {
  dropId: string;
  title: string;
  creatorName: string;
  caseId: CaseId;
  startsAt: number;
  status: DropStatus;
  entrantCount: number;
  bounty: BountyView;
  winnersSoFar: number;
};

export type DropView = DropSummaryView & {
  entrants: { name: string; isMe: boolean }[];
  me: {
    entered: boolean;
    name: string | null;
    squad: { code: string; size: SquadSize; label: string } | null;
    unmatched: boolean;
  };
};

export type LeaderboardRow = {
  rank: number | null;
  squadLabel: string;
  memberNames: string[];
  status: 'solving' | 'solved' | 'winner';
  solveMs: number | null;
  attempts: number;
  isMine: boolean;
};

export type LeaderboardView = {
  dropId: string;
  status: DropStatus;
  startsAt: number;
  winnerSlots: number;
  rows: LeaderboardRow[];
};

export type SquadAwardView = {
  place: number;
  amountCents: number;
  perPlayerCents: number;
  currency: 'usd';
  mode: BountyMode;
  status: 'pending' | 'ready' | 'failed';
  claimUrl: string | null;
  redeemableCount: number;
  label: string;
};

// The slice of RoomView + MemberView (with #9's roles[]) the squad reveal reads.
export type SquadMemberView = {
  memberId: string;
  name: string;
  role: Role | null;
  roles: Role[];
  isMe: boolean;
};
