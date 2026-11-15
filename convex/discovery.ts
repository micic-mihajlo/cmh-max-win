import { ConvexError, v } from 'convex/values';

import type { Doc, Id } from './_generated/dataModel';
import { mutation, query, type MutationCtx, type QueryCtx } from './_generated/server';
import { paidPlaceCount } from './challenges';
import { isTestLabel } from './feed';
import { resolveIdentity, type ResolvedIdentity } from './whopAuth';
import { findCreatorByHandle, normalizeHandle } from './handles';
import type {
  ChallengeCardView,
  ChallengePhase,
  ChallengeReminderView,
  CreatorPageView,
  PastChallengeCardView,
  PrizePoolView,
  SharePreviewView,
  SignalErrorCode,
  WinnerTeamView,
} from '../src/lib/contract';

// Creator discovery for #58 challenges: the public creator page, the share-link resolver, follows and reminders.
// Reads challenges, entries and teams through their indexes and writes only its own rows: follows reuse the drops
// feed's streamers/follows tables (a creator and a drop host are the same device token), reminders are new.

type Challenge = Doc<'challenges'>;
type Creator = Doc<'creators'>;

function fail(code: SignalErrorCode, message: string): never {
  throw new ConvexError({ code, message });
}

const RECENT = 5;

export function phaseOf(c: Challenge): ChallengePhase | null {
  switch (c.status) {
    case 'draft':
      return null;
    case 'published':
      return c.config.startMode === 'window' ? 'open' : 'upcoming';
    default:
      return c.status;
  }
}

// '$100', '$1,250.50'. Entry is always free; the pool is what the top places split.
export function prizePool(c: Challenge): PrizePoolView {
  const cents = c.config.poolCents;
  const whole = Math.floor(cents / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const dollars = cents % 100 ? whole + '.' + String(cents % 100).padStart(2, '0') : whole;
  const concept = c.config.payoutAdapter === 'concept';
  const display = cents > 0 ? '$' + dollars : 'No prize';
  return {
    cents,
    display,
    concept,
    label: cents > 0 ? `Free to enter · ${display} prize pool${concept ? ' (concept)' : ''}` : 'Free to enter',
  };
}

// 'nova-friday-race-k7qm': the handle (no '-' in handles), title words, then the join code.
export function slugOf(handle: string, title: string, code: string | null) {
  const words = title
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/, '');
  return [handle, words, code?.toLowerCase()].filter(Boolean).join('-');
}

const entriesOf = (ctx: QueryCtx, challengeId: Id<'challenges'>) =>
  ctx.db
    .query('challengeEntries')
    .withIndex('by_challenge', (q) => q.eq('challengeId', challengeId))
    .collect();

async function cardOf(ctx: QueryCtx, c: Challenge, creator: Creator): Promise<ChallengeCardView> {
  return {
    challengeId: c._id,
    title: c.config.title,
    blurb: c.config.blurb,
    templateId: c.config.templateId,
    phase: phaseOf(c)!,
    startMode: c.config.startMode,
    startsAt: c.config.startMode === 'scheduled' ? c.config.startsAt : null,
    endsAt: c.config.endsAt,
    membersOnly: c.config.eligibility.kind === 'whop_members',
    prizePool: prizePool(c),
    joinCode: c.joinCode ?? null,
    slug: slugOf(creator.handle, c.config.title, c.joinCode ?? null),
    entrantCount: (await entriesOf(ctx, c._id)).length,
  };
}

// Paid places only, with the names players chose when they joined.
async function winnersOf(ctx: QueryCtx, c: Challenge): Promise<WinnerTeamView[]> {
  const paid = paidPlaceCount(c.config.reward);
  const entries = await entriesOf(ctx, c._id);
  const nameOf = new Map(entries.map((e) => [e._id as string, e.name]));
  const placed: WinnerTeamView[] = [];
  if (c.config.teamFormation === 'mixer') {
    const teams = await ctx.db
      .query('mixerTeams')
      .withIndex('by_challenge', (q) => q.eq('challengeId', c._id))
      .collect();
    for (const t of teams) {
      if (t.place !== undefined && t.place <= paid) placed.push({ place: t.place, teamLabel: t.label, memberNames: t.memberIds.map((id) => nameOf.get(id) ?? '') });
    }
  } else {
    const teams = await ctx.db
      .query('challengeTeams')
      .withIndex('by_challenge', (q) => q.eq('challengeId', c._id))
      .collect();
    for (const t of teams) {
      if (t.place === undefined || t.place > paid) continue;
      const members = entries.filter((e) => e.teamId === t._id).sort((a, b) => a.joinedAt - b.joinedAt);
      placed.push({ place: t.place, teamLabel: t.label, memberNames: members.map((m) => m.name) });
    }
  }
  return placed.sort((a, b) => a.place - b.place);
}

