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

describe('squadmates on the 2-minute ping', () => {
  test("first names of the others already waiting, at most 3, never the device's own", async () => {
    const t = newTest();
    for (const d of ['lou', 'ana', 'kit', 'max', 'reminded']) await withToken(t, d);
    const startsAt = Date.now() + 10 * MIN;
    const { dropId } = await host(t, startsAt);
    await t.mutation(api.feed.remindMe, { deviceToken: 'reminded', dropId });
    const names = { lou: 'Lou Reed', ana: 'Demo · Ana', kit: 'Kit', max: 'Max' } as const;
    for (const [d, name] of Object.entries(names)) await t.mutation(api.drops.enterDrop, { deviceToken: d, dropId, name });
    await flushAt(t, startsAt - STARTING_LEAD_MS - Date.now());
    const to = (d: string) => sent.find((m) => m.to === pushToken(d))!.data;
    expect(to('lou').squadmates).toEqual(['Ana', 'Kit', 'Max']);
    expect(to('max').squadmates).toEqual(['Lou', 'Ana', 'Kit']);
    expect(to('reminded').squadmates).toEqual(['Lou', 'Ana', 'Kit']);
    expect(to('reminded')).toMatchObject({ kind: 'starting', dropId });
  });

  test('left out when nobody else is there yet, and never on the live push', async () => {
    const t = newTest();
    await withToken(t, 'solo');
    const startsAt = Date.now() + 10 * MIN;
    const { dropId, streamerId } = await host(t, startsAt);
    await t.mutation(api.feed.followStreamer, { deviceToken: 'solo', streamerId });
    await t.mutation(api.drops.enterDrop, { deviceToken: 'solo', dropId, name: 'Solo' });
    await flushAt(t, startsAt - STARTING_LEAD_MS - Date.now());
    expect(sent).toHaveLength(1);
    expect(sent[0].data).toEqual({ kind: 'starting', dropId, joinCode: expect.any(String), streamerId });
  });
});

describe('squadmates on Coming up rows', () => {
  test('a device that entered or tapped Remind me sees who is waiting; other followers do not', async () => {
    const t = newTest();
    const startsAt = Date.now() + 30 * MIN;
    const { dropId, streamerId } = await host(t, startsAt);
    for (const d of ['lou', 'ana', 'fan', 'reminded']) await t.mutation(api.feed.followStreamer, { deviceToken: d, streamerId });
    await t.mutation(api.feed.remindMe, { deviceToken: 'reminded', dropId });
    await t.mutation(api.drops.enterDrop, { deviceToken: 'lou', dropId, name: 'Lou Reed' });
    const row = async (d: string) => (await t.query(api.feed.followingFeed, { deviceToken: d })).upcoming[0];
    expect((await row('lou')).squadmates).toBeUndefined();
    await t.mutation(api.drops.enterDrop, { deviceToken: 'ana', dropId, name: 'Demo · Ana' });
    expect((await row('lou')).squadmates).toEqual(['Ana']);
    expect((await row('ana')).squadmates).toEqual(['Lou']);
    expect((await row('reminded')).squadmates).toEqual(['Lou', 'Ana']);
    expect((await row('fan')).squadmates).toBeUndefined();
    expect((await t.query(api.feed.streamerPage, { deviceToken: 'reminded', streamerId }))!.nextDrop!.squadmates).toEqual(['Lou', 'Ana']);
  });
});

describe('renameStreamer', () => {
  test('renames a streamer in place and is idempotent', async () => {
    const t = newTest();
    const { streamerId } = await t.mutation(api.drops.hostDrop, { deviceToken: 'theo', creatorName: 'Theo Marsh' }).then(async (d) => (await t.query(api.feed.streamerForDrop, { deviceToken: 'x', dropId: d.dropId }))!);
    for (let i = 0; i < 2; i++) expect(await t.mutation(internal.feed.renameStreamer, { streamerId, name: ' Milo Grant ' })).toEqual({ streamerId, name: 'Milo Grant' });
    expect(await t.query(api.feed.streamerPage, { deviceToken: 'x', streamerId })).toMatchObject({ streamerId, name: 'Milo Grant' });
    expect(await t.run((ctx) => ctx.db.query('streamers').collect())).toHaveLength(1);
    expect(await errorCode(t.mutation(internal.feed.renameStreamer, { streamerId: 'nope', name: 'X' }))).toBe('DROP_NOT_FOUND');
  });
});

