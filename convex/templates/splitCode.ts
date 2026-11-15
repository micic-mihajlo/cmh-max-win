// Challenge type #2, deliberately simple: a passphrase split across the team. Each player privately holds some
// of its words (with their positions). Anyone can type into the shared slots, and the team commits when every
// player confirms the same revision.
import { ConvexError, v } from 'convex/values';

import { rng, shuffle } from './random';
import type { ChallengeTemplate, CheckResult, TemplateError } from './types';

const WORDS = [
  'amber', 'beacon', 'cobalt', 'drift', 'ember', 'falcon', 'glacier', 'harbor', 'ion', 'juniper', 'kestrel', 'lantern',
  'meridian', 'nebula', 'orbit', 'prism', 'quartz', 'raven', 'signal', 'tundra', 'umbra', 'vector', 'willow', 'zenith',
];

export const SPLIT_CODE_MIN_WORDS = 2;
export const SPLIT_CODE_MAX_WORDS = 8;
export const SPLIT_CODE_DEFAULT_WORDS = 4;

export type SplitCodeConfig = { wordCount: number };
export type SplitCodeState = {
  players: { playerId: string; name: string }[];
  words: string[];
  holders: string[];
  slots: (string | null)[];
  revision: number;
  confirmed: string[];
  attempts: number;
  committed: { slots: string[]; revision: number } | null;
};
export type SplitCodeAction = { type: 'enter'; position: number; word: string } | { type: 'confirm'; revision: number };
export type SplitCodePrivateView = { slotCount: number; fragments: { position: number; word: string }[] };
export type SplitCodeSharedView = {
  slotCount: number;
  slots: (string | null)[];
  holders: { position: number; name: string }[];
  revision: number;
  confirmed: string[];
  attempts: number;
  result: CheckResult;
};

function check(state: SplitCodeState): CheckResult {
  const c = state.committed;
  if (!c) return { solved: false, correct: false };
  const wrong = c.slots.findIndex((w, i) => w !== state.words[i]);
  if (wrong === -1) return { solved: true, correct: true };
  const holderId = state.holders[wrong];
  const name = state.players.find((p) => p.playerId === holderId)?.name ?? 'your team';
  return { solved: true, correct: false, nudge: { text: `Slot ${wrong + 1} doesn't match. Ask ${name} to read their words again.`, holderId } };
}

function privateView(state: SplitCodeState, playerId: string): SplitCodePrivateView {
  return {
    slotCount: state.words.length,
    fragments: state.words.flatMap((word, position) => (state.holders[position] === playerId ? [{ position, word }] : [])),
  };
}

function finished(state: SplitCodeState): TemplateError | null {
  return check(state).correct ? { code: 'SOLVED', message: 'The code is already open.' } : null;
}

export const splitCodeTemplate: ChallengeTemplate<
  SplitCodeConfig,
  SplitCodeState,
  SplitCodeAction,
  SplitCodePrivateView,
  SplitCodeSharedView
> = {
  id: 'split-code',
  name: 'Split code',
  summary: 'Every player holds part of a passphrase. Read your words out, fill the slots, confirm together.',
  mode: 'coop',
  config: {
    schema: v.object({ wordCount: v.optional(v.number()) }),
    parse(raw) {
      const wordCount = (raw as { wordCount?: number } | undefined)?.wordCount ?? SPLIT_CODE_DEFAULT_WORDS;
      if (!Number.isInteger(wordCount) || wordCount < SPLIT_CODE_MIN_WORDS || wordCount > SPLIT_CODE_MAX_WORDS) {
        throw new ConvexError({ code: 'BAD_CONFIG', message: `wordCount must be ${SPLIT_CODE_MIN_WORDS}–${SPLIT_CODE_MAX_WORDS}.` });
      }
      return { wordCount };
    },
  },
  teamSizes: [2, 3, 4],

  deal(team, seed, config) {
    if (config.wordCount < team.length) {
      throw new ConvexError({ code: 'BAD_CONFIG', message: 'Every player needs at least one word.' });
    }
    const next = rng(seed);
    const words = shuffle(WORDS, next).slice(0, config.wordCount);
    const seats = shuffle(team, next);
    const holders: string[] = Array(words.length);
    shuffle(
      words.map((_, i) => i),
      next,
    ).forEach((position, i) => (holders[position] = seats[i % seats.length].playerId));
    const state: SplitCodeState = {
      players: team.map((p) => ({ playerId: p.playerId, name: p.name })),
      words,
      holders,
      slots: words.map(() => null),
      revision: 0,
      confirmed: [],
      attempts: 0,
      committed: null,
    };
    return { state, views: Object.fromEntries(team.map((p) => [p.playerId, privateView(state, p.playerId)])) };
  },

  privateView,

  sharedView(state) {
    return {
      slotCount: state.words.length,
      slots: state.slots,
      holders: state.holders.map((id, position) => ({ position, name: state.players.find((p) => p.playerId === id)?.name ?? '' })),
      revision: state.revision,
      confirmed: state.confirmed,
      attempts: state.attempts,
      result: check(state),
    };
  },

  actions: {
    enter: {
      args: v.object({ type: v.literal('enter'), position: v.number(), word: v.string() }),
      validate(state, _playerId, action) {
        const done = finished(state);
        if (done) return done;
        if (!Number.isInteger(action.position) || action.position < 0 || action.position >= state.words.length) {
          return { code: 'BAD_POSITION', message: 'No such slot.' };
        }
        if (action.word.length > 32) return { code: 'BAD_WORD', message: 'Words are at most 32 characters.' };
        return null;
      },
    },
    confirm: {
      args: v.object({ type: v.literal('confirm'), revision: v.number() }),
      validate(state, _playerId, action) {
        const done = finished(state);
        if (done) return done;
        if (action.revision !== state.revision) return { code: 'STALE_REVISION', message: 'The slots changed. Review them and confirm again.' };
        if (state.slots.some((s) => !s)) return { code: 'INCOMPLETE', message: 'Fill every slot first.' };
        if (state.committed?.revision === state.revision) return { code: 'ALREADY_CHECKED', message: 'Already checked. Change a slot to try again.' };
        return null;
      },
    },
  },

  apply(state, playerId, action) {
    if (action.type === 'enter') {
      const word = action.word.trim().toLowerCase() || null;
      if (state.slots[action.position] === word) return state;
      const slots = state.slots.map((s, i) => (i === action.position ? word : s));
      return { ...state, slots, revision: state.revision + 1, confirmed: [], committed: null };
    }
    const confirmed = state.confirmed.includes(playerId) ? state.confirmed : [...state.confirmed, playerId];
    if (confirmed.length < state.players.length) return { ...state, confirmed };
    return {
      ...state,
      confirmed: [],
      attempts: state.attempts + 1,
      committed: { slots: state.slots.map((s) => s ?? ''), revision: state.revision },
    };
  },

  check,

  scoring: {
    score: (o) => (o.correct ? Math.max(50, 500 - 50 * Math.max(0, o.attempts - 1)) : 0),
    // Fastest first; fewer attempts, then commit order, break ties.
    rankKey: (o) => [o.correct ? 0 : 1, o.solveMs, o.attempts, o.commitSeq],
  },

  necessity: {
    solvableBy(state, playerIds) {
      const known = new Set(playerIds.flatMap((id) => privateView(state, id).fragments.map((f) => f.position)));
      return known.size === state.words.length;
    },
  },
};
