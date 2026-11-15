// SIGNAL client contract (Lane B owns this file).
// Lane A builds mocks against these types; Lane B's hooks in src/hooks/use-*.ts implement the signatures.
// Every call resolves the caller from the device token in src/lib/device.ts; no member id is ever sent by the client.

export type Role = 'detective' | 'hacker' | 'witness';
export type SuspectId = 'theo' | 'priya' | 'ines' | 'jun';
export type CaseId = 'case01' | 'aurora01'; // aurora01 = the drops squad cut (signal/design/demo-challenge.md)

// Coarse presence. 'offline' comes from the server's presence component (no heartbeat in ~25s, or the app
// went to the background), never from a client. While playing, 'ready' means "locked in the current revision".
export type Presence = 'online' | 'reviewing' | 'ready' | 'offline';
export type SettablePresence = Exclude<Presence, 'offline'>;

// lobby -> intro (host started) -> playing (all 3 marked ready on the intro) -> resolved.
// There is no 'checking' status: the server checks inside the lock-in that completes 3 of 3,
// so "Checking..." is a client-side pending state on that lockIn call.
export type RoomStatus = 'lobby' | 'intro' | 'playing' | 'resolved';

export type MemberView = {
  memberId: string; // display/key only; the server never accepts it as identity
  name: string;
  role: Role | null; // primary role (the seal and color)
  roles: Role[]; // every role whose evidence this player holds: 1 in a squad of 3, 1 or 2 in a squad of 2
  presence: Presence;
  isHost: boolean;
  isMe: boolean;
};

export type TheoryView = {
  culprit: SuspectId | null;
  revision: number;
  lastEditedBy: { memberId: string; name: string } | null;
};

export type NudgeView = {
  wrongPick: SuspectId; // the culprit the crew guessed, never the answer
  forRole: Role;
  text: string;
  revision: number; // the theory revision this nudge answered
  holder: { memberId: string; name: string } | null; // drops: who holds the piece that places wrongPick (render "Your …" when it's me)
};

export type SquadSize = 2 | 3;

export type RoomView = {
  code: string; // 4 chars, uppercase
  status: RoomStatus;
  squadSize: SquadSize | TeamSize; // 3 for a private room, 2 or 3 in a drop, 1 to 4 for a challenge team
  drop: {
    dropId: string;
    title: string;
    squadLabel: string;
    rank: number | null; // finishing place once solved
    isWinner: boolean; // rank <= winnerSlots
  } | null; // set when this room is a drop squad
  cooldownUntil: number | null; // drops: lock-in is disabled until this server time after a wrong check (20s)
  caseId: CaseId;
  isHost: boolean;
  me: { memberId: string; role: Role | null; name: string } | null; // null = this device isn't a member (join / reclaim)
  members: MemberView[];
  theory: TheoryView;
  lockIns: { memberId: string; revision: number }[]; // only lock-ins for theory.revision
  attempts: number;
  lastNudge: NudgeView | null; // set after a wrong check, cleared on the next theory edit
  // The revision the server last checked and found wrong. Lock-ins for it are rejected (ALREADY_CHECKED),
  // so canLockIn = theory.culprit !== null && theory.revision !== checkedRevision && status === 'playing'.
  checkedRevision: number | null;
  // Monotonic count of answer checks. Play the seal/outcome animation once when lastCheck.seq goes past the
  // last seq this phone has seen; on first load (or rejoin) record the current seq without playing it.
  checkSeq: number;
  lastCheck: { seq: number; result: 'wrong' | 'correct'; at: number } | null;
  // Roles whose holder is offline. A device that isn't a member can take one over with useReclaimRole.
  reclaimableRoles: Role[];
};

// Only ever the caller's own role; the server never sends another role's dossier.
export type DossierView = {
  pieceId?: 'camera' | 'witness' | 'scene'; // set for aurora01 pieces
  role: Role;
  docLabel: string; // 'SYSTEMS LOG' | 'STATEMENT' | 'SCENE NOTES'
  title: string;
  lines: { time?: string; text: string }[];
  notes?: string;
};

// null until the room is resolved.
export type RevealView = {
  culprit: SuspectId;
  headline: string; // e.g. 'Jun took the seed.'
  timeline: { time: string; text: string }[];
  why: string;
  credits: { role: Role; memberName: string; cleared: SuspectId; line: string }[];
  teaser: { title: string; text: string };
};