describe('retitleDrop', () => {
  test('renames a hosted drop and is idempotent', async () => {
    const t = newTest();
    const { dropId, streamerId } = await host(t, Date.now() + 30 * MIN);
    for (let i = 0; i < 2; i++) expect(await t.mutation(internal.feed.retitleDrop, { dropId, title: ' Case 02 · The Glass Orchard ' })).toEqual({ dropId, title: 'Case 02 · The Glass Orchard' });
    expect((await t.query(api.feed.streamerPage, { deviceToken: 'x', streamerId }))!.nextDrop!.title).toBe('Case 02 · The Glass Orchard');
    expect(await errorCode(t.mutation(internal.feed.retitleDrop, { dropId: 'nope', title: 'X' }))).toBe('DROP_NOT_FOUND');
  });
});

describe('showcase hygiene', () => {
  async function hostAs(t: T, deviceToken: string, creatorName: string, title = 'The Aurora Seed', startsAt?: number) {
    const hosted = await t.mutation(api.drops.hostDrop, { deviceToken, creatorName, title, ...(startsAt ? { startsAt } : {}) });
    const sd = await t.run((ctx) => ctx.db.query('streamerDrops').withIndex('by_drop', (q) => q.eq('dropId', hosted.dropId)).unique());
    return { ...hosted, streamerId: sd!.streamerId as string };
  }

  test('test hosts are left out of every list and page, and hideTestHosts flags them once', async () => {
    const t = newTest();
    const nova = await hostAs(t, HOST, 'Nova');
    const tests: Awaited<ReturnType<typeof hostAs>>[] = [];
    for (const [i, name] of ['load · 12', 'Load runner', 'QA bot', 'CMHM-10 host', 'Ivy (ignore)'].entries()) tests.push(await hostAs(t, 'test-' + i, name));
    const flagged = await hostAs(t, 'flagged', 'Rio');
    await t.run((ctx) => ctx.db.patch(flagged.streamerId as never, { hidden: true }));
    await t.run(async (ctx) => {
      for (const s of [...tests, flagged, nova]) await ctx.db.insert('follows', { deviceToken: 'fan', streamerId: s.streamerId as never, createdAt: 0 });
    });

    expect((await t.query(api.feed.streamers, { deviceToken: 'fan' })).map((s) => s.name)).toEqual(['Nova']);
    const feed = await t.query(api.feed.followingFeed, { deviceToken: 'fan' });
    expect(feed.following.map((s) => s.name)).toEqual(['Nova']);
    expect(feed.live.map((l) => l.streamerName)).toEqual(['Nova']);
    for (const s of [...tests, flagged]) {
      expect(await t.query(api.feed.streamerPage, { deviceToken: 'fan', streamerId: s.streamerId })).toBeNull();
      expect(await t.query(api.feed.streamerForDrop, { deviceToken: 'fan', dropId: s.dropId })).toBeNull();
    }
    expect(await t.query(api.feed.myStreamer, { deviceToken: 'test-0' })).toBeNull();
    expect(await t.query(api.feed.myStreamer, { deviceToken: HOST })).toBe(nova.streamerId);

    expect(await t.mutation(internal.feed.hideTestHosts, {})).toEqual({ hidden: 5 });
    expect(await t.mutation(internal.feed.hideTestHosts, {})).toEqual({ hidden: 0 });
    const hidden = await t.run((ctx) => ctx.db.query('streamers').collect());
    expect(hidden.filter((s) => s.hidden).map((s) => s.name).sort()).toEqual(['CMHM-10 host', 'Ivy (ignore)', 'Load runner', 'QA bot', 'Rio', 'load · 12']);
  });

  test('the default host name "Host" is hidden at read time, "Hosta" is not', async () => {
    const t = newTest();
    const unnamed = await t.mutation(api.drops.hostDrop, { deviceToken: 'unnamed' });
    const hosta = await hostAs(t, 'hosta', 'Hosta');
    await hostAs(t, 'shouty', 'HOST');
    expect((await t.query(api.feed.streamers, { deviceToken: 'fan' })).map((s) => s.name)).toEqual(['Hosta']);
    expect(await t.query(api.feed.streamerForDrop, { deviceToken: 'fan', dropId: unnamed.dropId })).toBeNull();
    expect(await t.query(api.feed.streamerForDrop, { deviceToken: 'fan', dropId: hosta.dropId })).toMatchObject({ name: 'Hosta' });
    expect(await t.mutation(internal.feed.hideTestHosts, {})).toEqual({ hidden: 0 });
  });

  test('hideStreamers hides exact names, ignoring case, once', async () => {
    const t = newTest();
    for (const [d, name] of [['h1', 'Host'], ['h2', 'kit'], ['h3', 'Kitty'], ['h4', 'Nova']]) await hostAs(t, d, name);
    expect(await t.mutation(internal.feed.hideStreamers, { names: ['HOST', ' Kit ', 'nobody'] })).toEqual({ hidden: 2 });
    expect(await t.mutation(internal.feed.hideStreamers, { names: ['host', 'kit'] })).toEqual({ hidden: 0 });
    expect((await t.query(api.feed.streamers, { deviceToken: 'fan' })).map((s) => s.name).sort()).toEqual(['Kitty', 'Nova']);
  });

  test('drops titled like tests stay out of live and past lists', async () => {
    const t = newTest();
    const ignored = await hostAs(t, HOST, 'Nova', 'Warmup (ignore)');
    await t.mutation(internal.drops.startNow, { dropId: ignored.dropId });
    await hostAs(t, HOST, 'Nova', 'load · soak');
    const page = (await t.query(api.feed.streamerPage, { deviceToken: 'fan', streamerId: ignored.streamerId }))!;
    expect(page).toMatchObject({ live: false, liveDrop: null, past: [] });
  });

  test('follower counts are real, and hidden under 3', async () => {
    const t = newTest();
    const { streamerId } = await hostAs(t, HOST, 'Nova');
    const show = async () => (await t.query(api.feed.streamerPage, { deviceToken: 'x', streamerId }))!;
    expect(await show()).toMatchObject({ followerCount: 0, showFollowerCount: false });
    for (const d of ['a', 'b', 'c']) await t.mutation(api.feed.followStreamer, { deviceToken: d, streamerId });
    expect(await show()).toMatchObject({ followerCount: 3, showFollowerCount: true });
  });

  test('avatars are https only', async () => {
    const t = newTest();
    const a = await t.mutation(api.drops.hostDrop, { deviceToken: 'a', creatorName: 'Ana', avatarUrl: 'javascript:alert(1)' });
    const b = await t.mutation(api.drops.hostDrop, { deviceToken: 'b', creatorName: 'Bo', avatarUrl: 'https://example.com/bo.png' });
    expect((await t.query(api.feed.streamerForDrop, { deviceToken: 'x', dropId: a.dropId }))!.avatarUrl).toBeUndefined();
    expect((await t.query(api.feed.streamerForDrop, { deviceToken: 'x', dropId: b.dropId }))!.avatarUrl).toBe('https://example.com/bo.png');
  });

  test('one streamer per name in discovery and the feed; the seeded streamer wins over newer ad-hoc hosts', async () => {
    const t = newTest();
    const seeded = await hostAs(t, 'seed-host-nova', 'Nova');
    vi.advanceTimersByTime(MIN);
    const adHoc = [await hostAs(t, 'rehearsal-1', ' nova '), await hostAs(t, 'rehearsal-2', 'NOVA')];
    const kai = [await hostAs(t, 'kai-1', 'Kai'), await hostAs(t, 'kai-2', 'Kai')];
    await t.run(async (ctx) => {
      for (const s of [seeded, ...adHoc]) await ctx.db.insert('follows', { deviceToken: 'fan', streamerId: s.streamerId as never, createdAt: 0 });
    });

    const cards = await t.query(api.feed.streamers, { deviceToken: 'fan' });
    expect(cards.map((c) => [c.name, c.streamerId]).sort()).toEqual([
      ['Kai', kai[1].streamerId],
      ['Nova', seeded.streamerId],
    ]);
    const feed = await t.query(api.feed.followingFeed, { deviceToken: 'fan' });
    expect(feed.following.map((s) => s.streamerId)).toEqual([seeded.streamerId]);
    expect(feed.live.map((l) => l.dropId)).toEqual([seeded.dropId]);
  });

  test('rehearsal and QA host names stay out of discovery and the feed; real names that only contain the words do not', async () => {
    const t = newTest();
    const junk: Awaited<ReturnType<typeof hostAs>>[] = [];
    for (const [i, name] of ['Capy QA', 'Capy Host', 'PP Host', 'Rehearsal Nova', 'test host', 'qa'].entries()) junk.push(await hostAs(t, 'junk-' + i, name));
    const real: Awaited<ReturnType<typeof hostAs>>[] = [];
    for (const [i, name] of ['Mihajlo Micic', 'Qadir', 'Testa', 'Capybara Club'].entries()) real.push(await hostAs(t, 'real-' + i, name));
    await t.run(async (ctx) => {
      for (const s of [...junk, ...real]) await ctx.db.insert('follows', { deviceToken: 'fan', streamerId: s.streamerId as never, createdAt: 0 });
    });

    const realNames = ['Capybara Club', 'Mihajlo Micic', 'Qadir', 'Testa'];
    expect((await t.query(api.feed.streamers, { deviceToken: 'fan' })).map((s) => s.name).sort()).toEqual(realNames);
    const feed = await t.query(api.feed.followingFeed, { deviceToken: 'fan' });
    expect(feed.following.map((s) => s.name).sort()).toEqual(realNames);
    expect(feed.live.map((l) => l.streamerName).sort()).toEqual(realNames);
    expect(await t.query(api.feed.streamerForDrop, { deviceToken: 'fan', dropId: junk[1].dropId })).toMatchObject({ name: 'Capy Host' });
    expect(await t.mutation(internal.feed.hideTestHosts, {})).toEqual({ hidden: 1 });
  });

  test('hostDrop with rehearsal: true plays as usual but stays out of discovery and the feed', async () => {
    const t = newTest();
    const rehearsal = await t.mutation(api.drops.hostDrop, { deviceToken: 'mira', creatorName: 'Mira', rehearsal: true });
    await t.mutation(api.drops.enterDrop, { deviceToken: 'p1', dropId: rehearsal.dropId, name: 'Pat' });
    expect(await t.query(api.feed.streamers, { deviceToken: 'fan' })).toEqual([]);
    const mira = await t.query(api.feed.streamerForDrop, { deviceToken: 'fan', dropId: rehearsal.dropId });
    expect(mira).toMatchObject({ name: 'Mira', live: false });
    await t.mutation(api.feed.followStreamer, { deviceToken: 'fan', streamerId: mira!.streamerId });
    expect(await t.query(api.feed.followingFeed, { deviceToken: 'fan' })).toMatchObject({ following: [], live: [], upcoming: [], results: [] });

    const real = await t.mutation(api.drops.hostDrop, { deviceToken: 'mira', creatorName: 'Mira' });
    expect(await t.query(api.feed.streamers, { deviceToken: 'fan' })).toMatchObject([{ name: 'Mira', live: true }]);
    expect((await t.query(api.feed.followingFeed, { deviceToken: 'fan' })).live.map((l) => l.dropId)).toEqual([real.dropId]);
  });
});

