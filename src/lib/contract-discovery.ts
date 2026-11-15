// ---------- Creator discovery: public creator page, share links, follows and reminders (CAP-45) ----------
// Everything here is public, so it carries only what a stranger may see: display names, handles, titles,
// public times and the prize-pool display. Never device tokens, Whop product ids, entrant lists or fragments.
import type { ChallengeTemplateId, StartMode } from './contract';

// upcoming: published, not started (scheduled, or live mode waiting for the stream). open: a window challenge
// taking players now. live: teams are playing. ended / cancelled: over.
export type ChallengePhase = 'upcoming' | 'open' | 'live' | 'ended' | 'cancelled';

export type PrizePoolView = {
  cents: number;
  display: string; // '$100', '$1,250.50', 'No prize'
  concept: boolean; // true: concept payouts, no real money moves
  label: string; // 'Free to enter · $100 prize pool', or with ' (concept)'
};

export type ChallengeCardView = {
  challengeId: string;
  title: string;
  blurb: string;
  templateId: ChallengeTemplateId;
  phase: ChallengePhase;
  startMode: StartMode;
  startsAt: number | null; // scheduled only; null with live mode means "starts on stream"
  endsAt: number | null;
  membersOnly: boolean; // Whop members only
  prizePool: PrizePoolView;
  joinCode: string | null;
  slug: string; // 'nova-friday-race-k7qm'; share as /c/<slug>, resolves with UseShareLink
  entrantCount: number;
};

export type WinnerTeamView = { place: number; teamLabel: string; memberNames: string[] }; // public display names only

export type PastChallengeCardView = ChallengeCardView & { endedAt: number; winners: WinnerTeamView[] };

export type CreatorPageView = {
  creatorId: string;
  displayName: string;
  handle: string; // '@nova'
  followerCount: number;
  following: boolean; // this device, or its Whop account
  live: ChallengeCardView[]; // live and open now, newest first
  upcoming: ChallengeCardView[]; // soonest first; live-mode challenges (no start time) after timed ones
  recent: PastChallengeCardView[]; // ended, newest first, at most 5
  serverNow: number;
};

// A link preview: safe to render for anyone, including unfurl bots.
export type SharePreviewView = {
  challengeId: string;
  title: string;
  creator: { displayName: string; handle: string };
  phase: ChallengePhase;
  startMode: StartMode;
  startsAt: number | null;
  endsAt: number | null;
  membersOnly: boolean;
  prizePool: PrizePoolView;
  joinCode: string | null; // null once it's over
  slug: string;
  serverNow: number;
};

export type ChallengeReminderView = {
  challengeId: string;
  title: string;
  creator: { displayName: string; handle: string };
  startMode: StartMode;
  startsAt: number | null; // null: live mode, starts when the stream goes live
  joinCode: string | null;
  squadmates?: string[]; // first names of up to 3 others already joined, or on this device's team; never this device
};

export type HandleCheckView = { handle: string; available: boolean; problem: string | null }; // handle is normalized

export type UseCreatorPage = (handle: string | null) => CreatorPageView | null | undefined; // null = no such creator
// ref: a join code ('K7QM'), a slug ('nova-friday-race-k7qm', 'nova/K7QM'), a share URL, or a challenge id.
export type UseShareLink = (ref: string | null) => SharePreviewView | null | undefined; // null = nothing public to show
export type UseCheckHandle = (handle: string | null) => HandleCheckView | undefined;
// Idempotent both ways. Follows are the same follows the drops feed uses (contract-feed.ts).
export type UseFollowCreator = (handle: string) => {
  follow: () => Promise<{ following: boolean; followerCount: number }>;
  unfollow: () => Promise<{ following: boolean; followerCount: number }>;
};
// "Notify me when this starts": follows the creator and stores a reminder; idempotent. Push delivery comes later.
// CHALLENGE_CLOSED unless the challenge is published and not started (scheduled or live mode).
export type UseRemindChallenge = (challengeId: string) => { remind: () => Promise<void>; cancel: () => Promise<void> };
export type UseUpcomingReminders = () => ChallengeReminderView[] | undefined; // timed soonest first, then live mode
