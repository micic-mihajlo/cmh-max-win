// ---------- Room pulse (CAP-82) ----------
// Everyone in a challenge room and each team's lock on the current question, so players feel the clock. Readable by
// anyone in the room (an entrant or the host) with their device token; anyone else gets NOT_ENTERED. Names only:
// first names, never device tokens. No choices and no per-team correctness before the question's reveal.
// Quick Quiz fills the lock fields (every player answers for themselves, and a team is locked once all of its members
// are); other templates return lockedAt null, no counts, and a single 'question' while live.

export type RoomPulsePhase = 'lobby' | 'question' | 'reveal' | 'finished';

export type RoomPulseTeam = {
  id: string;
  label: string; // 'Team 1'
  memberFirstNames: string[];
  lockedAt: number | null; // server ms the team's last member locked the current question; null until every member has
  lockedCount?: number; // members who have locked the current question (Quick Quiz)
  memberCount?: number; // locks the team needs: every member (1 for a quiz dealt before per-player play)
  correct: boolean | null; // only after the reveal; null before. true when the team scored on the question.
};

export type RoomPulse = {
  serverNow: number;
  phase: RoomPulsePhase;
  joined: number;
  questionIndex: number | null; // 0-based, null in lobby
  questionCount: number;
  deadline: number | null; // server ms for the current question
  spotsLeft: number | null; // bounty spots left; null when no bounty
  myTeamId: string | null;
  teams: RoomPulseTeam[];
};

// useRoomPulse reads two queries so the room shares one cached computation per write: live:roomPulseKey (per device,
// NOT_ENTERED outside the room) returns the room's key and myTeamId, and live:roomPulseShared({ code, roomKey }) returns
// the rest, with the same args for every member. live:roomPulse returns the whole pulse in one call.
export type RoomPulseKey = { roomKey: string; myTeamId: string | null };
export type RoomPulseShared = Omit<RoomPulse, 'myTeamId'>;

export type UseRoomPulse = (code: string | null) => RoomPulse | null | undefined; // null = no such challenge
