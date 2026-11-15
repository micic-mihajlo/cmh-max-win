// The challenge template interface. A template is pure game logic: it owns its content, its private and shared
// views, its actions and its win check. Rooms, teams, presence, the leaderboard and payouts stay in the platform
// and talk to a template only through this interface (see engine.ts). Templates must be deterministic: no
// Math.random, no Date.now. Randomness comes from the seed (random.ts), and state must be a plain Convex value so
// it can live in a document.
import type { GenericValidator } from 'convex/values';

// Challenges are team vs team: every team on a drop plays the same template and races the others. Teams are 1–4
// players; each template declares the sizes it supports within that range.
export type TeamSize = 1 | 2 | 3 | 4;
export const MIN_SQUAD_SIZE = 1;
export const MAX_SQUAD_SIZE = 4;

export type Player = { playerId: string; name: string };
export type Team = readonly Player[];

// solved: the team has committed an answer and nothing more is pending for it. correct: that answer is right.
// A wrong commit is { solved: true, correct: false, nudge }. A new edit clears it back to { solved: false }.
export type Nudge = { text: string; holderId: string | null };
export type CheckResult = { solved: boolean; correct: boolean; nudge?: Nudge };

// What the platform knows about a team's run when it scores and ranks it. commitSeq is the platform's commit order
// for correct solves (drops.winnersSoFar + 1), solveMs is commit time minus the race start.
// points is the template's own score (quick-quiz), 0 for templates without one.
export type Outcome = { correct: boolean; attempts: number; solveMs: number; commitSeq: number; points?: number };

// One squad's live position in the race, for the standings view. value runs 0 to 1 and is 1 only when solved.
// stage is a short label ("filling", "locking in", "solved"); stageIndex/stageCount let a client draw steps.
// Rival squads can see it, so it must never reveal the answer or which parts of a squad's work are correct.
export type Progress = { value: number; stage: string; stageIndex: number; stageCount: number; solved: boolean };

export type TemplateError = { code: string; message: string };

// How teams form. dealt: the platform deals teams of one of teamSizes (today's dealSquads), and the template runs
// the session below. mixer: every player gets a color (2–4 colors, round-robin) and a fragment that
// is unique to them, a team is exactly one player of each color linked by player codes, and the server checks the
// team's answer against those members' fragments with mixer.verify.
export type Formation = 'dealt' | 'mixer';
export const MIXER_COLORS = ['red', 'blue', 'green', 'yellow'] as const;
export type MixerColor = (typeof MIXER_COLORS)[number];
export const MIN_MIXER_COLORS = 2;
export const MAX_MIXER_COLORS = 4;

// The shape CMHM-10 published in #51. title and text are shown to that player only (MixerFragmentView); secret is
// stored server-side with the entry and is what verify checks against. Never send secret to a client.
export type MixerFragment = { title: string; text: string; secret: string };
export type MixerMember = { color: MixerColor; secret: string };
export type VerifyResult = { correct: boolean; nudge?: string };

export type MixerSupport = {
  // seed is per player (e.g. `<challengeId>:<playerId>`), index is the player's 0-based join index, so every
  // fragment is unique to its player.
  fragment(seed: string, color: MixerColor, index: number): MixerFragment;
  // Server-side, called only with the locked team's members (one per color, any order).
  verify(answer: string, members: readonly MixerMember[]): VerifyResult;
};

// Creator content problems found at publish time, in the same shape as contract.ts ConfigIssue.
export type ConfigIssue = { field: string; message: string };

// The server clock. The engine passes Date.now() from the mutation; templates never read the clock themselves.
export type ActCtx = { now: number };

// ctx.now at deal time is the race start on the server clock.
export type DealCtx = { now: number };

export type BaseAction = { type: string };

export type ActionSpec<State, A> = {
  // Shape of the action, for the mutation's args (v.union of every action's args, see engine.actionArgs).
  args: GenericValidator;
  // Game-rule check against the current state. Null means the action may be applied.
  validate(state: State, playerId: string, action: A, ctx: ActCtx): TemplateError | null;
};

export interface ChallengeTemplate<Config, State, Action extends BaseAction, PrivateView, SharedView> {
  id: string;
  name: string;
  summary: string;
  // coop: the whole team is needed (necessity must hold at every size). solo: any one player could solve it.
  mode: 'coop' | 'solo';
  // The creator-content schema. schema validates the shape at the mutation boundary; issues lists every problem
  // for the publish check (empty means publishable); parse applies defaults and throws BAD_CONFIG on bad input.
  config: { schema: GenericValidator; issues?(raw: unknown): ConfigIssue[]; parse(raw: unknown): Config };
  teamSizes: readonly TeamSize[];
  formations: readonly Formation[];
  // Required when formations includes 'mixer'.
  mixer?: MixerSupport;
  // Seats the team and returns the initial state plus each player's private view, keyed by playerId.
  deal(team: Team, seed: string, config: Config, ctx: DealCtx): { state: State; views: Record<string, PrivateView> };
  // What only this player may see. Must never contain another player's private content.
  privateView(state: State, playerId: string): PrivateView;
  // What every player on the team sees. Must never contain any player's private content.
  sharedView(state: State): SharedView;
  actions: { [K in Action['type']]: ActionSpec<State, Extract<Action, { type: K }>> };
  // Server-side transition. Pure: returns a new state and never mutates the input. Runs only after validate passed.
  apply(state: State, playerId: string, action: Action, ctx: ActCtx): State;
  check(state: State): CheckResult;
  progress(state: State): Progress;
  // Timed templates (quick-quiz). wakeTimes lists the server times at which state must change with no player
  // action (a question times out); the platform schedules a tick for each and calls tick(state, now). Views read
  // only state, so anything time-gated (the correct choice) appears only after the tick or the host's advance.
  wakeTimes?(state: State): number[];
  tick?(state: State, now: number): State;
  // Live score for leaderboards between rounds (quick-quiz).
  points?(state: State): number;
  // Host actions (quick-quiz on stream): the console's Next button. The platform calls advance on every team's
  // session in one mutation with the same now, so all teams see the question open together.
  host?: { advance(state: State, now: number): State };
  // Public, token-free board for an OBS overlay or a big screen, read by code. round is the same for every team
  // (any team's state works); team is one team's public row. Neither may carry an open question's answers.
  board?: { round(state: State): unknown; team(state: State): { points: number; answeredCurrent: boolean } };
  // score is display points; rankKey sorts ascending, compared element by element.
  scoring: { score(outcome: Outcome): number; rankKey(outcome: Outcome): number[] };
  // Could these players solve it from their private views alone? The engine's checkNecessity enumerates subsets.
  necessity: { solvableBy(state: State, playerIds: readonly string[]): boolean };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyTemplate = ChallengeTemplate<any, any, any, any, any>;
