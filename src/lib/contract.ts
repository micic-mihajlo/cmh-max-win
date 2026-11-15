// SIGNAL client contract (Lane B owns this file).
// Lane A builds mocks against these types; Lane B's hooks in src/hooks/use-*.ts implement the signatures.
// Every call resolves the caller from the device token in src/lib/device.ts; no member id is ever sent by the client.

export type Role = 'detective' | 'hacker' | 'witness';
export type SuspectId = 'theo' | 'priya' | 'ines' | 'jun';
export type CaseId = 'case01';

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
};

export type SquadSize = 2 | 3;

export type RoomView = {
  code: string; // 4 chars, uppercase
  status: RoomStatus;
  squadSize: SquadSize; // 3 for a private room
  drop: { dropId: string; title: string; squadLabel: string } | null; // set when this room is a drop squad
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
  role: Role;
  docLabel: string; // 'SYSTEMS LOG' | 'STATEMENT' | 'SCENE NOTES'
  title: string;
  lines: { time?: string; text: string }[];
  notes?: string;
};

// null until the room is resolved.
export type RevealView = {
  culprit: SuspectId;
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
  | 'NOT_ENTERED';

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
// A drop is free to enter. At startsAt the server splits entrants into squads of 3 (or 2 to absorb the
// remainder: 4 -> 2+2, 5 -> 3+2, 7 -> 3+2+2) and each squad is a RoomView room that starts at 'intro' with
// roles already assigned. The first winnerSlots squads to resolve correctly win, ranked by the order the
// server committed their correct final lock-in (serializable, so no ties and nothing random).

export type DropStatus = 'scheduled' | 'live' | 'ended';
export type BountyMode = 'concept' | 'sandbox';

export type BountyView = {
  totalCents: number;
  currency: 'usd';
  winnerSlots: number; // X: the first X correct squads split the pool
  perSquadCents: number; // totalCents / winnerSlots, floored
  mode: BountyMode; // 'concept' moves no money and must be labeled as a concept in the UI
};

export type DropSummaryView = {
  dropId: string; // slug, e.g. 'aurora-demo'
  title: string;
  creatorName: string;
  caseId: CaseId;
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
  solveMs: number | null; // server time from drop start to the correct final lock-in
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
  amountCents: number; // the squad's share
  perPlayerCents: number; // amountCents / squad size, floored
  currency: 'usd';
  mode: BountyMode;
  status: 'pending' | 'ready' | 'failed';
  claimUrl: string | null; // a Whop claim link, one claim per player; null in concept mode
  redeemableCount: number; // = squad size
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

export type UseDrops = () => DropSummaryView[] | undefined; // scheduled and live drops, soonest first
export type UseDrop = (dropId: string | null) => DropView | null | undefined;
export type UseLeaderboard = (dropId: string | null) => LeaderboardView | null | undefined;
export type UseMyAward = (code: string | null) => SquadAwardView | null | undefined;
export type UseEnterDrop = (dropId: string) => (args: { name: string }) => Promise<void>; // free, idempotent
export type UseLeaveDrop = (dropId: string) => () => Promise<void>; // waiting room only