// For the cover's rejoin banner: the room this device is still a member of, if any.
export type ActiveRoomView = { code: string; status: RoomStatus; role: Role | null } | null;

// Errors thrown by mutations carry one of these codes in ConvexError data: { code }.
export type SignalErrorCode =
  | 'ROOM_NOT_FOUND'
  | 'ROOM_FULL'
  | 'CASE_STARTED'
  | 'NOT_A_MEMBER'
  | 'ROLE_TAKEN'
  | 'NOT_HOST'
  | 'ROLES_NOT_FILLED'
  | 'WRONG_STATUS'
  | 'STALE_REVISION'
  | 'ALREADY_CHECKED'
  | 'CONFIRM_REQUIRED'
  | 'DROP_NOT_FOUND'
  | 'DROP_CLOSED' // entries close at the start time; a late joiner gets this
  | 'DROP_FULL' // a new device entering a drop that already seats DROP_CAPACITY (150) players
  | 'RATE_LIMITED' // too many tries; data.retryAfterMs says when the next one can succeed
  | 'NOT_ENTERED'
  | 'COOLDOWN' // drops: a lock-in during the 20s after a wrong check
  | 'DEMO_CONTROLS_OFF'
  | 'NOT_ENOUGH_PLAYERS' // dealSquads below 4 entrants // demo:* mutations on a deployment without SIGNAL_DEMO_CONTROLS=on
  | 'CHALLENGE_NOT_FOUND'
  | 'NOT_CREATOR' // a host-only challenge action from anyone but its creator
  | 'NO_PROFILE' // creating a challenge before saving a creator profile
  | 'HANDLE_TAKEN'
  | 'INVALID_CONFIG' // publish with config issues; data.issues: ConfigIssue[]
  | 'CHALLENGE_CLOSED' // joining after entry closed, or a host action in the wrong status
  | 'CHALLENGE_CANCELLED'
  | 'NOT_ELIGIBLE' // reserved: whop_members enforcement after Sign in with Whop
  | 'WHOP_SIGN_IN_REQUIRED' // joining a requireWhopToJoin challenge, or claiming, without a linked Whop account
  | 'CLAIM_EXPIRED'
  | 'WHOP_NOT_CONFIGURED' // publishing a whop_members challenge on a deployment without Whop sign-in
  | 'PLAYER_NOT_FOUND' // mixer: no entrant with that player code in this challenge
  | 'DUPLICATE_COLOR' // mixer: the team already has that color
  | 'ALREADY_IN_TEAM' // mixer: a player sits in one team at a time
  | 'TEAM_LOCKED' // mixer: the team locked, so nobody joins or leaves
  | 'TEAM_NOT_FULL' // mixer: confirming before every color is in
  | 'TEAM_NOT_LOCKED'

export type SignalError = { code: SignalErrorCode; message: string };

// joined: new member. rejoined: this device was already a member (same member, role, state).
// reclaim: the case started or the room is full, but these offline seats can be taken over.
export type JoinResult = {
  code: string;
  status: 'joined' | 'rejoined' | 'reclaim';
  reclaimableRoles: Role[];
};

export type LockInResult =
  | { outcome: 'locked'; lockedCount: number } // waiting for the others
  | { outcome: 'wrong'; nudge: NudgeView; attempts: number }
  | { outcome: 'resolved' };

// ---------- Drops: creator challenges with a skill-only bounty ----------
// A drop is free to enter. At startsAt the server splits entrants, in entry order, into squads of the drop's
// squadSize. N = 3: remainder 2 -> one duo, remainder 1 -> two duos (4 -> 2+2, 7 -> 3+2+2). N = 2: remainder 1
// -> one trio. Fewer than 2 entrants: the drop ends and the lone entrant is unmatched. Each squad is a RoomView
// room that starts at 'intro' with pieces already dealt (a duo has one 2-piece phone and one 1-piece phone). The first winnerSlots squads to resolve correctly win, ranked by the order the
// server committed their correct final lock-in (serializable, so no ties and nothing random).

export type DropStatus = 'scheduled' | 'live' | 'ended';
export type BountyMode = 'concept' | 'sandbox';

// Squad-assignment choreography runs this long after startsAt on every phone; the race clock and solveMs start
// at startsAt + RACE_REVEAL_MS. Rank is commit order and doesn't depend on it.
export const RACE_REVEAL_MS = 2400;

