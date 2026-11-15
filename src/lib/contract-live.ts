// ---------- Live layer (CAP-40; signal/laneb/live-layer.md) ----------
// The host console's live controls, generic over the template, and one public live view by join code.
// - lockEntries: entries close now, on the server clock (ENTRIES_LOCKED for later joins).
// - startLive: locks entries and starts (dealt: deals teams; mixer: goes live). Live start mode only.
// - runHostAction(action, payload): dispatches to the template's host actions, host only.
// - endChallenge (#58) ends and resolves; approvePayouts, myPayout and claimPayout are unchanged.
// Entry stays free and nothing purchasable affects play.
import type { ChallengeStatus, PayoutAdapterId, RewardPolicy } from './contract';

export type LiveErrorCode =
  | 'ENTRIES_LOCKED' // joining after the host locked entries or started, on the server clock
  | 'UNKNOWN_HOST_ACTION' // the template declares no host action by that name
  | 'HOST_ACTION_RATE_LIMITED'; // the same host action again inside its minimum interval
// Host actions from anyone but the creator fail NOT_CREATOR. A template's own refusals arrive as ConvexError data
// { code, message } with the template's code, e.g. 'NOTHING_TO_UNDO'.

// open: published, taking entries. locked: entries closed, not started. live: started. ended, cancelled: final.
export type LivePhase = 'draft' | 'open' | 'locked' | 'live' | 'ended' | 'cancelled';

// One placed team or player once the challenge has ended. Names only: no device token, Whop id or payout state.
export type LiveLeaderboardRow = { place: number; label: string; memberNames: string[]; inMoney: boolean };

// Public, by join code, with no device token: safe to read from a stream overlay later.
export type LiveView = {
  challengeId: string;
  joinCode: string;
  title: string;
  creator: { displayName: string; handle: string };
  templateId: string;
  status: ChallengeStatus;
  phase: LivePhase;
  serverNow: number;
  entryCount: number;
  entriesLocked: boolean;
  lockedAt: number | null;
  poolCents: number;
  reward: RewardPolicy;
  payoutAdapter: PayoutAdapterId; // concept: label the prize as a concept
  hostActions: string[]; // what runHostAction accepts for this template; [] when it has none
  view: unknown; // the template's public overlayView(state); null when it has none
  leaderboard: LiveLeaderboardRow[] | null; // top 10 once ended; null before
};

// Engine-session templates (quick-quiz): the host's runHostAction('next', { expectedIndex, expectedPhase }) opens or
// closes the next question for every team at once. Pass the board round's index and phase the host saw: if the round
// has moved on (a double tap), Next does nothing and returns the current board. Index alone can't tell an open
// question from its closed leaderboard, so send both; a scheduled tick closes it at its time limit, and play ends when the last question closes.
// view is the template's publicBoard: { round, rows: [{ label, points, answeredCurrent, rank }] }.
export type TeamSessionView = {
  teamLabel: string;
  serverNow: number;
  shared: unknown; // the template's shared view for the team (quick-quiz: opened questions, correct ones once closed)
  mine: unknown; // this player's private view
};

export type UseLiveView = (code: string | null) => LiveView | null | undefined; // null = no such challenge
export type UseLockEntries = (challengeId: string) => () => Promise<void>; // host only
export type UseStartLive = (challengeId: string) => () => Promise<void>; // host only; NOT_ENOUGH_PLAYERS
export type UseRunHostAction = (challengeId: string) => (action: string, payload?: unknown) => Promise<{ view: unknown }>; // host only
export type UseTeamSessionView = (challengeId: string | null) => TeamSessionView | null | undefined; // null = not on a dealt team
export type UsePlayerAction = (challengeId: string) => (action: { type: string; [key: string]: unknown }) => Promise<void>; // the template's refusal codes
