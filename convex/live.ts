import { ConvexError, v } from 'convex/values';

import { internal } from './_generated/api';
import type { Doc, Id } from './_generated/dataModel';
import { internalMutation, mutation, query, type MutationCtx, type QueryCtx } from './_generated/server';
import { creatorOf, dealLive, endNow, entriesOf, finishersOf, findByCode, getChallenge, paidPlaceCount, requireOwned, teamsOf } from './challenges';
import { liveTemplateFor } from './liveTemplates';
import { isSessionTemplate, teamSessionsOf } from './teamSessions';
import { act, checkSession, hostAdvance, publicBoard, tickSession, viewsFor, wakeTimes, type Session as EngineSession } from './templates/engine';
import type { LiveErrorCode, LivePhase, LiveView, SignalErrorCode, TeamSessionView } from '../src/lib/contract';

// The live layer (CAP-40; signal/laneb/live-layer.md): the host's lock, start and template host actions, one
// public live view by code, and engine-session play for host-paced templates (quick-quiz). Ending and payouts are
// #58's endChallenge and approvePayouts.

type Challenge = Doc<'challenges'>;
type Session = Doc<'liveSessions'>;

const DEFAULT_MIN_INTERVAL_MS = 150;
const NEXT = 'next'; // the host's Next for host-paced engine templates

function fail(code: SignalErrorCode | LiveErrorCode | string, message: string): never {
  throw new ConvexError({ code, message });
}

const sessionOf = (ctx: QueryCtx, c: Challenge) =>
  ctx.db.query('liveSessions').withIndex('by_challenge', (q) => q.eq('challengeId', c._id)).unique();

// The session's templateId is the challenge's, copied when the session is created.
const templateOf = (c: Challenge, session: Session | null) => liveTemplateFor(session?.templateId ?? c.config.templateId);

async function ensureSession(ctx: MutationCtx, c: Challenge): Promise<Session> {
  const existing = await sessionOf(ctx, c);
  if (existing) return existing;
  const state = liveTemplateFor(c.config.templateId)?.init(null, c._id) ?? null;
  const id = await ctx.db.insert('liveSessions', { challengeId: c._id, templateId: c.config.templateId, state });
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

function rateLimit(session: Session, action: string, minIntervalMs: number, now: number) {
  const last = session.lastActionAt?.[action];
  if (last !== undefined && now - last < minIntervalMs) fail('HOST_ACTION_RATE_LIMITED', 'Too fast; try again.');
}

async function board(ctx: QueryCtx, c: Challenge) {
  const rows = await teamSessionsOf(ctx, c._id);
  return publicBoard(c.config.templateId, rows.sort((a, b) => a.label.localeCompare(b.label)).map((r) => ({ label: r.label, session: r.session as EngineSession })));
}

// Saves changed team sessions, schedules their next wake, and ends the challenge once every team has finished.
async function saveTeamSessions(ctx: MutationCtx, c: Challenge, rows: Doc<'teamSessions'>[], next: EngineSession[], now: number) {
  const wakes = new Set<number>();
  for (const [i, row] of rows.entries()) {
    const finished = checkSession(next[i]).solved;
    await ctx.db.patch(row._id, { session: next[i], ...(finished && row.finishedAt === undefined ? { finishedAt: now } : {}) });
    for (const t of wakeTimes(next[i])) if (t > now) wakes.add(t);
  }
  for (const t of wakes) await ctx.scheduler.runAt(t, internal.live.tickTeams, { challengeId: c._id });
  if (rows.length && next.every((s) => checkSession(s).solved)) await endNow(ctx, c);
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
  handler: async (ctx, { deviceToken, challengeId, action, payload }): Promise<{ view: unknown }> => {
    const c = await requireOwned(ctx, deviceToken, challengeId);
    if (c.status !== 'published' && c.status !== 'live') fail('CHALLENGE_CLOSED', 'This challenge is not running.');
    const session = await ensureSession(ctx, c);
    const now = Date.now();

    if (isSessionTemplate(c.config.templateId)) {
      if (action !== NEXT) fail('UNKNOWN_HOST_ACTION', 'This challenge has no host action called ' + action + '.');
      if (c.status !== 'live') fail('NOT_LIVE', 'Start the challenge first.');
      rateLimit(session, action, DEFAULT_MIN_INTERVAL_MS, now);
      await ctx.db.patch(session._id, { lastActionAt: { ...session.lastActionAt, [action]: now } });
      const rows = await teamSessionsOf(ctx, c._id);
      await saveTeamSessions(ctx, c, rows, rows.map((r) => hostAdvance(r.session as EngineSession, now)), now);
      return { view: await board(ctx, c) };
    }

    const template = templateOf(c, session);
    const spec = template && Object.hasOwn(template.hostActions, action) ? template.hostActions[action] : null;
    if (!template || !spec) fail('UNKNOWN_HOST_ACTION', 'This challenge has no host action called ' + action + '.');
    rateLimit(session, action, spec.minIntervalMs ?? DEFAULT_MIN_INTERVAL_MS, now);
    const actx = { now, phase: phaseOf(c, session, now) };
    const refused = spec.validate?.(session.state, payload ?? null, actx);
    if (refused) fail(refused.code, refused.message);
    const state = spec.apply(session.state, payload ?? null, actx);
    await ctx.db.patch(session._id, { state, lastActionAt: { ...session.lastActionAt, [action]: now } });
    return { view: template.overlayView(state) };
  },
});

