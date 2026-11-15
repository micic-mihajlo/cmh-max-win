import { ConvexError, v } from 'convex/values';

import { internal } from './_generated/api';
import type { Doc, Id } from './_generated/dataModel';
import { internalMutation, mutation, query, type MutationCtx, type QueryCtx } from './_generated/server';
import { bountyView } from './drops';
import { resolveIdentity, type ResolvedIdentity } from './whopAuth';
import type {
  FeedLiveRow,
  FeedPushData,
  FeedResultRow,
  FeedUpcomingRow,
  FollowingFeedView,
  FollowResult,
  SignalErrorCode,
  StreamerCardView,
  StreamerPageView,
} from '../src/lib/contract';

// Follow feed, live status, scheduled drops and Remind me for hosted drops (signal/design/feed-notifications.md).
// drops.hostDrop calls noteHostedDrop; everything else here reads drops, entries and solves through their indexes.

export const STARTING_LEAD_MS = 2 * 60 * 1000; // "Nova's room opens in 2 minutes"
export const MAX_SCHEDULE_AHEAD_MS = 30 * 24 * 60 * 60 * 1000;
export const IDLE_MS = 20 * 60 * 1000; // an open drop with no entry, lock-in or solve this long stops counting as live
export const STALE_DROP_MS = 2 * 60 * 60 * 1000; // expireStaleDrops ends test hosted drops older than this
export const ABANDONED_DROP_MS = 12 * 60 * 60 * 1000; // and real ones this old, once dealt with no squad still racing
export const MIN_SHOWN_FOLLOWERS = 3;
export const MAX_SQUADMATES = 3;
const RECENT_DROPS = 20;

// Load-test and QA hosts and drops, kept off the public feed.
const TEST_LABELS = [/^load\b/i, /\bload ·/i, /^qa\b/i, /CMHM-\d+/, /\(ignore\)/i];
export const isTestLabel = (label: string) => TEST_LABELS.some((p) => p.test(label.trim()));
const isHiddenStreamer = (s: Doc<'streamers'>) => !!s.hidden || isTestLabel(s.name);

// "Demo · Rio" -> "Rio", "Ana Lima" -> "Ana".
export function firstName(name: string) {
  return (name.split(' · ').at(-1) ?? '').trim().split(/\s+/)[0] ?? '';
}

export const safeAvatarUrl = (url: string | undefined) => (url && /^https:\/\/\S+$/.test(url) && url.length <= 300 ? url : undefined);

function fail(code: SignalErrorCode, message: string): never {
  throw new ConvexError({ code, message });
}

// hostDrop's optional start time: at least STARTING_LEAD_MS ahead, so the 2-minute ping is true.
export function checkScheduledStart(startsAt: number, now: number) {
  if (!Number.isFinite(startsAt) || startsAt < now + STARTING_LEAD_MS || startsAt > now + MAX_SCHEDULE_AHEAD_MS) {
    fail('WRONG_STATUS', 'Pick a start time between 2 minutes and 30 days from now.');
  }
}

// ---------- Hosting: live status and the two scheduled triggers ----------

export async function noteHostedDrop(
  ctx: MutationCtx,
  args: { hostToken: string; name: string; dropId: string; scheduledFor: number | null; avatarUrl?: string },
) {
  const now = Date.now();
  const existing = await ctx.db
    .query('streamers')
    .withIndex('by_host', (q) => q.eq('hostToken', args.hostToken))
    .unique();
  const avatar = safeAvatarUrl(args.avatarUrl);
  const fields = { name: args.name, updatedAt: now, ...(avatar ? { avatarUrl: avatar } : {}) };
  if (existing) await ctx.db.patch(existing._id, fields);
  const streamerId = existing?._id ?? (await ctx.db.insert('streamers', { hostToken: args.hostToken, ...fields }));
  await ctx.db.insert('streamerDrops', {
    streamerId,
    dropId: args.dropId,
    createdAt: now,
    scheduledFor: args.scheduledFor,
    openedAt: args.scheduledFor === null ? now : null,
  });
  if (args.scheduledFor === null) {
    await queueLivePush(ctx, args.dropId);
    return;
  }
  await ctx.scheduler.runAt(args.scheduledFor - STARTING_LEAD_MS, internal.feed.roomStarting, { dropId: args.dropId });
  await ctx.scheduler.runAt(args.scheduledFor, internal.feed.openScheduledDrop, { dropId: args.dropId });
}

