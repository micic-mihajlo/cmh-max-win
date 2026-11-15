// ---------- Creator growth (CAP-43; platform.md section 7) ----------
// Read-only numbers for the creator over #58's challenge records. Counts only: no tokens, Whop ids or answers.
import type { ChallengeStatus, ChallengeTemplateId, PayoutAdapterId } from './contract';

export type ChallengeGrowthView = {
  challengeId: string;
  title: string;
  templateId: ChallengeTemplateId;
  status: ChallengeStatus; // never draft: drafts have no growth view
  createdAt: number;
  endedAt: number | null;
  players: number; // entrants
  completions: number; // players on teams that finished
  winners: number; // players in paid places; 0 when cancelled
  paidCents: number; // payout rows sent or sent_concept; 0 before approval. A concept challenge moves no real money
  payoutAdapter: PayoutAdapterId;
  newWhopMembers: number; // distinct Whop accounts from claims plus members-only joins
};

export type CreatorStatsView = {
  challenges: ChallengeGrowthView[]; // the creator's published challenges, newest first (latest 50; drafts excluded)
  totals: {
    challenges: number;
    players: number;
    completions: number;
    winners: number;
    paidCents: number;
    newWhopMembers: number; // distinct across challenges
  };
};

export type UseChallengeGrowth = (challengeId: string | null) => ChallengeGrowthView | null | undefined; // null = not the creator, or a draft
export type UseCreatorStats = () => CreatorStatsView | null | undefined; // null = no creator profile yet
