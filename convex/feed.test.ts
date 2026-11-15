/// <reference types="vite/client" />
import presenceTest from '@convex-dev/presence/test';
import rateLimiterTest from '@convex-dev/rate-limiter/test';
import { convexTest } from 'convex-test';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { api, internal } from './_generated/api';
import { STARTING_LEAD_MS } from './feed';
import { EXPO_RECEIPTS_URL, EXPO_SEND_URL, RECEIPT_DELAY_MS } from './push';
import schema from './schema';

const modules = import.meta.glob('./**/*.ts');
const MIN = 60_000;
const HOST = 'host-device';

function newTest() {
  const t = convexTest(schema, modules);
  presenceTest.register(t);
  rateLimiterTest.register(t);
  return t;
}
type T = ReturnType<typeof newTest>;

type Sent = { to: string; title: string; body: string; data: Record<string, string>; sound: string };
let sent: Sent[];
let receiptIds: string[][];
let ticketFor: (to: string) => { status: 'ok'; id: string } | { status: 'error'; details: { error: string } };
let receiptFor: (id: string) => { status: 'ok' } | { status: 'error'; details: { error: string } };

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-15T22:00:00Z'));
  sent = [];
  receiptIds = [];
  ticketFor = (to) => ({ status: 'ok', id: 'tkt-' + to });
  receiptFor = () => ({ status: 'ok' });
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      if (url === EXPO_SEND_URL) {
        sent.push(...(body as Sent[]));
        return Response.json({ data: (body as Sent[]).map((m) => ticketFor(m.to)) });
      }
      if (url === EXPO_RECEIPTS_URL) {
        receiptIds.push(body.ids);
        return Response.json({ data: Object.fromEntries((body.ids as string[]).map((id) => [id, receiptFor(id)])) });
      }
      return new Response('unexpected', { status: 404 });
    }),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

async function errorCode(p: Promise<unknown>) {
  try {
    await p;
  } catch (e) {
    return (e as { data?: { code?: string } }).data?.code;
  }
  throw new Error('expected the call to fail');
}

const pushToken = (device: string) => `ExponentPushToken[${device}]`;

async function withToken(t: T, device: string) {
  await t.mutation(api.push.registerPushToken, { deviceToken: device, token: pushToken(device), platform: 'ios' });
}

async function host(t: T, startsAt?: number) {
  const hosted = await t.mutation(api.drops.hostDrop, { deviceToken: HOST, creatorName: 'Nova', title: 'The Aurora Seed', ...(startsAt ? { startsAt } : {}) });
  const streamer = (await t.query(api.feed.streamerForDrop, { deviceToken: 'anyone', dropId: hosted.dropId }))!;
  return { ...hosted, streamerId: streamer.streamerId };
}

// A streamer to follow before they go live: one earlier drop, ended at once (no entrants).
async function streamerWithHistory(t: T) {
  const first = await host(t);
  await t.mutation(internal.drops.startNow, { dropId: first.dropId });
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  sent = [];
  return first.streamerId;
}

// Advance the server clock, run what came due, then the sends those runs queued for now.
async function flushAt(t: T, ms: number) {
  vi.advanceTimersByTime(ms);
  await t.finishInProgressScheduledFunctions();
  vi.advanceTimersByTime(0);
  await t.finishInProgressScheduledFunctions();
}