const dropById = (ctx: QueryCtx, dropId: string) =>
  ctx.db
    .query('drops')
    .withIndex('by_dropId', (q) => q.eq('dropId', dropId))
    .unique();

const streamerDropOf = (ctx: QueryCtx, dropId: string) =>
  ctx.db
    .query('streamerDrops')
    .withIndex('by_drop', (q) => q.eq('dropId', dropId))
    .unique();

// A scheduled drop's start time came: the streamer goes live with it.
export const openScheduledDrop = internalMutation({
  args: { dropId: v.string() },
  handler: async (ctx, { dropId }) => {
    const [sd, drop] = await Promise.all([streamerDropOf(ctx, dropId), dropById(ctx, dropId)]);
    if (!sd || sd.openedAt !== null || !drop || drop.status === 'ended') return;
    await ctx.db.patch(sd._id, { openedAt: Date.now() });
    await queueLivePush(ctx, dropId);
  },
});

// Two minutes before a scheduled drop: everyone who tapped Remind me or already entered.
export const roomStarting = internalMutation({
  args: { dropId: v.string() },
  handler: async (ctx, { dropId }) => {
    const [sd, drop] = await Promise.all([streamerDropOf(ctx, dropId), dropById(ctx, dropId)]);
    if (!sd || sd.openedAt !== null || !drop || drop.status !== 'scheduled') return;
    const streamer = (await ctx.db.get(sd.streamerId))!;
    const [reminders, entries] = await Promise.all([
      ctx.db
        .query('dropReminders')
        .withIndex('by_drop', (q) => q.eq('dropId', dropId))
        .collect(),
      ctx.db
        .query('dropEntries')
        .withIndex('by_drop', (q) => q.eq('dropId', dropId))
        .collect(),
    ]);
    const devices = [...reminders, ...entries].map((r) => r.deviceToken).filter((t) => t !== drop.hostToken);
    // squadmates: the first names of the others already waiting, or dealt into this device's squad. Never this device.
    const squadmatesOf = (deviceToken: string) => {
      const mine = entries.find((e) => e.deviceToken === deviceToken);
      const pool = mine?.squadRoomId ? entries.filter((e) => e.squadRoomId === mine.squadRoomId) : entries.filter((e) => !e.squadRoomId && !e.unmatched);
      const names = pool.filter((e) => e.deviceToken !== deviceToken && e.deviceToken !== drop.hostToken).map((e) => firstName(e.name));
      const squadmates = [...new Set(names.filter(Boolean))].slice(0, MAX_SQUADMATES);
      return squadmates.length ? { squadmates } : {};
    };
    await queuePush(
      ctx,
      drop,
      devices,
      {
        title: `${streamer.name}'s room opens in 2 minutes`,
        body: 'Your squad is waiting.',
        data: { kind: 'starting', dropId, joinCode: drop.joinCode ?? '', streamerId: streamer._id },
      },
      squadmatesOf,
    );
  },
});

async function followerDevices(ctx: QueryCtx, streamerId: Id<'streamers'>) {
  const rows = await ctx.db
    .query('follows')
    .withIndex('by_streamer', (q) => q.eq('streamerId', streamerId))
    .collect();
  const devices = new Set(rows.map((r) => r.deviceToken));
  for (const whopUserId of new Set(rows.flatMap((r) => (r.whopUserId ? [r.whopUserId] : [])))) {
    const linked = await ctx.db
      .query('identities')
      .withIndex('by_whop_user', (q) => q.eq('whopUserId', whopUserId))
      .collect();
    for (const identity of linked) devices.add(identity.deviceToken);
  }
  return devices;
}