describe('live status at read time', () => {
  test('an open drop goes idle after 20 minutes with no entry, and an entry keeps it live', async () => {
    const t = newTest();
    const { dropId, streamerId } = await host(t);
    const live = async () => (await t.query(api.feed.streamerPage, { deviceToken: 'fan', streamerId }))!;
    vi.advanceTimersByTime(19 * MIN);
    expect(await live()).toMatchObject({ live: true, liveDrop: { dropId } });
    vi.advanceTimersByTime(2 * MIN);
    expect(await live()).toMatchObject({ live: false, liveDrop: null });
    expect((await t.query(api.feed.streamers, { deviceToken: 'fan' }))[0].live).toBe(false);
    await t.mutation(api.drops.enterDrop, { deviceToken: 'late', dropId, name: 'Late' });
    expect(await live()).toMatchObject({ live: true });
    vi.advanceTimersByTime(19 * MIN);
    expect(await live()).toMatchObject({ live: true });
    vi.advanceTimersByTime(2 * MIN);
    expect(await live()).toMatchObject({ live: false });
  });

  test('a racing drop counts lock-ins as activity, and ending it clears live at once', async () => {
    const t = newTest();
    const { dropId, streamerId } = await host(t);
    for (const [i, n] of ['Ana', 'Bo', 'Cy', 'Di'].entries()) await t.mutation(api.drops.enterDrop, { deviceToken: 'p' + i, dropId, name: n });
    await t.mutation(api.drops.dealSquads, { deviceToken: HOST, dropId });
    const live = async () => (await t.query(api.feed.streamerPage, { deviceToken: 'fan', streamerId }))!.live;
    expect(await live()).toBe(true);
    vi.advanceTimersByTime(15 * MIN);
    const room = (await t.run((ctx) => ctx.db.query('rooms').withIndex('by_drop', (q) => q.eq('dropId', dropId)).first()))!;
    const member = (await t.run((ctx) => ctx.db.query('members').withIndex('by_room', (q) => q.eq('roomId', room._id)).first()))!;
    await t.run((ctx) => ctx.db.insert('lockIns', { roomId: room._id, memberId: member._id, revision: 1 }));
    vi.advanceTimersByTime(15 * MIN);
    expect(await live()).toBe(true);
    await t.run(async (ctx) => {
      const drop = (await ctx.db.query('drops').withIndex('by_dropId', (q) => q.eq('dropId', dropId)).unique())!;
      await ctx.db.patch(drop._id, { status: 'ended' });
    });
    expect(await live()).toBe(false);
  });
});

