// The challenge template interface. A template is pure game logic: it owns its content, its private and shared
// views, its actions and its win check. Rooms, teams, presence, the leaderboard and payouts stay in the platform
// and talk to a template only through this interface (see engine.ts). Templates must be deterministic: no
// Math.random, no Date.now. Randomness comes from the seed (random.ts), and state must be a plain Convex value so
// it can live in a document.
import type { GenericValidator } from 'convex/values';

export type Player = { playerId: string; name: string };
export type Team = readonly Player[];

// solved: the team has committed an answer and nothing more is pending for it. correct: that answer is right.
// A wrong commit is { solved: true, correct: false, nudge }. A new edit clears it back to { solved: false }.
export type Nudge = { text: string; holderId: string | null };
export type CheckResult = { solved: boolean; correct: boolean; nudge?: Nudge };

// What the platform knows about a team's run when it scores and ranks it. commitSeq is the platform's commit order
// for correct solves (drops.winnersSoFar + 1), solveMs is commit time minus the race start.
export type Outcome = { correct: boolean; attempts: number; solveMs: number; commitSeq: number };

export type TemplateError = { code: string; message: string };

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
  // coop: the whole team is needed (necessity must hold). solo: any one player could solve it.
  mode: 'coop' | 'solo';
  // schema validates creator input at the mutation boundary; parse applies defaults and bounds, throwing on bad input.
  config: { schema: GenericValidator; parse(raw: unknown): Config };
  teamSizes: readonly number[];
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
  // score is display points; rankKey sorts ascending, compared element by element.
  scoring: { score(outcome: Outcome): number; rankKey(outcome: Outcome): number[] };
  // Could these players solve it from their private views alone? The engine's checkNecessity enumerates subsets.
  necessity: { solvableBy(state: State, playerIds: readonly string[]): boolean };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyTemplate = ChallengeTemplate<any, any, any, any, any>;