describe('follows', () => {
  test('following twice is one follow; unfollowing twice is a no-op', async () => {
    const t = newTest();
    const { streamerId } = await host(t);
    expect(await t.mutation(api.feed.followStreamer, { deviceToken: 'fan', streamerId })).toEqual({ following: true, followerCount: 1 });
    expect(await t.mutation(api.feed.followStreamer, { deviceToken: 'fan', streamerId })).toEqual({ following: true, followerCount: 1 });
    expect(await t.run((ctx) => ctx.db.query('follows').collect())).toHaveLength(1);
    expect(await t.mutation(api.feed.unfollowStreamer, { deviceToken: 'fan', streamerId })).toEqual({ following: false, followerCount: 0 });
    expect(await t.mutation(api.feed.unfollowStreamer, { deviceToken: 'fan', streamerId })).toEqual({ following: false, followerCount: 0 });
    expect((await t.query(api.feed.followingFeed, { deviceToken: 'fan' })).following).toEqual([]);
  });

  test("a follow carries over to every device on the same Whop account, and counts once", async () => {
    const t = newTest();
    const { streamerId } = await host(t);
    await t.run(async (ctx) => {
      for (const deviceToken of ['phone', 'tablet']) {
        await ctx.db.insert('identities', { deviceToken, whopUserId: 'user_1', name: 'Kit', environment: 'sandbox', linkedAt: Date.now() });
      }
    });
    await t.mutation(api.feed.followStreamer, { deviceToken: 'phone', streamerId });
    expect(await t.mutation(api.feed.followStreamer, { deviceToken: 'tablet', streamerId })).toEqual({ following: true, followerCount: 1 });
    const page = await t.query(api.feed.streamerPage, { deviceToken: 'tablet', streamerId });
    expect(page).toMatchObject({ following: true, followerCount: 1 });
    await t.mutation(api.feed.unfollowStreamer, { deviceToken: 'tablet', streamerId });
    expect(await t.query(api.feed.streamerPage, { deviceToken: 'phone', streamerId })).toMatchObject({ following: false, followerCount: 0 });
  });

  test('unknown streamers are refused', async () => {
    const t = newTest();
    expect(await errorCode(t.mutation(api.feed.followStreamer, { deviceToken: 'fan', streamerId: 'nope' }))).toBe('DROP_NOT_FOUND');
  });
});

describe('live status', () => {
  test('hostDrop opens it, the drop ending closes it', async () => {
    const t = newTest();
    const streamerId = await streamerWithHistory(t);
    await t.mutation(api.feed.followStreamer, { deviceToken: 'fan', streamerId });
    const { dropId, joinCode } = await host(t);
    const feed = await t.query(api.feed.followingFeed, { deviceToken: 'fan' });
    expect(feed.following).toMatchObject([{ streamerId, name: 'Nova', live: true, following: true }]);
    expect(feed.live).toMatchObject([{ dropId, joinCode, title: 'The Aurora Seed', dropStatus: 'scheduled', entrantCount: 0, liveSince: expect.any(Number) }]);
    expect(feed.results).toHaveLength(1);

    await t.mutation(internal.drops.startNow, { dropId });
    const after = await t.query(api.feed.followingFeed, { deviceToken: 'fan' });
    expect(after.live).toEqual([]);
    expect(after.following[0].live).toBe(false);
    expect(after.results.map((r) => r.dropId)).toContain(dropId);
  });

  test("hostDrop with no start time keeps today's behavior", async () => {
    const t = newTest();
    const { dropId } = await host(t);
    const drop = await t.query(api.drops.drop, { deviceToken: HOST, dropId });
    expect(drop).toMatchObject({ status: 'scheduled', hosted: true, startsAt: Date.now() + 24 * 60 * MIN });
    expect(await t.run((ctx) => ctx.db.system.query('_scheduled_functions').collect())).toHaveLength(0);
  });

  test('views never carry the host device token', async () => {
    const t = newTest();
    const { streamerId, dropId } = await host(t);
    await t.mutation(api.feed.followStreamer, { deviceToken: 'fan', streamerId });
    const views = await Promise.all([
      t.query(api.feed.followingFeed, { deviceToken: 'fan' }),
      t.query(api.feed.streamerPage, { deviceToken: 'fan', streamerId }),
      t.query(api.feed.streamers, { deviceToken: 'fan' }),
      t.query(api.feed.streamerForDrop, { deviceToken: 'fan', dropId }),
    ]);
    expect(JSON.stringify(views)).not.toContain(HOST);
  });
});