const startOrder = (c: Challenge) => (c.config.startMode === 'scheduled' && c.config.startsAt !== null ? c.config.startsAt : Infinity);
const byStart = (a: Challenge, b: Challenge) => startOrder(a) - startOrder(b) || (a.publishedAt ?? 0) - (b.publishedAt ?? 0);

// ---------- Follows (shared with the drops feed) ----------

async function streamerOf(ctx: QueryCtx, creator: Creator) {
  return ctx.db
    .query('streamers')
    .withIndex('by_host', (q) => q.eq('hostToken', creator.deviceToken))
    .unique();
}

async function followRows(ctx: QueryCtx, me: ResolvedIdentity, streamerId: Id<'streamers'>) {
  const byDevice = await ctx.db
    .query('follows')
    .withIndex('by_device', (q) => q.eq('deviceToken', me.deviceToken).eq('streamerId', streamerId))
    .collect();
  const byWhop = me.whopUserId
    ? await ctx.db
        .query('follows')
        .withIndex('by_whop_user', (q) => q.eq('whopUserId', me.whopUserId).eq('streamerId', streamerId))
        .collect()
    : [];
  return [...byDevice, ...byWhop.filter((w) => !byDevice.some((d) => d._id === w._id))];
}

async function followerCount(ctx: QueryCtx, streamerId: Id<'streamers'> | undefined) {
  if (!streamerId) return 0;
  const rows = await ctx.db
    .query('follows')
    .withIndex('by_streamer', (q) => q.eq('streamerId', streamerId))
    .collect();
  return new Set(rows.map((r) => r.whopUserId ?? 'device:' + r.deviceToken)).size;
}

async function follow(ctx: MutationCtx, me: ResolvedIdentity, creator: Creator) {
  const existing = await streamerOf(ctx, creator);
  const streamerId = existing?._id ?? (await ctx.db.insert('streamers', { hostToken: creator.deviceToken, name: creator.displayName, updatedAt: Date.now() }));
  const mine = await ctx.db
    .query('follows')
    .withIndex('by_device', (q) => q.eq('deviceToken', me.deviceToken).eq('streamerId', streamerId))
    .first();
  if (!mine) {
    await ctx.db.insert('follows', { deviceToken: me.deviceToken, streamerId, ...(me.whopUserId ? { whopUserId: me.whopUserId } : {}), createdAt: Date.now() });
  } else if (me.whopUserId && mine.whopUserId !== me.whopUserId) {
    await ctx.db.patch(mine._id, { whopUserId: me.whopUserId });
  }
  return { following: true, followerCount: await followerCount(ctx, streamerId) };
}

async function requireCreator(ctx: QueryCtx, handle: string) {
  const creator = await findCreatorByHandle(ctx, handle);
  if (!creator) fail('CHALLENGE_NOT_FOUND', 'No creator with that handle.');
  return creator;
}

export const followCreator = mutation({
  args: { deviceToken: v.string(), handle: v.string() },
  handler: async (ctx, { deviceToken, handle }) => follow(ctx, await resolveIdentity(ctx, deviceToken), await requireCreator(ctx, handle)),
});

export const unfollowCreator = mutation({
  args: { deviceToken: v.string(), handle: v.string() },
  handler: async (ctx, { deviceToken, handle }) => {
    const creator = await requireCreator(ctx, handle);
    const streamer = await streamerOf(ctx, creator);
    if (streamer) for (const row of await followRows(ctx, await resolveIdentity(ctx, deviceToken), streamer._id)) await ctx.db.delete(row._id);
    return { following: false, followerCount: await followerCount(ctx, streamer?._id) };
  },
});