// Scheduled at each team session's wake time (quick-quiz: the open question's time limit).
export const tickTeams = internalMutation({
  args: { challengeId: v.id('challenges') },
  handler: async (ctx, { challengeId }) => {
    const c = await ctx.db.get(challengeId);
    if (!c || c.status !== 'live') return;
    const now = Date.now();
    const rows = await teamSessionsOf(ctx, c._id);
    await saveTeamSessions(ctx, c, rows, rows.map((r) => tickSession(r.session as EngineSession, now)), now);
  },
});

async function myTeamSession(ctx: QueryCtx, challengeId: Id<'challenges'>, deviceToken: string) {
  const entry = await ctx.db
    .query('challengeEntries')
    .withIndex('by_challenge_token', (q) => q.eq('challengeId', challengeId).eq('deviceToken', deviceToken))
    .unique();
  if (!entry?.teamId) return null;
  const row = await ctx.db.query('teamSessions').withIndex('by_team', (q) => q.eq('teamId', entry.teamId!)).unique();
  return row ? { entry, row } : null;
}

// A player's action on their team's engine session (quick-quiz: { type: 'answer', questionIndex, choice }).
export const playerAction = mutation({
  args: { deviceToken: v.string(), challengeId: v.string(), action: v.any() },
  handler: async (ctx, { deviceToken, challengeId, action }) => {
    const c = await getChallenge(ctx, challengeId);
    if (!c) fail('CHALLENGE_NOT_FOUND', 'No such challenge.');
    if (c.status !== 'live') fail('CHALLENGE_CLOSED', 'This challenge is not running.');
    const mine = await myTeamSession(ctx, c._id, deviceToken);
    if (!mine) fail('NOT_ENTERED', 'You are not on a team in this challenge.');
    if (typeof action?.type !== 'string') fail('UNKNOWN_ACTION', 'An action needs a type.');
    const { session } = act(mine.row.session as EngineSession, mine.entry._id, action, Date.now());
    await ctx.db.patch(mine.row._id, { session });
  },
});

// What this device's team sees: the template's shared view and this player's private view.
export const teamSessionView = query({
  args: { deviceToken: v.string(), challengeId: v.string() },
  handler: async (ctx, { deviceToken, challengeId }): Promise<TeamSessionView | null> => {
    const c = await getChallenge(ctx, challengeId);
    const mine = c ? await myTeamSession(ctx, c._id, deviceToken) : null;
    if (!mine) return null;
    const { shared, mine: own } = viewsFor(mine.row.session as EngineSession, mine.entry._id);
    return { teamLabel: mine.row.label, serverNow: Date.now(), shared, mine: own };
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
    const engine = isSessionTemplate(c.config.templateId);
    const template = engine ? null : templateOf(c, session);
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
      hostActions: engine ? [NEXT] : template ? Object.keys(template.hostActions) : [],
      view: engine ? await board(ctx, c) : template ? template.overlayView(session ? session.state : template.init(null, c._id)) : null,
      leaderboard,
    };
  },
});
