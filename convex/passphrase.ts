import { ConvexError, v } from 'convex/values';

import type { Doc, Id } from './_generated/dataModel';
import { mutation, query, type MutationCtx, type QueryCtx } from './_generated/server';
import { distinctFirstNames } from './feed';
import { recordSolve, WRONG_GUESS_COOLDOWN_MS } from './signal';
import { act, checkSession, startSession, type Session } from './templates/engine';
import { SPLIT_CODE_MIN_WORDS, type SplitCodeState } from './templates/splitCode';
import type { PassphraseNudge, PassphrasePieceView, PassphraseResult, PassphraseSquadView, SignalErrorCode } from '../src/lib/contract';

// Split passphrase in the live room (contract-passphrase.ts). A hostDrop({ template: 'split-passphrase' }) squad is
// a drop room whose passphrase field holds the template session: each member privately holds one word and its slot.
// A member proposes the whole passphrase (counting as their confirm); when every member has confirmed the same
// revision the server checks it. Correct: the room resolves and recordSolve feeds the usual race order, leaderboard
// and awards. Wrong: the 20 s cooldown Case 01 lock-ins use, and the template's nudge.

const TEMPLATE = 'split-passphrase';

type Passphrase = { session: Session<SplitCodeState>; proposedBy: Id<'members'> | null; typed: string[] | null; nudge: PassphraseNudge | null };

function fail(code: SignalErrorCode, message: string, extra: Record<string, number> = {}): never {
  throw new ConvexError({ code, message, ...extra });
}

// Seeded server-side like mixer fragments (#58): a random nonce no client can derive from public ids.
// used: words already dealt to other squads in this drop; returns this squad's words so the caller can add them.
export async function dealPassphrase(ctx: MutationCtx, roomId: Id<'rooms'>, team: { playerId: Id<'members'>; name: string }[], used: string[] = []) {
  const nonce = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
  const names = distinctFirstNames(team.map((p) => p.name));
  const players = team.map((p, i) => ({ playerId: p.playerId as string, name: names[i] || p.name }));
  const { session } = startSession(TEMPLATE, players, roomId + ':' + nonce, { wordCount: Math.max(SPLIT_CODE_MIN_WORDS, team.length), exclude: used }, { now: Date.now() });
  const passphrase: Passphrase = { session: session as Session<SplitCodeState>, proposedBy: null, typed: null, nudge: null };
  await ctx.db.patch(roomId, { passphrase });
  return passphrase.session.state.words;
}

async function load(ctx: QueryCtx, code: string, deviceToken: string) {
  const room = await ctx.db
    .query('rooms')
    .withIndex('by_code', (q) => q.eq('code', code.trim().toUpperCase()))
    .unique();
  if (!room) return null;
  const me = await ctx.db
    .query('members')
    .withIndex('by_room_token', (q) => q.eq('roomId', room._id).eq('deviceToken', deviceToken))
    .unique();
  if (!me || !room.passphrase) return null;
  return { room, me, pp: room.passphrase as Passphrase };
}

async function requireLoad(ctx: MutationCtx, code: string, deviceToken: string) {
  const loaded = await load(ctx, code, deviceToken);
  if (!loaded) {
    const room = await ctx.db
      .query('rooms')
      .withIndex('by_code', (q) => q.eq('code', code.trim().toUpperCase()))
      .unique();
    if (!room) fail('ROOM_NOT_FOUND', 'No room with that code.');
    if (!room.passphrase) fail('WRONG_STATUS', 'This squad is not playing a passphrase.');
    fail('NOT_A_MEMBER', 'You are not in this squad.');
  }
  const { room, pp } = loaded;
  if (room.status === 'resolved' || checkSession(pp.session).correct) fail('WRONG_STATUS', 'Your squad already solved it.');
  const now = Date.now();
  if (room.cooldownUntil && now < room.cooldownUntil) {
    fail('COOLDOWN', 'Wrong answers cost time. Talk it through.', { retryAfterMs: room.cooldownUntil - now });
  }
  return { ...loaded, now };
}

const nameOf = (session: Session<SplitCodeState>, playerId: string | null) => session.state.players.find((p) => p.playerId === playerId)?.name ?? null;

function rethrow(e: unknown): never {
  const data = (e as { data?: { code?: string; message?: string } }).data;
  if (data?.code === 'STALE_REVISION' || data?.code === 'ALREADY_CHECKED') fail(data.code, data.message ?? '');
  if (data?.code === 'SOLVED') fail('WRONG_STATUS', 'Your squad already solved it.');
  throw e;
}

