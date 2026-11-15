// ---------- Split passphrase in the live room (dealt) ----------
// A hosted drop made with hostDrop({ template: 'split-passphrase' }) deals each squad a passphrase instead of the
// mystery: every member privately holds one word and its slot. The squad types the whole passphrase, every member
// confirms the same proposal, and the server checks it. A correct answer solves the squad on the server clock and
// feeds the usual race order, leaderboard (LeaderboardView), host view and awards (myAward), exactly as Case 01.
// Drops without a template are unchanged. Open the room with DropView.me.squad.code as today; when
// DropView.template is 'split-passphrase', show usePassphrase(code) instead of the mystery room.
export type DropTemplateId = 'split-passphrase';

// A wrong answer: names the holder of the first wrong slot, so the squad knows who to ask. Never says which word.
export type PassphraseNudge = { text: string; holderName: string | null };

// The proposal on the table: what one member typed. confirmedBy is first names; the proposer counts as confirmed.
export type PassphraseProposal = {
  revision: number; // pass to confirmPassphrase
  words: string[]; // as typed, one per slot
  proposedBy: string; // first name
  confirmedBy: string[];
  confirmedByMe: boolean;
};

// solving: nothing proposed (or a proposal was rejected and the cooldown is over). confirming: a proposal is
// waiting for everyone's confirm. cooldown: a wrong answer; nothing can be proposed or confirmed until
// cooldownUntil (server clock, 20 s like Case 01 lock-ins). solved: the squad's answer was right.
export type PassphraseSquadStatus = 'solving' | 'confirming' | 'cooldown' | 'solved';

export type PassphraseSquadView = {
  status: PassphraseSquadStatus;
  proposal: PassphraseProposal | null;
  attempts: number; // committed (unanimous) answers so far
  cooldownUntil: number | null; // ms epoch, server clock
  lastNudge: PassphraseNudge | null; // from the most recent wrong answer
  result: { place: number; solveMs: number; winner: boolean } | null; // set once solved
};

// One member's piece. Never carries another member's word or the full passphrase.
export type PassphrasePieceView = {
  code: string; // the squad's room code
  squadLabel: string; // 'Squad 2'
  squadSize: 1 | 2 | 3 | 4;
  slotCount: number; // words in the passphrase, one per member
  word: string; // my word
  position: number; // 0-based slot my word goes in
  clue: string; // "Your squad's passphrase is every member's word in slot order, 1 to 3. Yours goes in slot 2."
  teammates: { name: string; position: number; isMe: boolean }[]; // first names, in slot order, me included
  squad: PassphraseSquadView;
  serverNow: number;
};

export type SubmitPassphraseArgs = { deviceToken: string; code: string; answer: string }; // answer: words in slot order, spaces or punctuation between
export type ConfirmPassphraseArgs = { deviceToken: string; code: string; revision: number };

// pending: waiting for the rest of the squad to confirm. correct: solved, place set. wrong: the unanimous answer
// was checked and is wrong; cooldownUntil and nudge are set.
export type PassphraseResult = {
  outcome: 'pending' | 'correct' | 'wrong';
  revision: number;
  confirmed: number;
  needed: number;
  place: number | null;
  nudge: PassphraseNudge | null;
  cooldownUntil: number | null;
};

// Errors (SignalErrorCode): NOT_A_MEMBER, WRONG_STATUS (not a passphrase squad, or already solved), COOLDOWN
// (data.retryAfterMs), STALE_REVISION (the proposal changed; confirm the new one), BAD_ANSWER (wrong word count),
// ALREADY_CHECKED (this exact proposal was already checked).
export type UsePassphrase = (code: string | null) => PassphrasePieceView | null | undefined; // null: not a member, or not a passphrase squad
export type UseSubmitPassphrase = (code: string) => (answer: string) => Promise<PassphraseResult>;
export type UseConfirmPassphrase = (code: string) => (revision: number) => Promise<PassphraseResult>;