// Going live: the streamer's followers, while entries are still open.
async function queueLivePush(ctx: MutationCtx, dropId: string) {
  const [sd, drop] = await Promise.all([streamerDropOf(ctx, dropId), dropById(ctx, dropId)]);
  if (!sd || !drop || drop.status !== 'scheduled' || !drop.joinCode) return;
  const streamer = (await ctx.db.get(sd.streamerId))!;
  const devices = [...(await followerDevices(ctx, streamer._id))].filter((t) => t !== drop.hostToken);
  await queuePush(ctx, drop, devices, {
    title: `${streamer.name} is live · ${drop.title}`,
    body: `Join with ${drop.joinCode}.`,
    data: { kind: 'live', dropId, joinCode: drop.joinCode, streamerId: streamer._id },
  });
}

// Dedupe: one push per device per drop, recorded before the send. Devices with no push token are skipped (and
// not recorded, so a token registered later still gets the next ping). Nothing to send: no action is scheduled.
export async function queuePush(
  ctx: MutationCtx,
  drop: Doc<'drops'>,
  deviceTokens: Iterable<string>,
  message: { title: string; body: string; data: FeedPushData },
  dataFor?: (deviceToken: string) => Partial<FeedPushData>,
) {
  const messages: { to: string; title: string; body: string; data: FeedPushData }[] = [];
  for (const deviceToken of new Set(deviceTokens)) {
    const sent = await ctx.db
      .query('pushSends')
      .withIndex('by_device_drop', (q) => q.eq('deviceToken', deviceToken).eq('dropId', drop.dropId))
      .first();
    if (sent) continue;
    const tokens = await ctx.db
      .query('pushTokens')
      .withIndex('by_device', (q) => q.eq('deviceToken', deviceToken))
      .collect();
    if (!tokens.length) continue;
    await ctx.db.insert('pushSends', { deviceToken, dropId: drop.dropId, kind: message.data.kind, sentAt: Date.now() });
    const data = { ...message.data, ...dataFor?.(deviceToken) };
    for (const t of tokens) messages.push({ to: t.token, ...message, data });
  }
  if (messages.length) await ctx.scheduler.runAfter(0, internal.push.send, { messages });
  return messages.length;
}

// ---------- Reads ----------

type HostedDrop = { sd: Doc<'streamerDrops'>; drop: Doc<'drops'> };

async function hostedDropsOf(ctx: QueryCtx, streamerId: Id<'streamers'>): Promise<HostedDrop[]> {
  const sds = await ctx.db
    .query('streamerDrops')
    .withIndex('by_streamer', (q) => q.eq('streamerId', streamerId))
    .order('desc')
    .take(RECENT_DROPS);
  const rows: HostedDrop[] = [];
  for (const sd of sds) {
    if (sd.expiredAt !== undefined) continue;
    const drop = await dropById(ctx, sd.dropId);
    if (drop && !isTestLabel(drop.title)) rows.push({ sd, drop });
  }
  return rows;
}

// The newest sign of life: the drop opening or dealing, an entry, a lock-in or a solve.
async function lastActivityAt(ctx: QueryCtx, { sd, drop }: HostedDrop): Promise<number> {
  const [entry, solves, rooms] = await Promise.all([
    ctx.db
      .query('dropEntries')
      .withIndex('by_drop', (q) => q.eq('dropId', drop.dropId))
      .order('desc')
      .first(),
    ctx.db
      .query('solves')
      .withIndex('by_drop', (q) => q.eq('dropId', drop.dropId))
      .collect(),
    ctx.db
      .query('rooms')
      .withIndex('by_drop', (q) => q.eq('dropId', drop.dropId))
      .collect(),
  ]);
  const lockIns = await Promise.all(
    rooms.map((r) =>
      ctx.db
        .query('lockIns')
        .withIndex('by_room', (q) => q.eq('roomId', r._id))
        .order('desc')
        .first(),
    ),
  );
  return Math.max(
    sd.openedAt ?? sd.createdAt,
    drop.status === 'live' ? drop.startsAt : 0,
    entry?._creationTime ?? 0,
    ...solves.map((s) => s.solvedAt),
    ...lockIns.map((l) => l?._creationTime ?? 0),
  );
}