// Rounding: perPlayerCents = floor(totalCents / winnerSlots / squadSize), and a squad's share is
// perPlayerCents * squadSize. Any remainder stays with the creator.
export type BountyView = {
  totalCents: number;
  currency: 'usd';
  winnerSlots: number; // X: the first X correct squads split the pool
  perSquadCents: number; // floor(totalCents / winnerSlots), before the per-player rounding above
  mode: BountyMode; // 'concept' moves no money and must be labeled as a concept in the UI
};

export type DropSummaryView = {
  dropId: string; // slug, e.g. 'aurora-demo'
  title: string;
  creatorName: string;
  caseId: CaseId;
  squadSize: SquadSize; // target size N
  joinCode?: string | null; // always set by the server: 4 chars, unique among drops that aren't ended; what the host QR encodes
  hosted?: boolean; // made by a host screen (drops:hostDrop): dealt by the host, startsAt is only a placeholder, concept payout only
  startsAt: number; // ms epoch, server clock
  status: DropStatus;
  entrantCount: number;
  bounty: BountyView;
  winnersSoFar: number;
};

// The waiting room before start, and the drop hub after it.
export type DropView = DropSummaryView & {
  entrants: { name: string; isMe: boolean }[]; // names only, in entry order
  me: {
    entered: boolean;
    name: string | null;
    squad: { code: string; size: SquadSize; label: string } | null; // set at start; open the room with this code
    unmatched: boolean; // entered, but the drop started with nobody left to pair with
  };
};

export type LeaderboardRow = {
  rank: number | null; // 1-based finishing place once solved, null while still solving
  squadLabel: string; // 'Squad 3'
  memberNames: string[];
  status: 'solving' | 'solved' | 'winner';
  solveMs: number | null; // commit time of the correct final lock-in minus (startsAt + RACE_REVEAL_MS), floored at 0
  attempts: number;
  isMine: boolean;
};

export type LeaderboardView = {
  dropId: string;
  status: DropStatus;
  startsAt: number;
  winnerSlots: number;
  rows: LeaderboardRow[]; // solved squads by rank, then solving squads by squad label
};

// Only the members of the winning squad ever receive this; everyone else gets null.
export type SquadAwardView = {
  place: number;
  amountCents: number; // the squad's share = perPlayerCents * redeemableCount
  perPlayerCents: number; // floor(totalCents / winnerSlots / squadSize)
  currency: 'usd';
  mode: BountyMode;
  status: 'pending' | 'ready' | 'failed';
  claimUrl: string | null; // a Whop claim link, one claim per player; null in concept mode
  redeemableCount: number; // = squad size
  expiresAt: number | null; // ms epoch the claim link expires (Whop default 24h); null in concept mode
  label: string; // e.g. 'Concept payout — no real money moves'
};

// Hook signatures. Queries return undefined while loading and null when there is nothing to show.
export type UseActiveRoom = () => ActiveRoomView | undefined;
export type UseRoom = (code: string | null) => RoomView | null | undefined; // null = no such room; also keeps this device's presence alive
export type UseMyDossier = (code: string | null) => DossierView | null | undefined; // primary role only
export type UseMyEvidence = (code: string | null) => DossierView[] | null | undefined; // every dossier this player holds
export type UseReveal = (code: string | null) => RevealView | null | undefined;

export type UseCreateRoom = () => (args: { name: string }) => Promise<{ code: string }>;
export type UseJoinRoom = () => (args: { code: string; name: string }) => Promise<JoinResult>;
// Claiming while holding another role switches to the new one if it's free; a taken role throws ROLE_TAKEN.
export type UseClaimRole = (code: string) => (role: Role) => Promise<void>;
// Rebinds the offline holder's member (role, lock-in, host flag) to this device. Throws ROLE_TAKEN if they're online.
export type UseReclaimRole = (code: string) => (role: Role) => Promise<void>;
export type UseStartCase = (code: string) => () => Promise<void>;
export type UseSetPresence = (code: string) => (presence: SettablePresence) => Promise<void>;
export type UseSetTheory = (code: string) => (culprit: SuspectId | null) => Promise<{ revision: number }>;
export type UseLockIn = (code: string) => (revision: number) => Promise<LockInResult>;
export type UseRestart = (code: string) => (args: { confirm: true }) => Promise<void>;
export type UseLeaveRoom = (code: string) => () => Promise<void>;
// This device's own socket, for the reconnecting banner (others' presence is in members[].presence).
export type UseConnection = () => { connected: boolean; everConnected: boolean };

