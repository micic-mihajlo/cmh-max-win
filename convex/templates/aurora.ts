// Challenge type #1: the Aurora mystery (aurora01) as a template. Content comes from convex/aurora.ts and
// convex/case01.ts unchanged; the drop and room code paths in drops.ts and signal.ts are untouched.
import { v } from 'convex/values';

import { AURORA_REVEAL, PIECES, SUSPECT_NAMES, nudgeText, ownNudgeText, pieceFor, type Piece, type PieceId } from '../aurora';
import { ANSWER, ROLES, SUSPECTS, type Role, type SuspectId } from '../case01';
import { suspect } from '../schema';
import { hash } from './random';
import type { ChallengeTemplate, CheckResult, Progress, TemplateError } from './types';

export type AuroraConfig = Record<string, never>;

export type AuroraSeat = { playerId: string; name: string; roles: Role[] };
export type AuroraState = {
  seats: AuroraSeat[];
  culprit: SuspectId | null;
  revision: number;
  lockedIn: string[];
  attempts: number;
  committed: { culprit: SuspectId; revision: number } | null;
};

export type AuroraAction = { type: 'setTheory'; culprit: SuspectId | null } | { type: 'lockIn'; revision: number };

export type AuroraPieceView = Omit<Piece, 'places'>;
export type AuroraPrivateView = { roles: Role[]; pieces: AuroraPieceView[]; ownNudge: string | null };
export type AuroraSharedView = {
  suspects: { id: SuspectId; name: string }[];
  seats: { playerId: string; name: string; primaryRole: Role; pieceCount: number }[];
  theory: { culprit: SuspectId | null; revision: number };
  lockedIn: string[];
  attempts: number;
  result: CheckResult;
  reveal: { headline: string; why: string; credits: string[]; closer: string } | null;
};

const PIECE_PLACES: Record<PieceId, Exclude<SuspectId, 'jun'>> = Object.fromEntries(
  Object.values(PIECES).map((p) => [p.pieceId, p.places]),
) as Record<PieceId, Exclude<SuspectId, 'jun'>>;

// Same hands as drops.dealPieces(dropId, squadIndex, size) when seed is `${dropId}:${squadIndex}`.
function hands(seed: string, size: number): Role[][] {
  const k = hash(seed) % 3;
  const order = [...ROLES.slice(k), ...ROLES.slice(0, k)];
  return size === 3 ? order.map((r) => [r]) : [[order[0], order[1]], [order[2]]];
}

function seatOf(state: AuroraState, playerId: string) {
  return state.seats.find((s) => s.playerId === playerId) ?? null;
}

function holderOf(state: AuroraState, wrong: Exclude<SuspectId, 'jun'>) {
  return state.seats.find((s) => s.roles.includes(pieceFor(wrong).role)) ?? null;
}

function check(state: AuroraState): CheckResult {
  const c = state.committed;
  if (!c) return { solved: false, correct: false };
  if (c.culprit === ANSWER) return { solved: true, correct: true };
  const holder = holderOf(state, c.culprit);
  return {
    solved: true,
    correct: false,
    nudge: { text: nudgeText(c.culprit, holder?.name ?? 'your squad'), holderId: holder?.playerId ?? null },
  };
}

const AURORA_STAGES = ['investigating', 'theory', 'locking in', 'solved'] as const;

// Never reflects whether the theory is right: a wrong commit drops back to the theory stage like any edit.
function progress(state: AuroraState): Progress {
  const stage = (i: number, value: number): Progress => ({
    value,
    stage: AURORA_STAGES[i],
    stageIndex: i,
    stageCount: AURORA_STAGES.length,
    solved: i === 3,
  });
  if (check(state).correct) return stage(3, 1);
  if (state.lockedIn.length > 0) return stage(2, 0.5 + (0.4 * state.lockedIn.length) / state.seats.length);
  if (state.culprit) return stage(1, 0.4);
  return stage(0, 0);
}

function finished(state: AuroraState): TemplateError | null {
  return check(state).correct ? { code: 'SOLVED', message: 'The case is closed.' } : null;
}

