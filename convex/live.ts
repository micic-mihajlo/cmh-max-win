import { ConvexError, v } from 'convex/values';

import type { Doc } from './_generated/dataModel';
import { mutation, query, type MutationCtx, type QueryCtx } from './_generated/server';
import { creatorOf, dealLive, entriesOf, finishersOf, findByCode, paidPlaceCount, requireOwned, teamsOf } from './challenges';
import { liveTemplateFor } from './liveTemplates';
import type { LiveErrorCode, LivePhase, LiveView, SignalErrorCode } from '../src/lib/contract';

// The live layer (CAP-40; signal/laneb/live-layer.md): the host's lock, start and template host actions, and one
// public live view by code. Ending and payouts are #58's endChallenge and approvePayouts.

type Challenge = Doc<'challenges'>;
type Session = Doc<'liveSessions'>;

const DEFAULT_MIN_INTERVAL_MS = 150;

function fail(code: SignalErrorCode | LiveErrorCode | string, message: string): never {
  throw new ConvexError({ code, message });
}

const sessionOf = (ctx: QueryCtx, c: Challenge) =>
  ctx.db.query('liveSessions').withIndex('by_challenge', (q) => q.eq('challengeId', c._id)).unique();

// The session's templateId is the challenge's, copied when the session is created.
const templateOf = (c: Challenge, session: Session | null) => liveTemplateFor(session?.templateId ?? c.config.templateId);

function initialState(c: Challenge) {
  return liveTemplateFor(c.config.templateId)?.init(null, c._id) ?? null;
}

async function ensureSession(ctx: MutationCtx, c: Challenge): Promise<Session> {
  const existing = await sessionOf(ctx, c);
  if (existing) return existing;
  const id = await ctx.db.insert('liveSessions', { challengeId: c._id, templateId: c.config.templateId, state: initialState(c) });
  return (await ctx.db.get(id))!;
}

function phaseOf(c: Challenge, session: Session | null, now: number): LivePhase {
  if (c.status === 'draft' || c.status === 'live' || c.status === 'ended' || c.status === 'cancelled') return c.status;
  return session?.lockedAt !== undefined && now >= session.lockedAt ? 'locked' : 'open';
}

async function lockNow(ctx: MutationCtx, c: Challenge) {
  const session = await ensureSession(ctx, c);
  if (session.lockedAt === undefined) await ctx.db.patch(session._id, { lockedAt: Date.now() });
}

export const lockEntries = mutation({
  args: { deviceToken: v.string(), challengeId: v.string() },
  handler: async (ctx, { deviceToken, challengeId }) => {
    const c = await requireOwned(ctx, deviceToken, challengeId);
    if (c.status !== 'published' && c.status !== 'live') fail('CHALLENGE_CLOSED', 'This challenge is not taking entries.');
    await lockNow(ctx, c);
  },
});

export const startLive = mutation({
  args: { deviceToken: v.string(), challengeId: v.string() },
  handler: async (ctx, { deviceToken, challengeId }) => {
    const c = await requireOwned(ctx, deviceToken, challengeId);
    if (c.status !== 'published' || c.config.startMode !== 'live') fail('CHALLENGE_CLOSED', 'Only an open live-mode challenge can be started.');
    if (c.config.teamFormation === 'dealt') await dealLive(ctx, c);
    else await ctx.db.patch(c._id, { status: 'live', firstDealtAt: Date.now() });
    await lockNow(ctx, c);
  },
});

export const runHostAction = mutation({
  args: { deviceToken: v.string(), challengeId: v.string(), action: v.string(), payload: v.optional(v.any()) },
  handler: async (ctx, { deviceToken, challengeId, action, payload }) => {
    const c = await requireOwned(ctx, deviceToken, challengeId);
    if (c.status !== 'published' && c.status !== 'live') fail('CHALLENGE_CLOSED', 'This challenge is not running.');
    const session = await ensureSession(ctx, c);
    const template = templateOf(c, session);
    const spec = template && Object.hasOwn(template.hostActions, action) ? template.hostActions[action] : null;
    if (!template || !spec) fail('UNKNOWN_HOST_ACTION', 'This challenge has no host action called ' + action + '.');
    const now = Date.now();
    const last = session.lastActionAt?.[action];
    if (last !== undefined && now - last < (spec.minIntervalMs ?? DEFAULT_MIN_INTERVAL_MS)) fail('HOST_ACTION_RATE_LIMITED', 'Too fast; try again.');
    const actx = { now, phase: phaseOf(c, session, now) };
    const refused = spec.validate?.(session.state, payload ?? null, actx);
    if (refused) fail(refused.code, refused.message);
    const state = spec.apply(session.state, payload ?? null, actx);
    await ctx.db.patch(session._id, { state, lastActionAt: { ...session.lastActionAt, [action]: now } });
    return { view: template.overlayView(state) };
  },
});

// Public, by code, no device token: phase, entry count, the template's public view, and the leaderboard once ended.
export const liveView = query({
  args: { code: v.string() },
  handler: async (ctx, { code }): Promise<LiveView | null> => {
    const c = await findByCode(ctx, code);
    if (!c || c.status === 'draft' || !c.joinCode) return null;
    const [session, entries, teams, creator] = await Promise.all([sessionOf(ctx, c), entriesOf(ctx, c._id), teamsOf(ctx, c._id), creatorOf(ctx, c.creatorToken)]);
    const now = Date.now();
    const template = templateOf(c, session);
    const paid = paidPlaceCount(c.config.reward);
    const leaderboard =
      c.status === 'ended'
        ? (await finishersOf(ctx, c, teams, entries))
            .sort((a, b) => a.place - b.place)
            .slice(0, 10)
            .map((f) => ({ place: f.place, label: f.teamLabel, memberNames: f.entries.map((e) => e.name), inMoney: f.place <= paid }))
        : null;
    return {
      challengeId: c._id,
      joinCode: c.joinCode,
      title: c.config.title,
      creator,
      templateId: c.config.templateId,
      status: c.status,
      phase: phaseOf(c, session, now),
      serverNow: now,
      entryCount: entries.length,
      entriesLocked: session?.lockedAt !== undefined && now >= session.lockedAt,
      lockedAt: session?.lockedAt ?? null,
      poolCents: c.config.poolCents,
      reward: c.config.reward,
      payoutAdapter: c.config.payoutAdapter,
      hostActions: template ? Object.keys(template.hostActions) : [],
      view: template ? template.overlayView(session ? session.state : template.init(null, c._id)) : null,
      leaderboard,
    };
  },
});