// ---- Whop season pack (Lane B, CMHM-11) ----
// A real, server-verified purchase through Whop's hosted checkout (sandbox for the demo).
// 'owned' comes only from a Convex entitlement written after Whop's payment.succeeded webhook
// is verified and the payment is re-read from Whop's API; the browser result never unlocks it.
// The concept card stays a separate Lane A component and must never render from this view.
export type PackId = 'season01';
// locked: not bought · checkout: Whop checkout is open · verifying: checkout returned, waiting
// for the server-verified entitlement · owned: entitlement exists.
export type SeasonPackState = 'locked' | 'checkout' | 'verifying' | 'owned';
export type SeasonPackView = {
  pack: PackId;
  state: SeasonPackState;
  real: true;
  environment: 'sandbox' | 'production' | null; // set once owned; the demo shows "test purchase" for sandbox
  error: string | null; // e.g. Whop not configured, checkout creation failed
};
// view is undefined while loading.
export type UseSeasonPack = () => { view: SeasonPackView | undefined; buy: () => Promise<void> };

// ---- Sign in with Whop (Lane B, CMHM-11) ----
// Only winners sign in. Anyone plays on the device token; a device holding a winning seat signs in
// with Whop to claim, and whichever Whop account it uses (whopUserId) gets paid. The server only
// starts sign-in for a winning seat and links the account to the device token that started it.
// OAuth tokens never reach the client.
export type WhopAccountView = {
  whopUserId: string;
  name: string;
  username: string | null;
  avatarUrl: string | null;
  environment: 'sandbox' | 'production';
};
// available is false when the deployment has no Whop OAuth app; hide sign-in then.
export type WhopAccountState = { available: boolean; account: WhopAccountView | null };
// unavailable: no Whop OAuth app configured · not_winner: this device holds no winning seat for that
// code · no_profile: creator sign-in without a creator profile · cancelled: the person closed the sheet.
export type WhopSignInResult = 'linked' | 'cancelled' | 'error' | 'unavailable' | 'not_winner' | 'no_profile';
export type UseWhopAccount = () => WhopAccountState | undefined; // undefined while loading
// From the win screen: code is the squad's or challenge team's room code (same as UseMyAward); returnPath is the app
// route the sheet returns to (e.g. 'drop/abc/win'). Show the button only when useMyAward returns an award.
export type UseLinkForClaim = (code: string | null, returnPath: string) => () => Promise<WhopSignInResult>;
export type UseSignOutWhop = () => () => Promise<void>;

export type UseDrops = () => DropSummaryView[] | undefined; // scheduled and live drops, soonest first
export type UseDrop = (dropId: string | null) => DropView | null | undefined;
export type UseLeaderboard = (dropId: string | null) => LeaderboardView | null | undefined;
export type UseMyAward = (code: string | null) => SquadAwardView | null | undefined;
// The big shared host screen (signal/design/host.md). Only the device that created the drop can read it.
export type HostView = {
  dropId: string;
  title: string;
  joinCode: string;
  status: DropStatus;
  bounty: BountyView; // display only; hosted drops always pay in concept mode
  entrantCount: number;
  entrants: { name: string; joinedAt: number }[]; // join order
  squads: {
    squadLabel: string;
    memberNames: string[];
    status: 'solving' | 'solved' | 'winner';
    rank: number | null;
  }[]; // empty until the deal, then in deal order
  solves: { place: number; squadLabel: string; solvedAt: number; solveMs: number; isWinner: boolean }[]; // commit order
};

export type UseHostView = (dropId: string | null) => HostView | null | undefined; // null = not the host, or no such drop
// creatorName heads the race ("Nova's drop"). Omitted: the newest name this device token used server-side, else "Host".
export type UseHostDrop = () => (args: { title?: string; winnerSlots?: number; totalCents?: number; creatorName?: string }) => Promise<{ dropId: string; joinCode: string }>;
export type UseDealSquads = (dropId: string) => () => Promise<void>; // host only; NOT_ENOUGH_PLAYERS below 4

export type UseDropByCode = (code: string | null) => DropView | null | undefined; // null = no open drop with that code
export type UseEnterDropByCode = () => (args: { code: string; name: string }) => Promise<{ dropId: string }>;
export type UseEnterDrop = (dropId: string) => (args: { name: string }) => Promise<void>; // free, idempotent
export type UseLeaveDrop = (dropId: string) => () => Promise<void>; // waiting room only
// Milliseconds to add to Date.now() to get server time, measured once per mount with a mutation round-trip
// (queries are cached, so a serverNow field on a query can be arbitrarily stale). null until measured.
export type UseServerOffset = () => number | null;