// "Live now", derived at read time: the drop is open (entries taken) or racing, and not idle for IDLE_MS.
async function liveSince(ctx: QueryCtx, h: HostedDrop, now: number): Promise<number | null> {
  const { sd, drop } = h;
  if (drop.status === 'ended') return null;
  const since = sd.openedAt ?? (drop.status === 'live' ? drop.startsAt : null);
  if (since === null) return null;
  return now - (await lastActivityAt(ctx, h)) < IDLE_MS ? since : null;
}

async function liveDropOf(ctx: QueryCtx, hosted: HostedDrop[], now: number) {
  for (const h of hosted) {
    const since = await liveSince(ctx, h, now);
    if (since !== null) return { h, since };
  }
  return null;
}

const isUpcoming = ({ sd, drop }: HostedDrop) => sd.scheduledFor !== null && sd.openedAt === null && drop.status === 'scheduled';

const entriesOf = (ctx: QueryCtx, dropId: string) =>
  ctx.db
    .query('dropEntries')
    .withIndex('by_drop', (q) => q.eq('dropId', dropId))
    .collect();

async function liveRow(ctx: QueryCtx, streamer: Doc<'streamers'>, h: HostedDrop, since: number): Promise<FeedLiveRow> {
  return {
    streamerId: streamer._id,
    streamerName: streamer.name,
    dropId: h.drop.dropId,
    title: h.drop.title,
    joinCode: h.drop.joinCode ?? '',
    dropStatus: h.drop.status === 'live' ? 'live' : 'scheduled',
    entrantCount: (await entriesOf(ctx, h.drop.dropId)).length,
    bounty: await bountyView(ctx, h.drop),
    liveSince: since,
  };
}

async function upcomingRow(ctx: QueryCtx, streamer: Doc<'streamers'>, h: HostedDrop, deviceToken: string): Promise<FeedUpcomingRow> {
  const reminder = await ctx.db
    .query('dropReminders')
    .withIndex('by_device', (q) => q.eq('deviceToken', deviceToken).eq('dropId', h.drop.dropId))
    .first();
  return {
    streamerId: streamer._id,
    streamerName: streamer.name,
    dropId: h.drop.dropId,
    title: h.drop.title,
    joinCode: h.drop.joinCode ?? '',
    startsAt: h.sd.scheduledFor!,
    bounty: await bountyView(ctx, h.drop),
    reminded: !!reminder,
  };
}

async function resultRow(ctx: QueryCtx, streamer: Doc<'streamers'>, { drop }: HostedDrop, deviceToken: string): Promise<FeedResultRow> {
  const [entries, solves] = await Promise.all([
    entriesOf(ctx, drop.dropId),
    ctx.db
      .query('solves')
      .withIndex('by_drop', (q) => q.eq('dropId', drop.dropId))
      .collect(),
  ]);
  const first = solves.find((s) => s.place === 1);
  const firstRoom = first ? await ctx.db.get(first.roomId) : null;
  const winnerNames = first
    ? (
        await ctx.db
          .query('members')
          .withIndex('by_room', (q) => q.eq('roomId', first.roomId))
          .collect()
      ).map((m) => m.name)
    : [];
  const mine = entries.find((e) => e.deviceToken === deviceToken);
  const mySolve = mine?.squadRoomId ? solves.find((s) => s.roomId === mine.squadRoomId) : undefined;
  const myAward = mine?.squadRoomId
    ? await ctx.db
        .query('bountyAwards')
        .withIndex('by_room', (q) => q.eq('roomId', mine.squadRoomId!))
        .unique()
    : null;
  return {
    streamerId: streamer._id,
    streamerName: streamer.name,
    dropId: drop.dropId,
    title: drop.title,
    playerCount: entries.length,
    endedAt: Math.max(drop.startsAt, ...solves.map((s) => s.solvedAt)),
    winner: first ? { squadLabel: firstRoom?.squadLabel ?? '', memberNames: winnerNames, solveMs: first.solveMs } : null,
    mine: mine ? { place: mySolve?.place ?? null, perPlayerCents: myAward?.perPlayerCents ?? null } : null,
  };
}

