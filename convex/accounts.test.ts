/// <reference types="vite/client" />
import presenceTest from '@convex-dev/presence/test';
import rateLimiterTest from '@convex-dev/rate-limiter/test';
import { convexTest } from 'convex-test';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { api } from './_generated/api';
import { DEFAULT_CONFIG } from './challenges';
import schema from './schema';

const modules = import.meta.glob('./**/*.ts');

function newTest() {
  const t = convexTest(schema, modules);
  presenceTest.register(t);
  rateLimiterTest.register(t);
  return t;
}
type T = ReturnType<typeof newTest>;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-16T01:00:00Z'));
  vi.stubEnv('WHOP_OAUTH_CLIENT_ID', 'app_test');
  vi.stubEnv('CONVEX_SITE_URL', 'https://example.convex.site');
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

const signIn = (t: T, deviceToken: string, whopUserId: string) =>
  t.run(async (ctx) => {
    await ctx.db.insert('identities', { deviceToken, whopUserId, name: 'Marcus', environment: 'sandbox', linkedAt: Date.now() });
  });

// Device A, before it ever signs in: follows a streamer, sets a reminder, makes a creator profile and a challenge,
// and hosts a drop. None of these rows carry a Whop id.
async function deviceAHistory(t: T) {
  const { dropId: streamerDrop } = await t.mutation(api.drops.hostDrop, { deviceToken: 'jess-phone', creatorName: 'Jess' });
  const streamerId = (await t.query(api.feed.streamerForDrop, { deviceToken: 'A', dropId: streamerDrop }))!.streamerId;
  await t.mutation(api.feed.followStreamer, { deviceToken: 'A', streamerId });
  await t.mutation(api.challenges.saveCreatorProfile, { deviceToken: 'A', displayName: 'Marcus', handle: 'marcus' });
  const { challengeId } = await t.mutation(api.challenges.createChallenge, { deviceToken: 'A' });
  const remindId = await t.run(async (ctx) => {
    const id = await ctx.db.insert('challenges', {
      creatorToken: 'jess-phone',
      config: { ...DEFAULT_CONFIG, title: 'Friday quiz' },
      status: 'published',
      serverCreated: false,
      createdAt: Date.now(),
      finishedCount: 0,
    });
    await ctx.db.insert('challengeReminders', { deviceToken: 'A', challengeId: id, createdAt: Date.now() });
    return id;
  });
  const { dropId } = await t.mutation(api.drops.hostDrop, { deviceToken: 'A', creatorName: 'Marcus', winnerSlots: 1 });
  return { streamerId, challengeId, remindId, dropId };
}

async function sees(t: T, deviceToken: string) {
  const feed = await t.query(api.feed.followingFeed, { deviceToken });
  return {
    following: feed.following.map((s) => s.name),
    challenges: (await t.query(api.challenges.myChallenges, { deviceToken })).map((c) => c.challengeId),
    reminders: (await t.query(api.discovery.upcomingReminders, { deviceToken })).map((r) => r.challengeId as string),
    hosted: (await t.query(api.drops.myHostedDrops, { deviceToken })).map((d) => d.dropId),
    profile: (await t.query(api.challenges.creatorProfile, { deviceToken }))?.handle ?? null,
  };
}

describe('Whop accounts across devices', () => {
  test('account sign-in is open to any device and the account view carries displayName', async () => {
    const t = newTest();
    const { url, reason } = await t.action(api.whopAuth.startSignIn, { deviceToken: 'fresh-device', purpose: 'account', returnUrl: 'cmhmaxwin://profile' });
    expect(reason).toBeNull();
    expect(url).toMatch(/\/oauth\/authorize\?/);
    await signIn(t, 'fresh-device', 'user_marcus');
    expect((await t.query(api.whopAuth.account, { deviceToken: 'fresh-device' })).account).toMatchObject({
      whopUserId: 'user_marcus',
      name: 'Marcus',
      displayName: 'Marcus',
    });
  });

  test("device B signed in to A's account sees A's follows, reminders, challenges, hosted drops and profile, and hosts A's drop", async () => {
    const t = newTest();
    const a = await deviceAHistory(t);
    expect(await sees(t, 'B')).toEqual({ following: [], challenges: [], reminders: [], hosted: [], profile: null });
    await signIn(t, 'A', 'user_marcus');
    await signIn(t, 'B', 'user_marcus');
    expect(await sees(t, 'B')).toEqual({
      following: ['Jess'],
      challenges: [a.challengeId],
      reminders: [a.remindId],
      hosted: [a.dropId],
      profile: '@marcus',
    });
    expect((await t.query(api.feed.streamers, { deviceToken: 'B' })).find((s) => s.streamerId === a.streamerId)?.following).toBe(true);
    expect(await t.query(api.drops.hostView, { deviceToken: 'B', dropId: a.dropId })).not.toBeNull();
    expect(await sees(t, 'A')).toEqual(await sees(t, 'B'));
  });

  test('a different Whop account, or B after signing out, sees only its own', async () => {
    const t = newTest();
    const a = await deviceAHistory(t);
    await signIn(t, 'A', 'user_marcus');
    await signIn(t, 'B', 'user_marcus');
    await signIn(t, 'C', 'user_kayla');
    const { dropId: bDrop } = await t.mutation(api.drops.hostDrop, { deviceToken: 'B', creatorName: 'Marcus', winnerSlots: 1 });
    expect(await sees(t, 'C')).toEqual({ following: [], challenges: [], reminders: [], hosted: [], profile: null });
    expect(await t.query(api.drops.hostView, { deviceToken: 'C', dropId: a.dropId })).toBeNull();
    await t.mutation(api.whopAuth.signOut, { deviceToken: 'B' });
    expect(await sees(t, 'B')).toEqual({ following: [], challenges: [], reminders: [], hosted: [], profile: null });
    expect(await t.query(api.drops.hostView, { deviceToken: 'B', dropId: a.dropId })).toBeNull();
    expect(await t.query(api.drops.hostView, { deviceToken: 'B', dropId: bDrop })).not.toBeNull();
    expect((await sees(t, 'A')).hosted).toEqual([bDrop, a.dropId]);
  });

  test('unfollowing from B removes the follow A made before signing in', async () => {
    const t = newTest();
    const a = await deviceAHistory(t);
    await signIn(t, 'A', 'user_marcus');
    await signIn(t, 'B', 'user_marcus');
    await t.mutation(api.feed.unfollowStreamer, { deviceToken: 'B', streamerId: a.streamerId });
    expect((await sees(t, 'A')).following).toEqual([]);
  });
});
