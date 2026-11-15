// SIGNAL client contract (Lane B owns this file).
// Lane A builds mocks against these types; Lane B's hooks in src/hooks/use-*.ts implement the signatures.
// Every call resolves the caller from the device token in src/lib/device.ts; no member id is ever sent by the client.

export type Role = 'detective' | 'hacker' | 'witness';
export type SuspectId = 'theo' | 'priya' | 'ines' | 'jun';
export type CaseId = 'case01';

// Coarse presence. 'offline' is derived from lastSeen by the hooks, never set by a client.
export type Presence = 'online' | 'reviewing' | 'ready' | 'offline';
export type SettablePresence = Exclude<Presence, 'offline'>;

// lobby -> intro (host started) -> playing (all 3 marked ready on the intro) -> resolved.
// There is no 'checking' status: the server checks inside the lock-in that completes 3 of 3,
// so "Checking..." is a client-side pending state on that lockIn call.
export type RoomStatus = 'lobby' | 'intro' | 'playing' | 'resolved';

export type MemberView = {
  memberId: string; // display/key only; the server never accepts it as identity
  name: string;
  role: Role | null;
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
};

export type RoomView = {
  code: string; // 4 chars, uppercase
  status: RoomStatus;
  caseId: CaseId;
  isHost: boolean;
  me: { memberId: string; role: Role | null; name: string };
  members: MemberView[];
  theory: TheoryView;
  lockIns: { memberId: string; revision: number }[]; // only lock-ins for theory.revision
  attempts: number;
  lastNudge: NudgeView | null; // set after a wrong check, cleared on the next theory edit
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
  | 'CONFIRM_REQUIRED';

export type SignalError = { code: SignalErrorCode; message: string };

export type LockInResult =
  | { outcome: 'locked'; lockedCount: number } // waiting for the others
  | { outcome: 'wrong'; nudge: NudgeView; attempts: number }
  | { outcome: 'resolved' };

// Hook signatures. Queries return undefined while loading and null when there is nothing to show.
export type UseActiveRoom = () => ActiveRoomView | undefined;
export type UseRoom = (code: string | null) => RoomView | null | undefined;
export type UseMyDossier = (code: string | null) => DossierView | null | undefined;
export type UseReveal = (code: string | null) => RevealView | null | undefined;

export type UseCreateRoom = () => (args: { name: string }) => Promise<{ code: string }>;
export type UseJoinRoom = () => (args: { code: string; name: string }) => Promise<{ code: string }>;
export type UseClaimRole = (code: string) => (role: Role) => Promise<void>;
export type UseStartCase = (code: string) => () => Promise<void>;
export type UseSetPresence = (code: string) => (presence: SettablePresence) => Promise<void>;
export type UseSetTheory = (code: string) => (culprit: SuspectId | null) => Promise<{ revision: number }>;
export type UseLockIn = (code: string) => (revision: number) => Promise<LockInResult>;
export type UseRestart = (code: string) => (args: { confirm: true }) => Promise<void>;
export type UseLeaveRoom = (code: string) => () => Promise<void>;