// ---------- Creator console: challenges (CAP-31; signal/laneb/creator-console.md) ----------
// A challenge is a drop that a creator owns and configures: draft -> published (open, has a join code) -> live
// (teams dealt) -> ended (results final) or cancelled. Drops above keep working unchanged.
// Identity is the device token for now, behind one server helper (resolveIdentity) that Sign in with Whop replaces.

export type ChallengeTemplateId = 'mystery-aurora' | 'split-passphrase'; // ids from the CAP-32 template registry
export type ChallengeTemplateView = {
  id: ChallengeTemplateId;
  name: string; // 'The Aurora Seed'
  blurb: string;
  teamSizes: TeamSize[]; // team sizes this template can be played at (same field as the template interface, CAP-32); mystery-aurora: [1, 2, 3, 4]
  formations: TeamFormation[]; // dealt teams play mystery-aurora for now; mixer needs a template with mixer support (split-passphrase)
};

// Team sizes the platform supports in v1. A template declares the subset it handles.
export type TeamSize = 1 | 2 | 3 | 4;

export type LeftoverPolicy = 'smaller_teams' | 'wait_next_round'; // dealt mode: players who don't fill a whole team

// dealt (the default): the server deals teams of teamSize in entry order, as drops do.
// mixer: each player gets a color (round-robin over mixerColors) and a private fragment unique to them. A team is
// exactly one player of each color, formed by entering each other's player codes; it locks when every member
// confirms. The answer is checked against the fragments of that team's members, so a fragment shared outside the
// team is useless. The first locked teams to submit a correct answer take the places.
export type TeamFormation = 'dealt' | 'mixer';
export type MixerColor = 'red' | 'blue' | 'green' | 'yellow';
export type StartMode = 'live' | 'scheduled' | 'window';
// live: the host deals. scheduled: teams are dealt at startsAt. window: open until endsAt, and a team forms each
// time teamSize players are waiting; at endsAt the leftover policy applies to whoever is still waiting.

export type Eligibility = { kind: 'open' } | { kind: 'whop_members'; productId: string };

export type RewardPolicy =
  | { kind: 'winner_takes_all' }
  | { kind: 'top_x_equal'; places: number } // places >= 1
  | { kind: 'placement'; percents: number[] }; // the default, [50, 30, 20]: percents[i] is place i+1's share; positive integers that sum to 100
// Challenges are team vs team: teams finish in places 1st, 2nd, 3rd... on the server clock, and the pool is split by
// place. Within a team the place's amount is split equally per player.

export type PayoutAdapterId = 'concept' | 'whop';
// concept (default): moves no money; rows end as sent_concept and must be labelled as a concept in the UI.
// whop: Whop transfer to the player's Whop user id, or a one-claim claim link when the player has no Whop account.
// Only server-created challenges can use whop for now; a creator's own challenge is always concept.

export type ChallengeConfig = {
  title: string; // 1..60 chars
  blurb: string; // 0..280 chars
  templateId: ChallengeTemplateId;
  teamFormation: TeamFormation;
  teamSize: TeamSize; // dealt: must be one of the template's teamSizes. mixer: ignored, a team is one of each color
  mixerColors: MixerColor[]; // mixer only: 2 to 4 distinct colors, default ['red', 'blue', 'green']
  leftover: LeftoverPolicy;
  startMode: StartMode;
  startsAt: number | null; // ms epoch; required for scheduled, ignored otherwise
  endsAt: number | null; // ms epoch; required for window, an optional deadline for live and scheduled
  eligibility: Eligibility;
  reward: RewardPolicy;
  poolCents: number; // integer >= 0
  currency: 'usd';
  payoutAdapter: PayoutAdapterId;
  requireWhopToJoin: boolean; // forced true for whop_members; recommended for large pools. Otherwise Whop is needed only to claim
  claimWindowMs: number; // how long a winner has to claim after approval; default 7 days. Unclaimed shares return to the pool
};
export type ChallengeConfigPatch = Partial<ChallengeConfig>;
export type ConfigIssue = { field: keyof ChallengeConfig; message: string }; // why publish would be refused