describe('expireStaleDrops', () => {
  const HOUR = 60 * MIN;
  const status = async (t: T, dropId: string) => (await t.query(api.drops.drop, { deviceToken: 'x', dropId }))?.status;
  async function dealt(t: T, deviceToken: string, creatorName: string) {
    const d = await t.mutation(api.drops.hostDrop, { deviceToken, creatorName });
    for (const [i, n] of ['Ana', 'Bo', 'Cy', 'Di'].entries()) await t.mutation(api.drops.enterDrop, { deviceToken: deviceToken + '-p' + i, dropId: d.dropId, name: n });
    await t.mutation(api.drops.dealSquads, { deviceToken, dropId: d.dropId });
    return d;
  }

  test('ends test drops after 2 hours and runs idempotently; expired drops stay out of past lists', async () => {
    const t = newTest();
    const loadTest = await t.mutation(api.drops.hostDrop, { deviceToken: 'load-host', creatorName: 'load · 3' });
    const ignored = await host(t);
    await t.run(async (ctx) => {
      const drop = (await ctx.db.query('drops').withIndex('by_dropId', (q) => q.eq('dropId', ignored.dropId)).unique())!;
      await ctx.db.patch(drop._id, { title: 'Soak (ignore)' });
    });
    const racingTest = await dealt(t, 'qa-host', 'QA bot');
    vi.advanceTimersByTime(2 * HOUR - MIN);
    expect(await t.mutation(internal.feed.expireStaleDrops, {})).toEqual({ expired: 0 });
    vi.advanceTimersByTime(2 * MIN);
    expect(await t.mutation(internal.feed.expireStaleDrops, {})).toEqual({ expired: 3 });
    expect(await t.mutation(internal.feed.expireStaleDrops, {})).toEqual({ expired: 0 });
    for (const d of [loadTest, ignored, racingTest]) expect(await status(t, d.dropId)).toBe('ended');
    expect((await t.run((ctx) => ctx.db.query('streamerDrops').collect())).filter((sd) => sd.expiredAt).length).toBe(3);
  });

  test('a real waiting room older than 2 hours with no new joins survives, even past 12 hours', async () => {
    const t = newTest();
    const waiting = await host(t);
    await t.mutation(api.drops.enterDrop, { deviceToken: 'fan', dropId: waiting.dropId, name: 'Fan' });
    const upcoming = await host(t, Date.now() + 3 * 24 * HOUR);
    vi.advanceTimersByTime(3 * HOUR);
    expect(await t.mutation(internal.feed.expireStaleDrops, {})).toEqual({ expired: 0 });
    vi.advanceTimersByTime(10 * HOUR);
    expect(await t.mutation(internal.feed.expireStaleDrops, {})).toEqual({ expired: 0 });
    expect(await status(t, waiting.dropId)).toBe('scheduled');
    expect(await status(t, upcoming.dropId)).toBe('scheduled');
  });

  test("an unnamed or flagged host's racing drop is not a test drop: it survives the cron at 3 hours", async () => {
    const t = newTest();
    const unnamed = await dealt(t, 'unnamed-host', '');
    const flagged = await dealt(t, 'flagged-host', 'Rio');
    await t.mutation(internal.feed.hideStreamers, { names: ['Rio'] });
    const names = (await t.run((ctx) => ctx.db.query('streamers').collect())).map((s) => s.name).sort();
    expect(names).toEqual(['Host', 'Rio']);
    vi.advanceTimersByTime(3 * HOUR);
    expect(await t.mutation(internal.feed.expireStaleDrops, {})).toEqual({ expired: 0 });
    expect(await status(t, unnamed.dropId)).toBe('live');
    expect(await status(t, flagged.dropId)).toBe('live');
  });

  test('a real racing drop with a quiet squad survives; once no squad is racing, it ends after 12 hours', async () => {
    const t = newTest();
    const racing = await dealt(t, HOST, 'Nova');
    vi.advanceTimersByTime(3 * HOUR);
    expect(await t.mutation(internal.feed.expireStaleDrops, {})).toEqual({ expired: 0 });
    vi.advanceTimersByTime(10 * HOUR);
    expect(await t.mutation(internal.feed.expireStaleDrops, {})).toEqual({ expired: 0 });
    expect(await status(t, racing.dropId)).toBe('live');
    await t.run(async (ctx) => {
      for (const r of await ctx.db.query('rooms').withIndex('by_drop', (q) => q.eq('dropId', racing.dropId)).collect()) await ctx.db.patch(r._id, { status: 'resolved' });
    });
    expect(await t.mutation(internal.feed.expireStaleDrops, {})).toEqual({ expired: 1 });
    expect(await status(t, racing.dropId)).toBe('ended');
  });
});
