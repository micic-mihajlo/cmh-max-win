import { paginationOptsValidator } from 'convex/server';
import { ConvexError, v } from 'convex/values';

import { internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { internalMutation, mutation, query, type MutationCtx, type QueryCtx } from './_generated/server';
import { enforceRateLimit } from './rateLimits';
import { resolveIdentity } from './creatorIdentity';
import { CHALLENGE_CAPACITY_MAX, type ChallengeCapacityView, type SignalErrorCode } from '../src/lib/contract';

function fail(code: SignalErrorCode, message: string): never {
  throw new ConvexError({ code, message });
}

function hash(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

// ---------- Capacity ----------
// Each entrant holds a numbered seat (0..capacity-1) in a scope. A join point-reads a few seats picked from its
// token's hash, so concurrent joins only collide when they pick the same seat, and it scans every seat only
// when those are all taken. Counting entries instead would make every join conflict with every other.

async function freeSeat(ctx: QueryCtx, scope: string, deviceToken: string, capacity: number): Promise<number | null> {
  for (let i = 0; i < 8; i++) {
    const seat = hash(`${deviceToken}:${i}`) % capacity;
    const taken = await ctx.db
      .query('capacitySeats')
      .withIndex('by_scope_seat', (q) => q.eq('scope', scope).eq('seat', seat))
      .first();
    if (!taken) return seat;
  }
  const seats = await ctx.db.query('capacitySeats').withIndex('by_scope_seat', (q) => q.eq('scope', scope)).collect();
  const taken = new Set(seats.map((s) => s.seat));
  for (let seat = 0; seat < capacity; seat++) if (!taken.has(seat)) return seat;
  return null;
}

async function seatsIn(ctx: QueryCtx, scope: string) {
  return ctx.db.query('capacitySeats').withIndex('by_scope_seat', (q) => q.eq('scope', scope)).collect();
}

const challengeScope = (challengeId: Id<'challenges'>) => `challenge:${challengeId}`;

async function capacityOf(ctx: QueryCtx, challengeId: Id<'challenges'>) {
  const limits = await ctx.db.query('challengeLimits').withIndex('by_challenge', (q) => q.eq('challengeId', challengeId)).unique();
  return limits?.capacity ?? CHALLENGE_CAPACITY_MAX;
}

// Call before inserting a new challenge entry. Throws CHALLENGE_FULL at capacity.
export async function takeChallengeSeat(ctx: MutationCtx, challengeId: Id<'challenges'>, deviceToken: string) {
  const scope = challengeScope(challengeId);
  const seat = await freeSeat(ctx, scope, deviceToken, await capacityOf(ctx, challengeId));
  if (seat === null) fail('CHALLENGE_FULL', 'This challenge is full.');
  await ctx.db.insert('capacitySeats', { scope, seat, deviceToken });
}

// Call when an entry leaves. A device without a seat (joined before seats existed) is a no-op.
export async function releaseChallengeSeat(ctx: MutationCtx, challengeId: Id<'challenges'>, deviceToken: string) {
  const seat = await ctx.db
    .query('capacitySeats')
    .withIndex('by_scope_token', (q) => q.eq('scope', challengeScope(challengeId)).eq('deviceToken', deviceToken))
    .unique();
  if (seat) await ctx.db.delete(seat._id);
}

// Creator only, while the challenge is a draft: published config is frozen, and seats never exceed capacity.
export const setChallengeCapacity = mutation({
  args: { deviceToken: v.string(), challengeId: v.string(), capacity: v.number() },
  handler: async (ctx, { deviceToken, challengeId, capacity }): Promise<ChallengeCapacityView> => {
    const id = ctx.db.normalizeId('challenges', challengeId);
    const c = id ? await ctx.db.get(id) : null;
    if (!c) fail('CHALLENGE_NOT_FOUND', 'No such challenge.');
    if (c.creatorToken !== (await resolveIdentity(ctx, deviceToken)).deviceToken) fail('NOT_CREATOR', 'Only the creator can do that.');
    await enforceRateLimit(ctx, 'hostAction', `${c._id}:${deviceToken}`);
    if (c.status !== 'draft') fail('CHALLENGE_CLOSED', 'A published challenge is frozen. Clone it to change the config.');
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > CHALLENGE_CAPACITY_MAX) {
      fail('INVALID_CONFIG', `Capacity is a whole number from 1 to ${CHALLENGE_CAPACITY_MAX}.`);
    }
    const limits = await ctx.db.query('challengeLimits').withIndex('by_challenge', (q) => q.eq('challengeId', c._id)).unique();
    if (limits) await ctx.db.patch(limits._id, { capacity });
    else await ctx.db.insert('challengeLimits', { challengeId: c._id, capacity });
    return { capacity, seated: 0, full: false };
  },
});

// Public for published challenges, the same audience that sees the entrant count. Drafts answer null.
export const challengeCapacity = query({
  args: { challengeId: v.string() },
  handler: async (ctx, { challengeId }): Promise<ChallengeCapacityView | null> => {
    const id = ctx.db.normalizeId('challenges', challengeId);
    const c = id ? await ctx.db.get(id) : null;
    if (!c || c.status === 'draft') return null;
    const capacity = await capacityOf(ctx, c._id);
    const seated = (await seatsIn(ctx, challengeScope(c._id))).length;
    return { capacity, seated, full: seated >= capacity };
  },
});

// ---------- Sweeps (convex/crons.ts) ----------
// Each handler only deletes rows that are already dead, so rerunning it, or two runs overlapping, is harmless.
// A full page schedules the next page right away.

export const WHOP_SESSION_SWEEP_AFTER_MS = 15 * 60 * 1000; // whopAuth.consumeSession refuses sessions after 10 minutes
export const STALE_DRAFT_MS = 14 * 24 * 60 * 60 * 1000;
export const ABANDONED_LOBBY_MS = 6 * 60 * 60 * 1000;
const SWEEP_LOOKBACK_MS = 30 * 24 * 60 * 60 * 1000;
const PAGE = 200;

export const sweepWhopOAuthSessions = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - WHOP_SESSION_SWEEP_AFTER_MS;
    const dead = await ctx.db
      .query('whopOAuthSessions')
      .withIndex('by_creation_time', (q) => q.lt('_creationTime', cutoff))
      .take(PAGE);
    for (const s of dead) if (s.createdAt < cutoff) await ctx.db.delete(s._id);
    if (dead.length === PAGE) await ctx.scheduler.runAfter(0, internal.hardening.sweepWhopOAuthSessions, {});
    return { deleted: dead.length };
  },
});