export type ChallengeStatus = 'draft' | 'published' | 'live' | 'ended' | 'cancelled';

export type CreatorProfileView = {
  creatorId: string; // stable id; the device token's creator today, the Whop user later
  displayName: string;
  handle: string; // '@nova', unique, lowercase a-z 0-9 _
  identity: 'device' | 'whop';
};

export type EligibilityView = {
  kind: Eligibility['kind'];
  productId: string | null;
  enforced: boolean; // false until Sign in with Whop: whop_members is stored but nobody is turned away yet
  note: string | null; // e.g. 'Whop membership is recorded but not checked yet.'
};

export type FundingView = {
  status: 'none' | 'committed_concept'; // committed_concept: a ledger commitment at publish, no money held
  amountCents: number;
  committedAt: number | null;
  label: string; // e.g. 'Concept funding — no real money is held'
};

export type ChallengeSummaryView = {
  challengeId: string;
  status: ChallengeStatus;
  config: ChallengeConfig;
  joinCode: string | null; // set at publish
  creator: { displayName: string; handle: string };
  entrantCount: number;
  teamCount: number;
  createdAt: number;
  publishedAt: number | null;
  endedAt: number | null;
};

// The draft editor: the current config and everything publish would refuse.
export type ChallengeDraftView = ChallengeSummaryView & { issues: ConfigIssue[]; template: ChallengeTemplateView };

export type ChallengeTeamView = {
  teamId: string;
  label: string; // 'Team 1'
  memberNames: string[];
  status: 'playing' | 'finished' | 'unfinished'; // unfinished: the challenge ended before they finished
  place: number | null; // finishing place, 1-based
  finishedAt: number | null; // ms epoch, server commit time
  finishMs: number | null; // finishedAt minus the moment the team was dealt
};

export type ChallengeResultRow = {
  place: number;
  teamLabel: string;
  memberNames: string[];
  finishMs: number;
  inMoney: boolean; // a paid place under the reward policy
};

// Exact integer cents. Each paid place gets its budget (winner_takes_all: the pool; top_x_equal:
// floor(pool / places); placement: floor(pool * percent / 100)), split per player rounding down. Every leftover
// cent goes to first place's first player (entry order). Budgets of places nobody filled return to the creator.
// Invariant: paidCents + returnedCents === poolCents, where returnedCents = sum(returned).
// Before approval paidCents is what the policy allocates; afterwards an expired claim moves its share into returned.
export type PayoutPreviewView = {
  poolCents: number;
  paidCents: number;
  returnedCents: number;
  returned: { unfilledPlacesCents: number; expiredCents: number }; // back to the creator
  lines: {
    place: number;
    teamLabel: string;
    budgetCents: number; // the place's budget before the per-player rounding
    players: { name: string; cents: number; status: PayoutStatus | null }[]; // status: the ledger row, null before approval
  }[];
};

// Whop is needed only to claim (unless requireWhopToJoin): anyone plays on the device identity, and only a winning
// device is asked to sign in with Whop; whichever Whop account it signs in with is paid. pending -> approved (Whop
// already linked) or claim_pending_whop (waiting for the winner to sign in and claim) -> sent | sent_concept | failed.
// expired: unclaimed after claimWindowMs, returned to the pool. Only the device that played the seat can claim it.
export type PayoutStatus =
  | 'pending'
  | 'claim_pending_whop'
  | 'approved'
  | 'sent'
  | 'sent_concept'
  | 'failed'
  | 'expired';
export type PayoutRowView = {
  name: string;
  place: number;
  teamLabel: string;
  cents: number;
  status: PayoutStatus;
  adapter: PayoutAdapterId;
  method: 'concept' | 'transfer' | 'claim_link' | null; // how the adapter paid; null until sent
  claimExpiresAt: number | null; // claim_pending_whop only
  error: string | null;
};

// The host console: everything the creator sees while running a challenge. Readable only by its creator.
export type HostConsoleView = ChallengeSummaryView & {
  eligibility: EligibilityView;
  funding: FundingView;
  entrants: { name: string; joinedAt: number; teamLabel: string | null; waitingNextRound: boolean }[]; // entry order
  teams: ChallengeTeamView[];
  results: ChallengeResultRow[]; // finishers so far, by place
  serverNow: number; // ms epoch at query time, for a drift-free countdown
  timeLeftMs: number | null; // until startsAt (scheduled, before the deal) or endsAt; null when neither applies
  cancelReason: string | null;
  can: { deal: boolean; end: boolean; cancel: boolean; approvePayouts: boolean; clone: boolean };
  payoutPreview: PayoutPreviewView | null; // once ended
  payouts: PayoutRowView[]; // the payout ledger, after approvePayouts; empty before
};