// ---------- Creator page ----------

export const creatorPage = query({
  args: { handle: v.string(), deviceToken: v.optional(v.string()) },
  handler: async (ctx, { handle, deviceToken }): Promise<CreatorPageView | null> => {
    const creator = await findCreatorByHandle(ctx, handle);
    if (!creator) return null;
    const hiddenHost = await streamerOf(ctx, creator);
    if (hiddenHost && (hiddenHost.hidden || isTestLabel(hiddenHost.name))) return null;
    const all = await ctx.db
      .query('challenges')
      .withIndex('by_creator', (q) => q.eq('creatorToken', creator.deviceToken))
      .collect();
    const inPhase = (...phases: ChallengePhase[]) => all.filter((c) => phases.includes(phaseOf(c)!));
    const live = inPhase('live', 'open').sort((a, b) => (b.firstDealtAt ?? b.publishedAt ?? 0) - (a.firstDealtAt ?? a.publishedAt ?? 0));
    const upcoming = inPhase('upcoming').sort(byStart);
    const ended = inPhase('ended')
      .sort((a, b) => (b.endedAt ?? 0) - (a.endedAt ?? 0))
      .slice(0, RECENT);
    const streamer = await streamerOf(ctx, creator);
    const me = deviceToken ? await resolveIdentity(ctx, deviceToken) : null;
    return {
      creatorId: creator._id,
      displayName: creator.displayName,
      handle: '@' + creator.handle,
      followerCount: await followerCount(ctx, streamer?._id),
      following: !!(me && streamer && (await followRows(ctx, me, streamer._id)).length),
      live: await Promise.all(live.map((c) => cardOf(ctx, c, creator))),
      upcoming: await Promise.all(upcoming.map((c) => cardOf(ctx, c, creator))),
      recent: await Promise.all(
        ended.map(async (c): Promise<PastChallengeCardView> => ({ ...(await cardOf(ctx, c, creator)), endedAt: c.endedAt ?? c.createdAt, winners: await winnersOf(ctx, c) })),
      ),
      serverNow: Date.now(),
    };
  },
});

// ---------- Share links ----------

// A code, a slug ('nova-friday-race-k7qm' or 'nova/K7QM'), a URL ending in a code, a slug or '@nova/K7QM' (or with
// ?code=), or a challenge id. A slug's handle must match the challenge's creator.
export function parseShareRef(raw: string): { code: string | null; handle: string | null; id: string } {
  let ref = raw.trim();
  try {
    const url = new URL(ref);
    const segments = url.pathname.split('/').filter(Boolean);
    const [prev, last] = segments.slice(-2);
    ref = url.searchParams.get('code') ?? (prev?.startsWith('@') && /^[A-Za-z0-9]{4}$/.test(last ?? '') ? prev + '/' + last : (segments.at(-1) ?? ''));
  } catch {
    // not a URL
  }
  const parts = ref.split(/[/-]/).filter(Boolean);
  const last = parts[parts.length - 1] ?? '';
  const code = /^[A-Za-z0-9]{4}$/.test(last) ? last.toUpperCase() : null;
  const handle = parts.length > 1 && code ? normalizeHandle(parts[0]) : null;
  return { code, handle, id: ref };
}

async function resolveShare(ctx: QueryCtx, ref: string): Promise<Challenge | null> {
  const { code, handle, id } = parseShareRef(ref);
  const byId = ctx.db.normalizeId('challenges', id);
  if (byId) return ctx.db.get(byId);
  if (!code) return null;
  let matches = await ctx.db
    .query('challenges')
    .withIndex('by_joinCode', (q) => q.eq('joinCode', code))
    .collect();
  if (handle) {
    const creator = await findCreatorByHandle(ctx, handle);
    matches = matches.filter((c) => c.creatorToken === creator?.deviceToken);
  }
  // Codes are reused once a challenge is over: the open one wins, else the newest.
  return matches.find((c) => c.status === 'published' || c.status === 'live') ?? matches.sort((a, b) => b.createdAt - a.createdAt)[0] ?? null;
}

