// The challenge template interface. A template is pure game logic: it owns its content, its private and shared
// views, its actions and its win check. Rooms, teams, presence, the leaderboard and payouts stay in the platform
// and talk to a template only through this interface (see engine.ts). Templates must be deterministic: no
// Math.random, no Date.now. Randomness comes from the seed (random.ts), and state must be a plain Convex value so
// it can live in a document.
import type { GenericValidator } from 'convex/values';

// Challenges are team vs team: every squad on a drop plays the same template and races the others. Squads are 1–4
// players; each template declares the sizes it supports within that range.
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
export type Outcome = { correct: boolean; attempts: number; solveMs: number; commitSeq: number };

// One squad's live position in the race, for the standings view. value runs 0 to 1 and is 1 only when solved.
// stage is a short label ("filling", "locking in", "solved"); stageIndex/stageCount let a client draw steps.
// Rival squads can see it, so it must never reveal the answer or which parts of a squad's work are correct.
export type Progress = { value: number; stage: string; stageIndex: number; stageCount: number; solved: boolean };

export type TemplateError = { code: string; message: string };

// How squads form. dealt: the platform deals squads of minSquadSize–maxSquadSize (today's dealSquads), and the
// template runs the session below. mixer: every player gets a color (2–4 colors, round-robin) and a fragment that
// is unique to them, a team is exactly one player of each color linked by player codes, and the server checks the
// team's answer against those members' fragments with mixer.verify.
export type Formation = 'dealt' | 'mixer';
export const MIXER_COLORS = ['red', 'blue', 'green', 'yellow'] as const;
export type MixerColor = (typeof MIXER_COLORS)[number];
export const MIN_MIXER_COLORS = 2;
export const MAX_MIXER_COLORS = 4;

// What one mixer player privately holds. text is the fragment itself; hint is extra clue text on the fragment.
export type MixerFragment = { color: MixerColor; text: string; hint: string | null };
export type VerifyResult = { correct: boolean; nudge?: string };

export type MixerSupport = {
  // The clue every player sees, explaining how a team's fragments combine into its answer.
  clue(colors: readonly MixerColor[]): string;
  // One fresh fragment per color. Call it with a per-player seed and keep the joining player's color.
  dealFragments(colors: readonly MixerColor[], seed: string): Record<MixerColor, MixerFragment>;
  // Server-side: is answer right for exactly these members' fragments (one per color, any order)?
  verify(answer: string, memberFragments: readonly MixerFragment[]): VerifyResult;
};

export type BaseAction = { type: string };

export type ActionSpec<State, A> = {
  // Shape of the action, for the mutation's args (v.union of every action's args, see engine.actionArgs).
  args: GenericValidator;
  // Game-rule check against the current state. Null means the action may be applied.
  validate(state: State, playerId: string, action: A): TemplateError | null;
};

export interface ChallengeTemplate<Config, State, Action extends BaseAction, PrivateView, SharedView> {
  id: string;
  name: string;
  summary: string;
  // coop: the whole squad is needed (necessity must hold at every size). solo: any one player could solve it.
  mode: 'coop' | 'solo';
  // schema validates creator input at the mutation boundary; parse applies defaults and bounds, throwing on bad input.
  config: { schema: GenericValidator; parse(raw: unknown): Config };
  minSquadSize: number;
  maxSquadSize: number;
  formations: readonly Formation[];
  // Required when formations includes 'mixer'.
  mixer?: MixerSupport;
  // Seats the team and returns the initial state plus each player's private view, keyed by playerId.
  deal(team: Team, seed: string, config: Config): { state: State; views: Record<string, PrivateView> };
  // What only this player may see. Must never contain another player's private content.
  privateView(state: State, playerId: string): PrivateView;
  // What every player on the team sees. Must never contain any player's private content.
  sharedView(state: State): SharedView;
  actions: { [K in Action['type']]: ActionSpec<State, Extract<Action, { type: K }>> };
  // Server-side transition. Pure: returns a new state and never mutates the input. Runs only after validate passed.
  apply(state: State, playerId: string, action: Action): State;
  check(state: State): CheckResult;
  progress(state: State): Progress;
  // score is display points; rankKey sorts ascending, compared element by element.
  scoring: { score(outcome: Outcome): number; rankKey(outcome: Outcome): number[] };
  // Could these players solve it from their private views alone? The engine's checkNecessity enumerates subsets.
  necessity: { solvableBy(state: State, playerIds: readonly string[]): boolean };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyTemplate = ChallengeTemplate<any, any, any, any, any>;