// What an entrant (or someone holding the code) sees.
export type PlayerChallengeView = {
  challengeId: string;
  status: ChallengeStatus;
  title: string;
  blurb: string;
  templateId: ChallengeTemplateId;
  creator: { displayName: string; handle: string };
  joinCode: string | null;
  startMode: StartMode;
  teamSize: number;
  startsAt: number | null;
  endsAt: number | null;
  serverNow: number;
  entrantCount: number;
  reward: RewardPolicy;
  poolCents: number;
  payoutAdapter: PayoutAdapterId;
  eligibility: EligibilityView;
  cancelled: { reason: string; at: number } | null; // set when the host cancelled; show it instead of the game
  me: {
    entered: boolean;
    name: string | null;
    team: { teamId: string; label: string; roomCode: string; size: TeamSize } | null; // open the RoomView with roomCode
    waitingNextRound: boolean; // left over under wait_next_round
    mixer: MixerMeView | null; // mixer mode, once entered
  };
  requireWhopToJoin: boolean;
  teamFormation: TeamFormation;
};

// ---------- Mixer mode ----------
export type MixerFragmentView = {
  title: string; // e.g. 'CAMERA LOG · RED'
  text: string; // private to this player and unique to them; never shown to anyone else
};

export type MixerTeamMemberView = {
  name: string;
  color: MixerColor;
  playerCode: string;
  confirmed: boolean;
  isMe: boolean;
};

export type MixerTeamView = {
  teamId: string;
  label: string; // 'Team 4', set when it forms
  status: 'forming' | 'locked' | 'solved'; // forming: linking and confirming; locked: playing; solved: correct answer in
  members: MixerTeamMemberView[]; // in link order
  missingColors: MixerColor[]; // colors still needed before anyone can confirm
  attempts: number; // wrong answers so far
  cooldownUntil: number | null; // after a wrong answer, the next submit waits until this (ms epoch, server clock)
  place: number | null; // once solved
};

export type MixerMeView = {
  color: MixerColor;
  playerCode: string; // 4 characters; teammates enter it to link with you
  fragment: MixerFragmentView;
  team: MixerTeamView | null; // null while still looking
};

export type MixerSubmitResult =
  | { outcome: 'correct'; place: number }
  | { outcome: 'wrong'; attempts: number; cooldownUntil: number; nudge: string | null }; // nudge from the template

// Live mixer standings: teams formed, teams solved in order, and who is still looking by color.
export type MixerStandingsView = {
  challengeId: string;
  status: ChallengeStatus;
  serverNow: number;
  endsAt: number | null;
  colors: MixerColor[];
  paidPlaces: number;
  entrantCount: number;
  teamsForming: number;
  teamsLocked: number; // locked and still solving
  solved: { place: number; teamLabel: string; memberNames: string[]; solvedAt: number; finishMs: number }[]; // by place
  lookingByColor: { color: MixerColor; count: number }[]; // entrants in no team yet
};

export type MyPayoutView = {
  place: number;
  teamLabel: string;
  cents: number;
  status: PayoutStatus;
  adapter: PayoutAdapterId;
  method: 'concept' | 'transfer' | 'claim_link' | null;
  claimUrl: string | null; // claim_link method only
  claimExpiresAt: number | null; // claim_pending_whop: claim before this or the share returns to the pool
  needsWhopSignIn: boolean; // claim_pending_whop and this device has no linked Whop account yet
  label: string; // e.g. 'Concept payout — no real money moves'
};

// The shareable recap card once a challenge has ended.
export type ChallengeRecapView = {
  challengeId: string;
  title: string;
  creator: { displayName: string; handle: string };
  templateId: ChallengeTemplateId;
  status: 'ended' | 'cancelled';
  endedAt: number;
  entrantCount: number;
  teamCount: number;
  poolCents: number;
  paidCents: number;
  payoutAdapter: PayoutAdapterId;
  podium: (ChallengeResultRow & { cents: number })[]; // paid places with each team's total
  fastestFinishMs: number | null;
};