function privateView(state: AuroraState, playerId: string): AuroraPrivateView {
  const seat = seatOf(state, playerId);
  if (!seat) return { roles: [], pieces: [], ownNudge: null };
  const c = state.committed;
  const ownNudge =
    c && c.culprit !== ANSWER && seat.roles.includes(pieceFor(c.culprit).role) ? ownNudgeText(c.culprit) : null;
  return {
    roles: seat.roles,
    pieces: seat.roles.map((r) => {
      const { places: _places, ...piece } = PIECES[r];
      return piece;
    }),
    ownNudge,
  };
}

export const auroraTemplate: ChallengeTemplate<AuroraConfig, AuroraState, AuroraAction, AuroraPrivateView, AuroraSharedView> = {
  id: 'aurora',
  name: 'Aurora mystery',
  summary: 'Each player holds case pieces that each clear one suspect. Pool them, name the culprit, lock in together.',
  mode: 'coop',
  config: {
    schema: v.object({}),
    parse: () => ({}),
  },
  minSquadSize: 2,
  maxSquadSize: 3,
  formations: ['dealt'],

  deal(team, seed) {
    const dealt = hands(seed, team.length);
    const state: AuroraState = {
      seats: team.map((p, i) => ({ playerId: p.playerId, name: p.name, roles: dealt[i] })),
      culprit: null,
      revision: 0,
      lockedIn: [],
      attempts: 0,
      committed: null,
    };
    return { state, views: Object.fromEntries(team.map((p) => [p.playerId, privateView(state, p.playerId)])) };
  },

  privateView,

  sharedView(state) {
    const result = check(state);
    return {
      suspects: SUSPECTS.map((id) => ({ id, name: SUSPECT_NAMES[id] })),
      seats: state.seats.map((s) => ({ playerId: s.playerId, name: s.name, primaryRole: s.roles[0], pieceCount: s.roles.length })),
      theory: { culprit: state.culprit, revision: state.revision },
      lockedIn: state.lockedIn,
      attempts: state.attempts,
      result,
      reveal: result.correct
        ? {
            headline: AURORA_REVEAL.headline,
            why: AURORA_REVEAL.why,
            credits: AURORA_REVEAL.credits.map((c) => c.line(state.seats.find((s) => s.roles.includes(c.role))?.name ?? 'Your squad')),
            closer: AURORA_REVEAL.closer,
          }
        : null,
    };
  },

  actions: {
    setTheory: {
      args: v.object({ type: v.literal('setTheory'), culprit: v.union(suspect, v.null()) }),
      validate: (state) => finished(state),
    },
    lockIn: {
      args: v.object({ type: v.literal('lockIn'), revision: v.number() }),
      validate(state, _playerId, action) {
        const done = finished(state);
        if (done) return done;
        if (!state.culprit) return { code: 'NO_THEORY', message: 'Pick a culprit before locking in.' };
        if (action.revision !== state.revision) return { code: 'STALE_REVISION', message: 'The theory changed. Review it and lock in again.' };
        if (state.committed?.revision === state.revision) return { code: 'ALREADY_CHECKED', message: 'Already checked. Change the theory to try again.' };
        return null;
      },
    },
  },

  apply(state, playerId, action) {
    if (action.type === 'setTheory') {
      if (action.culprit === state.culprit) return state;
      return { ...state, culprit: action.culprit, revision: state.revision + 1, lockedIn: [], committed: null };
    }
    const lockedIn = state.lockedIn.includes(playerId) ? state.lockedIn : [...state.lockedIn, playerId];
    if (lockedIn.length < state.seats.length) return { ...state, lockedIn };
    return {
      ...state,
      lockedIn: [],
      attempts: state.attempts + 1,
      committed: { culprit: state.culprit!, revision: state.revision },
    };
  },

  check,
  progress,

  scoring: {
    score: (o) => (o.correct ? Math.max(100, 1000 - 150 * Math.max(0, o.attempts - 1)) : 0),
    // Commit order, as in drops-contract.md: the first squad the server committed wins.
    rankKey: (o) => [o.correct ? 0 : 1, o.commitSeq],
  },

  necessity: {
    // Solving is elimination: the players can name Jun only if their pieces clear every other suspect.
    solvableBy(state, playerIds) {
      const cleared = new Set(playerIds.flatMap((id) => privateView(state, id).pieces.map((p) => PIECE_PLACES[p.pieceId])));
      return SUSPECTS.filter((s) => s !== ANSWER).every((s) => cleared.has(s as Exclude<SuspectId, 'jun'>));
    },
  },
};