async function followRows(ctx: QueryCtx, me: ResolvedIdentity, streamerId: Id<'streamers'>) {
  const [byDevice, byWhop] = await Promise.all([
    ctx.db
      .query('follows')
      .withIndex('by_device', (q) => q.eq('deviceToken', me.deviceToken).eq('streamerId', streamerId))
      .collect(),
    me.whopUserId
      ? ctx.db
          .query('follows')
          .withIndex('by_whop_user', (q) => q.eq('whopUserId', me.whopUserId).eq('streamerId', streamerId))
          .collect()
      : [],
  ]);
  return [...byDevice, ...byWhop.filter((w) => !byDevice.some((d) => d._id === w._id))];
}

async function followerCount(ctx: QueryCtx, streamerId: Id<'streamers'>) {
  const rows = await ctx.db
    .query('follows')
    .withIndex('by_streamer', (q) => q.eq('streamerId', streamerId))
    .collect();
  return new Set(rows.map((r) => r.whopUserId ?? 'device:' + r.deviceToken)).size;
}

async function card(ctx: QueryCtx, me: ResolvedIdentity, streamer: Doc<'streamers'>, hosted: HostedDrop[], now: number): Promise<StreamerCardView> {
  const count = await followerCount(ctx, streamer._id);
  return {
    streamerId: streamer._id,
    name: streamer.name,
    ...(streamer.avatarUrl ? { avatarUrl: streamer.avatarUrl } : {}),
    followerCount: count,
    showFollowerCount: count >= MIN_SHOWN_FOLLOWERS,
    live: (await liveDropOf(ctx, hosted, now)) !== null,
    following: (await followRows(ctx, me, streamer._id)).length > 0,
  };
}

// Hidden (test) streamers read as missing everywhere public.
async function getStreamer(ctx: QueryCtx, streamerId: string) {
  const id = ctx.db.normalizeId('streamers', streamerId);
  const streamer = id ? await ctx.db.get(id) : null;
  return streamer && !isHiddenStreamer(streamer) ? streamer : null;
}

export const followingFeed = query({
  args: { deviceToken: v.string() },
  handler: async (ctx, { deviceToken }): Promise<FollowingFeedView> => {
    const now = Date.now();
    const me = await resolveIdentity(ctx, deviceToken);
    const [byDevice, byWhop] = await Promise.all([
      ctx.db
        .query('follows')
        .withIndex('by_device', (q) => q.eq('deviceToken', me.deviceToken))
        .collect(),
      me.whopUserId
        ? ctx.db
            .query('follows')
            .withIndex('by_whop_user', (q) => q.eq('whopUserId', me.whopUserId))
            .collect()
        : [],
    ]);
    const view: FollowingFeedView = { following: [], live: [], upcoming: [], results: [], serverNow: now };
    for (const streamerId of new Set([...byDevice, ...byWhop].map((f) => f.streamerId))) {
      const streamer = await ctx.db.get(streamerId);
      if (!streamer || isHiddenStreamer(streamer)) continue;
      const hosted = await hostedDropsOf(ctx, streamerId);
      view.following.push(await card(ctx, me, streamer, hosted, now));
      for (const h of hosted) {
        const since = await liveSince(ctx, h, now);
        if (since !== null) view.live.push(await liveRow(ctx, streamer, h, since));
        else if (isUpcoming(h)) view.upcoming.push(await upcomingRow(ctx, streamer, h, me.deviceToken));
        else if (h.drop.status === 'ended') view.results.push(await resultRow(ctx, streamer, h, me.deviceToken));
      }
    }
    view.following.sort((a, b) => Number(b.live) - Number(a.live) || a.name.localeCompare(b.name));
    view.live.sort((a, b) => b.liveSince - a.liveSince);
    view.upcoming.sort((a, b) => a.startsAt - b.startsAt);
    view.results = view.results.sort((a, b) => b.endedAt - a.endedAt).slice(0, 5);
    return view;
  },
});