export const shareLink = query({
  args: { ref: v.string() },
  handler: async (ctx, { ref }): Promise<SharePreviewView | null> => {
    const c = await resolveShare(ctx, ref);
    const phase = c ? phaseOf(c) : null;
    if (!c || !phase) return null;
    const creator = await ctx.db
      .query('creators')
      .withIndex('by_token', (q) => q.eq('deviceToken', c.creatorToken))
      .first();
    const open = phase === 'upcoming' || phase === 'open' || phase === 'live';
    return {
      challengeId: c._id,
      title: c.config.title,
      creator: { displayName: creator?.displayName ?? 'Host', handle: creator ? '@' + creator.handle : '' },
      phase,
      startMode: c.config.startMode,
      startsAt: c.config.startMode === 'scheduled' ? c.config.startsAt : null,
      endsAt: c.config.endsAt,
      membersOnly: c.config.eligibility.kind === 'whop_members',
      prizePool: prizePool(c),
      joinCode: open ? (c.joinCode ?? null) : null,
      slug: slugOf(creator?.handle ?? '', c.config.title, c.joinCode ?? null),
      serverNow: Date.now(),
    };
  },
});

// ---------- Reminders ----------

const remindable = (c: Challenge) => c.status === 'published' && c.config.startMode !== 'window';

export const remindChallenge = mutation({
  args: { deviceToken: v.string(), challengeId: v.string() },
  handler: async (ctx, { deviceToken, challengeId }) => {
    const id = ctx.db.normalizeId('challenges', challengeId);
    const c = id ? await ctx.db.get(id) : null;
    if (!c || c.status === 'draft') fail('CHALLENGE_NOT_FOUND', 'No such challenge.');
    if (!remindable(c)) fail('CHALLENGE_CLOSED', 'Only a challenge that has not started takes reminders.');
    const me = await resolveIdentity(ctx, deviceToken);
    const creator = await ctx.db
      .query('creators')
      .withIndex('by_token', (q) => q.eq('deviceToken', c.creatorToken))
      .first();
    if (creator) await follow(ctx, me, creator);
    const existing = await ctx.db
      .query('challengeReminders')
      .withIndex('by_device', (q) => q.eq('deviceToken', me.deviceToken).eq('challengeId', c._id))
      .first();
    if (!existing) await ctx.db.insert('challengeReminders', { deviceToken: me.deviceToken, challengeId: c._id, createdAt: Date.now() });
  },
});

export const cancelChallengeReminder = mutation({
  args: { deviceToken: v.string(), challengeId: v.string() },
  handler: async (ctx, { deviceToken, challengeId }) => {
    const id = ctx.db.normalizeId('challenges', challengeId);
    if (!id) return;
    const rows = await ctx.db
      .query('challengeReminders')
      .withIndex('by_device', (q) => q.eq('deviceToken', deviceToken).eq('challengeId', id))
      .collect();
    for (const row of rows) await ctx.db.delete(row._id);
  },
});

// This device's reminders for challenges that haven't started: timed ones soonest first, then live-mode ones.
export const upcomingReminders = query({
  args: { deviceToken: v.string() },
  handler: async (ctx, { deviceToken }): Promise<ChallengeReminderView[]> => {
    const rows = await ctx.db
      .query('challengeReminders')
      .withIndex('by_device', (q) => q.eq('deviceToken', deviceToken))
      .collect();
    const challenges = (await Promise.all(rows.map((r) => ctx.db.get(r.challengeId)))).filter((c): c is Challenge => !!c && remindable(c));
    return Promise.all(
      challenges.sort(byStart).map(async (c) => {
        const creator = await ctx.db
          .query('creators')
          .withIndex('by_token', (q) => q.eq('deviceToken', c.creatorToken))
          .first();
        return {
          challengeId: c._id,
          title: c.config.title,
          creator: { displayName: creator?.displayName ?? 'Host', handle: creator ? '@' + creator.handle : '' },
          startMode: c.config.startMode,
          startsAt: c.config.startMode === 'scheduled' ? c.config.startsAt : null,
          joinCode: c.joinCode ?? null,
        };
      }),
    );
  },
});