describe('scheduled drops and Remind me', () => {
  test('a start time lists the drop under Coming up, and reminders are idempotent', async () => {
    const t = newTest();
    const streamerId = await streamerWithHistory(t);
    await t.mutation(api.feed.followStreamer, { deviceToken: 'fan', streamerId });
    const startsAt = Date.now() + 30 * MIN;
    const later = await host(t, startsAt + 60 * MIN);
    const soon = await host(t, startsAt);
    await t.mutation(api.feed.remindMe, { deviceToken: 'fan', dropId: soon.dropId });
    await t.mutation(api.feed.remindMe, { deviceToken: 'fan', dropId: soon.dropId });
    expect(await t.run((ctx) => ctx.db.query('dropReminders').collect())).toHaveLength(1);
    const feed = await t.query(api.feed.followingFeed, { deviceToken: 'fan' });
    expect(feed.live).toEqual([]);
    expect(feed.upcoming.map((u) => [u.dropId, u.startsAt, u.reminded])).toEqual([
      [soon.dropId, startsAt, true],
      [later.dropId, startsAt + 60 * MIN, false],
    ]);
    expect((await t.query(api.feed.streamerPage, { deviceToken: 'fan', streamerId }))?.nextDrop?.dropId).toBe(soon.dropId);
    await t.mutation(api.feed.cancelReminder, { deviceToken: 'fan', dropId: soon.dropId });
    expect((await t.query(api.feed.followingFeed, { deviceToken: 'fan' })).upcoming[0].reminded).toBe(false);
  });

  test('start times under 2 minutes away are refused, and only upcoming drops take reminders', async () => {
    const t = newTest();
    expect(await errorCode(t.mutation(api.drops.hostDrop, { deviceToken: HOST, startsAt: Date.now() + MIN }))).toBe('WRONG_STATUS');
    const now = await host(t);
    expect(await errorCode(t.mutation(api.feed.remindMe, { deviceToken: 'fan', dropId: now.dropId }))).toBe('WRONG_STATUS');
  });

  test('the 2-minute ping fires on the server clock, then the drop goes live', async () => {
    const t = newTest();
    const streamerId = await streamerWithHistory(t);
    for (const d of ['reminded', 'waiting', 'follower']) await withToken(t, d);
    const startsAt = Date.now() + 10 * MIN;
    const { dropId, joinCode } = await host(t, startsAt);
    await t.mutation(api.feed.remindMe, { deviceToken: 'reminded', dropId });
    await t.mutation(api.drops.enterDrop, { deviceToken: 'waiting', dropId, name: 'Wai' });
    for (const d of ['reminded', 'follower']) await t.mutation(api.feed.followStreamer, { deviceToken: d, streamerId });

    await flushAt(t, startsAt - STARTING_LEAD_MS - Date.now() - 1000);
    expect(sent).toEqual([]);
    await flushAt(t, 1000);
    expect(sent.map((m) => m.to).sort()).toEqual([pushToken('reminded'), pushToken('waiting')]);
    expect(sent[0]).toMatchObject({
      title: "Nova's room opens in 2 minutes",
      body: 'Your squad is waiting.',
      data: { kind: 'starting', dropId, joinCode, streamerId },
      sound: 'default',
    });
    expect((await t.query(api.feed.followingFeed, { deviceToken: 'follower' })).live).toEqual([]);

    sent = [];
    await flushAt(t, STARTING_LEAD_MS);
    // The reminded follower already had their one push for this drop.
    expect(sent.map((m) => m.to)).toEqual([pushToken('follower')]);
    expect((await t.query(api.feed.followingFeed, { deviceToken: 'follower' })).live).toMatchObject([{ dropId, liveSince: startsAt }]);
  });
});

