import { ConvexError, v } from 'convex/values';

import { internal } from './_generated/api';
import type { Doc, Id } from './_generated/dataModel';
import { internalMutation, mutation, query, type MutationCtx, type QueryCtx } from './_generated/server';
import { creatorOf, dealLive, endNow, entriesOf, finishersOf, findByCode, getChallenge, paidPlaceCount, requireOwned, teamsOf } from './challenges';
import { liveTemplateFor } from './liveTemplates';
import { joinedOf, locksOf, pulseOf, snapshotOf, writePulse } from './roomPulse';
import { isSessionTemplate, teamSessionsOf, withOpenAnswers } from './teamSessions';
import { answerOf, type QuizState } from './templates/quickQuiz';
import { resolveIdentity } from './creatorIdentity';
import { act, checkSession, hostAdvance, publicBoard, tickSession, viewsFor, wakeTimes, type Session as EngineSession } from './templates/engine';
import type { LiveErrorCode, LivePhase, LiveView, SignalErrorCode, TeamSessionView } from '../src/lib/contract';
import type { RoomPulse, RoomPulseKey, RoomPulseShared } from '../src/lib/contract-pulse';

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
  const rows = (await teamSessionsOf(ctx, c._id)).sort((a, b) => a.label.localeCompare(b.label));
  const sessions = await withOpenAnswers(ctx, c, rows);
  return publicBoard(c.config.templateId, rows.map((r, i) => ({ label: r.label, session: sessions[i] })));
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
  await writePulse(ctx, c);
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

// openFirst: a host-paced template (quick-quiz) also opens its first round, so one press starts the clock.
export const startLive = mutation({
  args: { deviceToken: v.string(), challengeId: v.string(), openFirst: v.optional(v.boolean()) },
  handler: async (ctx, { deviceToken, challengeId, openFirst }) => {
    const c = await requireOwned(ctx, deviceToken, challengeId);
    if (c.status !== 'published' || c.config.startMode !== 'live') fail('CHALLENGE_CLOSED', 'Only an open live-mode challenge can be started.');
    if (c.config.teamFormation === 'dealt') await dealLive(ctx, c);
    else await ctx.db.patch(c._id, { status: 'live', firstDealtAt: Date.now() });
    await lockNow(ctx, c);
    if (!openFirst || !isSessionTemplate(c.config.templateId)) return;
    const now = Date.now();
    const rows = await teamSessionsOf(ctx, c._id);
    await saveTeamSessions(ctx, c, rows, rows.map((r) => hostAdvance(r.session as EngineSession, now)), now);
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
      // A Next for a round the host no longer sees (a slow double tap) is a no-op, not a skipped question.
      const seen = (payload ?? {}) as { expectedIndex?: number | null; expectedPhase?: string };
      const current = await board(ctx, c);
      const round = current.round as { index: number | null; phase: string } | null;
      if (seen.expectedIndex !== undefined && round && (round.index !== seen.expectedIndex || (seen.expectedPhase !== undefined && round.phase !== seen.expectedPhase))) {
        return { view: current };
      }
      rateLimit(session, action, DEFAULT_MIN_INTERVAL_MS, now);
      await ctx.db.patch(session._id, { lastActionAt: { ...session.lastActionAt, [action]: now } });
      const rows = await teamSessionsOf(ctx, c._id);
      await saveTeamSessions(ctx, c, rows, (await withOpenAnswers(ctx, c, rows)).map((s) => hostAdvance(s, now)), now);
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
    await saveTeamSessions(ctx, c, rows, (await withOpenAnswers(ctx, c, rows)).map((s) => tickSession(s, now)), now);
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
    const now = Date.now();
    const [current] = await withOpenAnswers(ctx, c, [mine.row], mine.entry._id);
    const { session } = act(current, mine.entry._id, action, now);
    const state = session.state as QuizState;
    const answer = c.config.templateId === 'quick-quiz' && action.type === 'answer' ? answerOf(state, mine.entry._id, action.questionIndex) : null;
    // Per-player play: the answer lives in the player's own lock row until its question closes, so teammates
    // locking together never write the team session at once. Sessions dealt before it save the team's answer.
    if (!answer || !state.byPlayer) await ctx.db.patch(mine.row._id, { session });
    if (answer) {
      await ctx.db.insert('pulseLocks', {
        challengeId: c._id,
        questionIndex: action.questionIndex,
        teamId: mine.row.teamId,
        playerId: mine.entry._id,
        lockedAt: now,
        choice: answer.choice,
        points: answer.points,
      });
    }
  },
});