// Drafts nobody published within STALE_DRAFT_MS of creating them.
export const sweepStaleDrafts = internalMutation({
  args: { paginationOpts: v.optional(paginationOptsValidator) },
  handler: async (ctx, { paginationOpts }) => {
    const cutoff = Date.now() - STALE_DRAFT_MS;
    const page = await ctx.db
      .query('challenges')
      .withIndex('by_creation_time', (q) => q.gt('_creationTime', cutoff - SWEEP_LOOKBACK_MS).lt('_creationTime', cutoff))
      .paginate(paginationOpts ?? { numItems: PAGE, cursor: null });
    let deleted = 0;
    for (const c of page.page) {
      if (c.status !== 'draft' || c.createdAt >= cutoff) continue;
      const limits = await ctx.db.query('challengeLimits').withIndex('by_challenge', (q) => q.eq('challengeId', c._id)).unique();
      if (limits) await ctx.db.delete(limits._id);
      await ctx.db.delete(c._id);
      deleted++;
    }
    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.hardening.sweepStaleDrafts, {
        paginationOpts: { numItems: PAGE, cursor: page.continueCursor },
      });
    }
    return { deleted };
  },
});

// Free-play rooms (no drop, no challenge) still in the lobby ABANDONED_LOBBY_MS after they were made.
// Drop squads and challenge teams start past the lobby, so they never match.
export const sweepAbandonedLobbies = internalMutation({
  args: { paginationOpts: v.optional(paginationOptsValidator) },
  handler: async (ctx, { paginationOpts }) => {
    const cutoff = Date.now() - ABANDONED_LOBBY_MS;
    const page = await ctx.db
      .query('rooms')
      .withIndex('by_creation_time', (q) => q.gt('_creationTime', cutoff - SWEEP_LOOKBACK_MS).lt('_creationTime', cutoff))
      .paginate(paginationOpts ?? { numItems: PAGE, cursor: null });
    let deleted = 0;
    for (const room of page.page) {
      if (room.status !== 'lobby' || room.dropId || room.challengeId) continue;
      const members = await ctx.db.query('members').withIndex('by_room', (q) => q.eq('roomId', room._id)).collect();
      for (const m of members) await ctx.db.delete(m._id);
      await ctx.db.delete(room._id);
      deleted++;
    }
    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.hardening.sweepAbandonedLobbies, {
        paginationOpts: { numItems: PAGE, cursor: page.continueCursor },
      });
    }
    return { deleted };
  },
});