describe('push', () => {
  test('going live sends one Expo message per follower with a token, never to the host', async () => {
    const t = newTest();
    const streamerId = await streamerWithHistory(t);
    await t.run((ctx) => ctx.db.insert('identities', { deviceToken: 'fan', whopUserId: 'user_1', name: 'Kit', environment: 'sandbox', linkedAt: 0 }));
    await t.run((ctx) => ctx.db.insert('identities', { deviceToken: 'fan-ipad', whopUserId: 'user_1', name: 'Kit', environment: 'sandbox', linkedAt: 0 }));
    for (const d of ['fan', 'fan-ipad', HOST]) await withToken(t, d);
    for (const d of ['fan', 'fan-ipad', HOST, 'tokenless']) await t.mutation(api.feed.followStreamer, { deviceToken: d, streamerId });
    const { dropId, joinCode } = await host(t);
    await flushAt(t, 1);
    expect(sent.map((m) => m.to).sort()).toEqual([pushToken('fan'), pushToken('fan-ipad')].sort());
    expect(sent[0]).toEqual({
      to: sent[0].to,
      title: 'Nova is live · The Aurora Seed',
      body: `Join with ${joinCode}.`,
      data: { kind: 'live', dropId, joinCode, streamerId },
      sound: 'default',
    });
    const ledger = await t.run((ctx) => ctx.db.query('pushSends').collect());
    expect(ledger.map((r) => r.deviceToken).sort()).toEqual(['fan', 'fan-ipad']);
  });

  test('with no push tokens nothing is sent or scheduled', async () => {
    const t = newTest();
    const streamerId = await streamerWithHistory(t);
    await t.mutation(api.feed.followStreamer, { deviceToken: 'fan', streamerId });
    await host(t);
    expect(await t.run((ctx) => ctx.db.system.query('_scheduled_functions').collect())).toHaveLength(0);
    expect(fetch).not.toHaveBeenCalled();
  });

  test('tokens Expo reports as DeviceNotRegistered are dropped, from tickets and from receipts', async () => {
    const t = newTest();
    const streamerId = await streamerWithHistory(t);
    for (const d of ['gone-now', 'gone-later', 'fine']) {
      await withToken(t, d);
      await t.mutation(api.feed.followStreamer, { deviceToken: d, streamerId });
    }
    ticketFor = (to) => (to === pushToken('gone-now') ? { status: 'error', details: { error: 'DeviceNotRegistered' } } : { status: 'ok', id: 'tkt-' + to });
    receiptFor = (id) => (id === 'tkt-' + pushToken('gone-later') ? { status: 'error', details: { error: 'DeviceNotRegistered' } } : { status: 'ok' });
    await host(t);
    await flushAt(t, 1);
    const left = async () => (await t.run((ctx) => ctx.db.query('pushTokens').collect())).map((r) => r.deviceToken).sort();
    expect(await left()).toEqual(['fine', 'gone-later']);
    await flushAt(t, RECEIPT_DELAY_MS);
    expect(receiptIds.flat().sort()).toEqual([`tkt-${pushToken('fine')}`, `tkt-${pushToken('gone-later')}`]);
    expect(await left()).toEqual(['fine']);
  });

  test('register refreshes one token per device, moves a reused token, and remove clears it', async () => {
    const t = newTest();
    await t.mutation(api.push.registerPushToken, { deviceToken: 'a', token: pushToken('1'), platform: 'ios' });
    await t.mutation(api.push.registerPushToken, { deviceToken: 'a', token: pushToken('2'), platform: 'ios' });
    await t.mutation(api.push.registerPushToken, { deviceToken: 'b', token: pushToken('2'), platform: 'android' });
    expect((await t.run((ctx) => ctx.db.query('pushTokens').collect())).map((r) => [r.deviceToken, r.token])).toEqual([['b', pushToken('2')]]);
    await t.mutation(api.push.removePushToken, { deviceToken: 'b' });
    expect(await t.run((ctx) => ctx.db.query('pushTokens').collect())).toEqual([]);
    expect(await errorCode(t.mutation(api.push.registerPushToken, { deviceToken: 'a', token: 'nope', platform: 'ios' }))).toBe('WRONG_STATUS');
  });
});