// What this device's team sees: the template's shared view and this player's private view.
export const teamSessionView = query({
  args: { deviceToken: v.string(), challengeId: v.string() },
  handler: async (ctx, { deviceToken, challengeId }): Promise<TeamSessionView | null> => {
    const c = await getChallenge(ctx, challengeId);
    const mine = c ? await myTeamSession(ctx, c._id, deviceToken) : null;
    if (!mine) return null;
    const [session] = await withOpenAnswers(ctx, c!, [mine.row]);
    const { shared, mine: own } = viewsFor(session, mine.entry._id);
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

// The room pulse (CAP-82) for anyone in the room: an entrant or the host. Engine-session challenges read their
// pulse doc and one row per locked team; the lobby reads the join shards. Other templates build it from the base
// tables. Names only, and no correctness before a question's reveal.
async function pulseBody(ctx: QueryCtx, c: Challenge): Promise<RoomPulseShared> {
  const engine = isSessionTemplate(c.config.templateId);
  const doc = engine ? await pulseOf(ctx, c._id) : null;
  const snap = doc ?? (engine && c.status === 'published' ? null : await snapshotOf(ctx, c));
  const pulse = snap ?? {
    joined: await joinedOf(ctx, c._id),
    phase: 'lobby' as const,
    questionIndex: null,
    questionCount: (c.config.templateConfig as { questions?: unknown[] } | undefined)?.questions?.length ?? 0,
    deadline: null,
    teams: [],
  };
  const locks = engine && pulse.questionIndex !== null ? await locksOf(ctx, c._id, pulse.questionIndex) : null;
  const over = c.status === 'ended' || c.status === 'cancelled';
  return {
    serverNow: Date.now(),
    phase: over ? 'finished' : pulse.phase,
    joined: pulse.joined,
    questionIndex: pulse.questionIndex,
    questionCount: pulse.questionCount,
    deadline: pulse.deadline,
    spotsLeft: c.config.poolCents > 0 ? Math.max(0, paidPlaceCount(c.config.reward) - c.finishedCount) : null,
    teams: pulse.teams.map((t) => {
      const base = { id: t.id, label: t.label, memberFirstNames: t.memberFirstNames, correct: t.correct };
      if (!locks) return { ...base, lockedAt: null };
      const lock = locks.get(t.id);
      const lockedCount = lock?.count ?? 0;
      return { ...base, lockedAt: lock && lockedCount >= t.memberCount ? lock.last : null, lockedCount, memberCount: t.memberCount };
    }),
  };
}

async function openRoom(ctx: QueryCtx, code: string) {
  const c = await findByCode(ctx, code);
  return !c || c.status === 'draft' || !c.joinCode ? null : c;
}

// The viewer's entry, or null for the host; NOT_ENTERED for anyone else.
async function roomViewer(ctx: QueryCtx, c: Challenge, deviceToken: string) {
  const entry = await ctx.db
    .query('challengeEntries')
    .withIndex('by_challenge_token', (q) => q.eq('challengeId', c._id).eq('deviceToken', deviceToken))
    .unique();
  if (!entry && c.creatorToken !== (await resolveIdentity(ctx, deviceToken)).deviceToken) fail('NOT_ENTERED', 'You are not in this challenge.');
  return entry;
}

// The same for everyone in one room and derived from the host's private token, so only members learn it.
async function roomKeyOf(c: Challenge) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('room-pulse:' + c._id + ':' + c.creatorToken));
  return Array.from(new Uint8Array(digest).slice(0, 16), (b) => b.toString(16).padStart(2, '0')).join('');
}

export const roomPulse = query({
  args: { code: v.string(), deviceToken: v.string() },
  handler: async (ctx, { code, deviceToken }): Promise<RoomPulse | null> => {
    const c = await openRoom(ctx, code);
    if (!c) return null;
    const entry = await roomViewer(ctx, c, deviceToken);
    return { ...(await pulseBody(ctx, c)), myTeamId: entry?.teamId ?? null };
  },
});

// useRoomPulse's two halves. roomPulseKey is per device and rarely changes; roomPulseShared takes the room key, so
// every subscriber in the room sends the same args and Convex runs it once per write instead of once per device.
export const roomPulseKey = query({
  args: { code: v.string(), deviceToken: v.string() },
  handler: async (ctx, { code, deviceToken }): Promise<RoomPulseKey | null> => {
    const c = await openRoom(ctx, code);
    if (!c) return null;
    const entry = await roomViewer(ctx, c, deviceToken);
    return { roomKey: await roomKeyOf(c), myTeamId: entry?.teamId ?? null };
  },
});

export const roomPulseShared = query({
  args: { code: v.string(), roomKey: v.string() },
  handler: async (ctx, { code, roomKey }): Promise<RoomPulseShared | null> => {
    const c = await openRoom(ctx, code);
    if (!c) return null;
    if (roomKey !== (await roomKeyOf(c))) fail('NOT_ENTERED', 'You are not in this challenge.');
    return pulseBody(ctx, c);
  },
});