export const streamerPage = query({
  args: { deviceToken: v.string(), streamerId: v.string() },
  handler: async (ctx, { deviceToken, streamerId }): Promise<StreamerPageView | null> => {
    const now = Date.now();
    const streamer = await getStreamer(ctx, streamerId);
    if (!streamer) return null;
    const me = await resolveIdentity(ctx, deviceToken);
    const hosted = await hostedDropsOf(ctx, streamer._id);
    const live = await liveDropOf(ctx, hosted, now);
    const next = hosted.filter(isUpcoming).sort((a, b) => a.sd.scheduledFor! - b.sd.scheduledFor!)[0];
    const past = await Promise.all(hosted.filter((h) => h.drop.status === 'ended').map((h) => resultRow(ctx, streamer, h, me.deviceToken)));
    return {
      ...(await card(ctx, me, streamer, hosted, now)),
      liveDrop: live ? await liveRow(ctx, streamer, live.h, live.since) : null,
      nextDrop: next ? await upcomingRow(ctx, streamer, next, me.deviceToken) : null,
      past: past.sort((a, b) => b.endedAt - a.endedAt).slice(0, 3),
      serverNow: now,
    };
  },
});

// "Find streamers": the 50 most recently active, live first, then most followed.
export const streamers = query({
  args: { deviceToken: v.string() },
  handler: async (ctx, { deviceToken }): Promise<StreamerCardView[]> => {
    const now = Date.now();
    const me = await resolveIdentity(ctx, deviceToken);
    const recent = (await ctx.db.query('streamers').withIndex('by_updated').order('desc').take(100)).filter((s) => !isHiddenStreamer(s)).slice(0, 50);
    const cards = await Promise.all(recent.map(async (s) => card(ctx, me, s, await hostedDropsOf(ctx, s._id), now)));
    return cards.sort((a, b) => Number(b.live) - Number(a.live) || b.followerCount - a.followerCount);
  },
});

// The Follow button on a drop screen: who hosts this drop. null for drops nobody hosts (e.g. aurora-demo).
export const streamerForDrop = query({
  args: { deviceToken: v.string(), dropId: v.string() },
  handler: async (ctx, { deviceToken, dropId }): Promise<StreamerCardView | null> => {
    const sd = await streamerDropOf(ctx, dropId);
    const streamer = sd ? await getStreamer(ctx, sd.streamerId) : null;
    if (!streamer) return null;
    const me = await resolveIdentity(ctx, deviceToken);
    return card(ctx, me, streamer, await hostedDropsOf(ctx, streamer._id), Date.now());
  },
});

// ---------- Follows and reminders ----------

async function requireStreamer(ctx: QueryCtx, streamerId: string) {
  const streamer = await getStreamer(ctx, streamerId);
  if (!streamer) fail('DROP_NOT_FOUND', 'No such streamer.');
  return streamer;
}

export const followStreamer = mutation({
  args: { deviceToken: v.string(), streamerId: v.string() },
  handler: async (ctx, { deviceToken, streamerId }): Promise<FollowResult> => {
    const streamer = await requireStreamer(ctx, streamerId);
    const me = await resolveIdentity(ctx, deviceToken);
    const mine = await ctx.db
      .query('follows')
      .withIndex('by_device', (q) => q.eq('deviceToken', me.deviceToken).eq('streamerId', streamer._id))
      .first();
    if (!mine) {
      await ctx.db.insert('follows', {
        deviceToken: me.deviceToken,
        streamerId: streamer._id,
        ...(me.whopUserId ? { whopUserId: me.whopUserId } : {}),
        createdAt: Date.now(),
      });
    } else if (me.whopUserId && mine.whopUserId !== me.whopUserId) {
      await ctx.db.patch(mine._id, { whopUserId: me.whopUserId });
    }
    return { following: true, followerCount: await followerCount(ctx, streamer._id) };
  },
});

export const unfollowStreamer = mutation({
  args: { deviceToken: v.string(), streamerId: v.string() },
  handler: async (ctx, { deviceToken, streamerId }): Promise<FollowResult> => {
    const streamer = await requireStreamer(ctx, streamerId);
    const me = await resolveIdentity(ctx, deviceToken);
    for (const row of await followRows(ctx, me, streamer._id)) await ctx.db.delete(row._id);
    return { following: false, followerCount: await followerCount(ctx, streamer._id) };
  },
});