export type UseCreatorProfile = () => CreatorProfileView | null | undefined; // null = no profile yet
export type UseSaveCreatorProfile = () => (args: { displayName: string; handle: string }) => Promise<CreatorProfileView>; // HANDLE_TAKEN
export type UseChallengeTemplates = () => ChallengeTemplateView[] | undefined;
export type UseMyChallenges = () => ChallengeSummaryView[] | undefined; // the creator's own, newest first
export type UseCreateChallenge = () => (patch?: ChallengeConfigPatch) => Promise<{ challengeId: string }>; // needs a profile
export type UseChallengeDraft = (challengeId: string | null) => ChallengeDraftView | null | undefined; // creator only
export type UseUpdateChallengeDraft = (challengeId: string) => (patch: ChallengeConfigPatch) => Promise<{ issues: ConfigIssue[] }>;
export type UsePublishChallenge = (challengeId: string) => () => Promise<{ joinCode: string }>; // INVALID_CONFIG lists issues in data.issues
export type UseHostConsole = (challengeId: string | null) => HostConsoleView | null | undefined; // null = not the creator
export type UseDealTeams = (challengeId: string) => () => Promise<void>; // live mode only; NOT_ENOUGH_PLAYERS below one team
export type UseEndChallenge = (challengeId: string) => () => Promise<void>;
export type UseCancelChallenge = (challengeId: string) => (reason: string) => Promise<void>;
export type UseApprovePayouts = (challengeId: string) => () => Promise<{ approved: number; alreadyApproved: number }>; // idempotent
export type UseCloneChallenge = (challengeId: string) => () => Promise<{ challengeId: string }>; // a new draft with the same config
export type UseChallengeByCode = (code: string | null) => PlayerChallengeView | null | undefined;
export type UseJoinChallenge = () => (args: { code: string; name: string }) => Promise<{ challengeId: string }>;
export type UseLeaveChallenge = (challengeId: string) => () => Promise<void>; // before your team is dealt
export type UseMyChallenge = (challengeId: string | null) => PlayerChallengeView | null | undefined;
export type UseMyPayout = (challengeId: string | null) => MyPayoutView | null | undefined; // null = nothing for you
export type UseClaimPayout = (challengeId: string) => () => Promise<MyPayoutView>; // WHOP_SIGN_IN_REQUIRED, CLAIM_EXPIRED; idempotent
// Live standings for dealt teams: every team's progress against the others. Readable by anyone with the challenge id.
// Rank: finished teams by place (finish time on the server clock, commit order on ties), then unfinished teams by
// how far along they are, then fewer wrong attempts, then team label.
export type ChallengeStage = 'briefing' | 'investigating' | 'locking_in' | 'finished';
export type ChallengeStandingRow = {
  teamId: string;
  label: string;
  memberNames: string[];
  rank: number; // 1-based current rank among all teams
  place: number | null; // final placement once finished
  progress: { stage: ChallengeStage; step: number; steps: number; lockedIn: number; attempts: number }; // step of steps (3 = finished)
  finishedAt: number | null; // ms epoch, server clock
  finishMs: number | null;
  isMine: boolean;
};
export type ChallengeStandingsView = {
  challengeId: string;
  status: ChallengeStatus;
  serverNow: number;
  endsAt: number | null;
  paidPlaces: number;
  rows: ChallengeStandingRow[]; // by rank
};
export type UseChallengeStandings = (challengeId: string | null) => ChallengeStandingsView | null | undefined;

export type UseMixerStandings = (challengeId: string | null) => MixerStandingsView | null | undefined;
// Link with another player by their code: forms a team with them, adds them to yours, or joins theirs.
// Errors: PLAYER_NOT_FOUND, DUPLICATE_COLOR, ALREADY_IN_TEAM (either of you is in another team), TEAM_LOCKED.
export type UseLinkPlayer = (challengeId: string) => (playerCode: string) => Promise<MixerTeamView>;
export type UseLeaveMixerTeam = (challengeId: string) => () => Promise<void>; // until the team locks; clears confirmations
export type UseConfirmMixerTeam = (challengeId: string) => () => Promise<MixerTeamView>; // TEAM_NOT_FULL; locks on the last confirm
export type UseSubmitMixerAnswer = (challengeId: string) => (answer: string) => Promise<MixerSubmitResult>; // TEAM_NOT_LOCKED, COOLDOWN

export type UseChallengeRecap = (challengeId: string | null) => ChallengeRecapView | null | undefined; // null until ended

export * from './contract-growth';
export * from './contract-whop';
