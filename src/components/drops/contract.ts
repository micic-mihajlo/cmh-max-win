// The drops types are on main in @/lib/contract. RACE_REVEAL_MS and SquadAwardView.expiresAt land with
// cmh-max-win#15 (capy/drops-backend-v2); once it merges, delete this file and import from '@/lib/contract'.
import type { MemberView, SquadAwardView as BaseAward } from '@/lib/contract';

export type { BountyMode, BountyView, DropSummaryView, DropView, LeaderboardRow, LeaderboardView, SquadSize } from '@/lib/contract';

export const RACE_REVEAL_MS = 2400;

export type SquadAwardView = BaseAward & { expiresAt: number | null };

export type SquadMemberView = Pick<MemberView, 'memberId' | 'name' | 'role' | 'roles' | 'isMe'>;