export const remindMe = mutation({
  args: { deviceToken: v.string(), dropId: v.string() },
  handler: async (ctx, { deviceToken, dropId }) => {
    const [sd, drop] = await Promise.all([streamerDropOf(ctx, dropId), dropById(ctx, dropId)]);
    if (!drop) fail('DROP_NOT_FOUND', 'No drop with that id.');
    if (!sd || !isUpcoming({ sd, drop })) fail('WRONG_STATUS', 'Only an upcoming scheduled drop takes reminders.');
    const existing = await ctx.db
      .query('dropReminders')
      .withIndex('by_device', (q) => q.eq('deviceToken', deviceToken).eq('dropId', dropId))
      .first();
    if (!existing) await ctx.db.insert('dropReminders', { deviceToken, dropId, createdAt: Date.now() });
  },
});

export const cancelReminder = mutation({
  args: { deviceToken: v.string(), dropId: v.string() },
  handler: async (ctx, { deviceToken, dropId }) => {
    const rows = await ctx.db
      .query('dropReminders')
      .withIndex('by_device', (q) => q.eq('deviceToken', deviceToken).eq('dropId', dropId))
      .collect();
    for (const row of rows) await ctx.db.delete(row._id);
  },
});

// ---------- Showcase hygiene ----------

// The streamer this device hosts as, if any: lets scripts/demo/seed-streamers.mjs stay idempotent.
export const myStreamer = query({
  args: { deviceToken: v.string() },
  handler: async (ctx, { deviceToken }): Promise<string | null> => {
    const s = await ctx.db
      .query('streamers')
      .withIndex('by_host', (q) => q.eq('hostToken', deviceToken))
      .unique();
    return s && !isHiddenStreamer(s) ? s._id : null;
  },
});

// Flags load-test and QA hosts as hidden. Idempotent; reads also hide matching names that appear later.
export const hideTestHosts = internalMutation({
  args: {},
  handler: async (ctx) => {
    let hidden = 0;
    for (const s of await ctx.db.query('streamers').collect()) {
      if (s.hidden || !isTestLabel(s.name)) continue;
      await ctx.db.patch(s._id, { hidden: true });
      hidden++;
    }
    return { hidden };
  },
});

// Hides the named streamers (exact name, any case), e.g. rehearsal hosts. Idempotent; returns how many it newly hid.
export const hideStreamers = internalMutation({
  args: { names: v.array(v.string()) },
  handler: async (ctx, { names }) => {
    const wanted = new Set(names.map((n) => n.trim().toLowerCase()).filter(Boolean));
    let hidden = 0;
    for (const s of await ctx.db.query('streamers').collect()) {
      if (s.hidden || !wanted.has(s.name.trim().toLowerCase())) continue;
      await ctx.db.patch(s._id, { hidden: true });
      hidden++;
    }
    return { hidden };
  },
});

// Cron: ends test hosted drops older than STALE_DROP_MS, and real ones older than ABANDONED_DROP_MS that were dealt
// and have no squad still racing. A real drop that is waiting to be dealt is never touched. Idempotent: ended
// drops are skipped. "Live now" doesn't depend on this; reads already drop idle drops.
export const expireStaleDrops = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    let expired = 0;
    for (const status of ['scheduled', 'live'] as const) {
      const drops = await ctx.db
        .query('drops')
        .withIndex('by_status', (q) => q.eq('status', status))
        .take(500);
      for (const drop of drops) {
        if (!drop.hostToken) continue;
        const sd = await streamerDropOf(ctx, drop.dropId);
        if (!sd || now - sd.createdAt < STALE_DROP_MS) continue;
        const streamer = await ctx.db.get(sd.streamerId);
        const test = isTestLabel(drop.title) || (!!streamer && isHiddenStreamer(streamer));
        if (!test) {
          if (drop.status !== 'live' || now - sd.createdAt < ABANDONED_DROP_MS) continue;
          const rooms = await ctx.db
            .query('rooms')
            .withIndex('by_drop', (q) => q.eq('dropId', drop.dropId))
            .collect();
          if (rooms.some((r) => r.status === 'intro' || r.status === 'playing')) continue;
        }
        if (drop.startJobId) await ctx.scheduler.cancel(drop.startJobId);
        await ctx.db.patch(drop._id, { status: 'ended' });
        await ctx.db.patch(sd._id, { expiredAt: now });
        expired++;
      }
    }
    return { expired };
  },
});