// One member's confirm on the current revision; checks the answer once the squad is unanimous.
async function confirmAndCheck(
  ctx: MutationCtx,
  room: Doc<'rooms'>,
  me: Doc<'members'>,
  pp: Passphrase,
  revision: number,
  now: number,
): Promise<PassphraseResult> {
  let session = pp.session;
  try {
    session = act(session, me._id, { type: 'confirm', revision }, now).session as Session<SplitCodeState>;
  } catch (e) {
    rethrow(e);
  }
  const state = session.state;
  const needed = state.players.length;
  if (state.committed?.revision !== revision) {
    await ctx.db.patch(room._id, { passphrase: { ...pp, session } });
    return { outcome: 'pending', revision, confirmed: state.confirmed.length, needed, place: null, nudge: null, cooldownUntil: null };
  }
  const check = checkSession(session);
  const seq = room.checkSeq + 1;
  if (check.correct) {
    await ctx.db.patch(room._id, {
      passphrase: { ...pp, session, nudge: null },
      status: 'resolved',
      checkSeq: seq,
      lastCheck: { seq, result: 'correct', at: now },
    });
    await recordSolve(ctx, room, now);
    const solve = await ctx.db
      .query('solves')
      .withIndex('by_room', (q) => q.eq('roomId', room._id))
      .unique();
    return { outcome: 'correct', revision, confirmed: needed, needed, place: solve?.place ?? null, nudge: null, cooldownUntil: null };
  }
  const nudge: PassphraseNudge = { text: check.nudge?.text ?? 'Not quite. Read your words again.', holderName: nameOf(session, check.nudge?.holderId ?? null) };
  const cooldownUntil = now + WRONG_GUESS_COOLDOWN_MS;
  await ctx.db.patch(room._id, {
    passphrase: { ...pp, session, nudge },
    attempts: room.attempts + 1,
    cooldownUntil,
    checkSeq: seq,
    lastCheck: { seq, result: 'wrong', at: now },
  });
  return { outcome: 'wrong', revision, confirmed: needed, needed, place: null, nudge, cooldownUntil };
}

export const submitPassphrase = mutation({
  args: { deviceToken: v.string(), code: v.string(), answer: v.string() },
  handler: async (ctx, { deviceToken, code, answer }): Promise<PassphraseResult> => {
    const { room, me, pp, now } = await requireLoad(ctx, code, deviceToken);
    const typed = answer
      .trim()
      .split(/[^A-Za-z0-9]+/)
      .filter(Boolean)
      .map((w) => w.slice(0, 32));
    const words = typed.map((w) => w.toLowerCase());
    const slotCount = pp.session.state.words.length;
    if (words.length !== slotCount) fail('BAD_ANSWER', `The passphrase is ${slotCount} words, one per slot.`);
    let session = pp.session;
    try {
      for (const [position, word] of words.entries()) session = act(session, me._id, { type: 'enter', position, word }, now).session as Session<SplitCodeState>;
    } catch (e) {
      rethrow(e);
    }
    const changed = session.state.revision !== pp.session.state.revision;
    const next = changed ? { proposedBy: me._id, typed } : { proposedBy: pp.proposedBy ?? me._id, typed: pp.typed ?? typed };
    return confirmAndCheck(ctx, room, me, { ...pp, session, ...next }, session.state.revision, now);
  },
});

export const confirmPassphrase = mutation({
  args: { deviceToken: v.string(), code: v.string(), revision: v.number() },
  handler: async (ctx, { deviceToken, code, revision }): Promise<PassphraseResult> => {
    const { room, me, pp, now } = await requireLoad(ctx, code, deviceToken);
    if (pp.session.state.slots.some((s) => !s)) fail('WRONG_STATUS', 'Nobody has proposed a passphrase yet.');
    return confirmAndCheck(ctx, room, me, pp, revision, now);
  },
});

// My piece: my word and slot, the clue, teammates' first names, the squad's state. Never another member's word.
export const piece = query({
  args: { deviceToken: v.string(), code: v.string() },
  handler: async (ctx, { deviceToken, code }): Promise<PassphrasePieceView | null> => {
    const loaded = await load(ctx, code, deviceToken);
    if (!loaded) return null;
    const { room, me, pp } = loaded;
    const now = Date.now();
    const { state } = pp.session;
    const position = state.holders.indexOf(me._id);
    const solved = checkSession(pp.session).correct;
    const checked = state.committed?.revision === state.revision;
    const proposed = !solved && !checked && state.slots.every(Boolean);
    const cooling = !solved && !!room.cooldownUntil && now < room.cooldownUntil;
    let result: PassphraseSquadView['result'] = null;
    if (solved) {
      const [solve, drop] = await Promise.all([
        ctx.db
          .query('solves')
          .withIndex('by_room', (q) => q.eq('roomId', room._id))
          .unique(),
        ctx.db
          .query('drops')
          .withIndex('by_dropId', (q) => q.eq('dropId', room.dropId ?? ''))
          .unique(),
      ]);
      if (solve) result = { place: solve.place, solveMs: solve.solveMs, winner: !!drop && solve.place <= drop.bounty.winnerSlots };
    }
    const confirmedBy = state.confirmed.map((id) => nameOf(pp.session, id) ?? '').filter(Boolean);
    const squad: PassphraseSquadView = {
      status: solved ? 'solved' : cooling ? 'cooldown' : proposed ? 'confirming' : 'solving',
      proposal: proposed
        ? {
            revision: state.revision,
            words: pp.typed ?? state.slots.map((s) => s ?? ''),
            proposedBy: nameOf(pp.session, pp.proposedBy) ?? '',
            confirmedBy,
            confirmedByMe: state.confirmed.includes(me._id),
          }
        : null,
      attempts: state.attempts,
      cooldownUntil: cooling ? room.cooldownUntil! : null,
      lastNudge: solved ? null : pp.nudge,
      result,
    };
    const n = state.words.length;
    return {
      code: room.code,
      squadLabel: room.squadLabel ?? '',
      squadSize: state.players.length as 1 | 2 | 3 | 4,
      slotCount: n,
      word: position >= 0 ? state.words[position] : '',
      position,
      clue: `Your squad's passphrase is every member's word in slot order, 1 to ${n}. Yours goes in slot ${position + 1}.`,
      teammates: state.players
        .map((p) => ({ name: p.name, position: state.holders.indexOf(p.playerId), isMe: p.playerId === me._id }))
        .sort((a, b) => a.position - b.position),
      squad,
      serverNow: now,
    };
  },
});
