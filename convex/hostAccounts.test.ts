/// <reference types="vite/client" />
import presenceTest from '@convex-dev/presence/test';
import rateLimiterTest from '@convex-dev/rate-limiter/test';
import { convexTest } from 'convex-test';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { api } from './_generated/api';
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
  vi.setSystemTime(new Date('2026-11-15T20:00:00Z'));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function errorCode(p: Promise<unknown>) {
  try {
    await p;
  } catch (e) {
    return (e as { data?: { code?: string } }).data?.code;
  }
  throw new Error('expected the call to fail');
}

async function signIn(t: T, deviceToken: string, whopUserId: string) {
  await t.run(async (ctx) => {
    await ctx.db.insert('identities', { deviceToken, whopUserId, name: whopUserId, environment: 'sandbox', linkedAt: Date.now() });
  });
}

const hostWhopUserIds = (t: T) => t.run(async (ctx) => (await ctx.db.query('drops').collect()).map((d) => d.hostWhopUserId ?? null));

async function hostWith(t: T, deviceToken: string, players: number, args: { title?: string; startsAt?: number; template?: 'split-passphrase' } = {}) {
  const hosted = await t.mutation(api.drops.hostDrop, { deviceToken, winnerSlots: 1, ...args });
  for (let i = 1; i <= players; i++) {
    await t.mutation(api.drops.enterDropByCode, { deviceToken: hosted.dropId + '-p' + i, code: hosted.joinCode, name: 'p' + i });
  }
  return hosted;
}

describe('host accounts', () => {
  test('a second device signed in as the host Whop user views and deals the drop', async () => {
    const t = newTest();
    await signIn(t, 'phone', 'user_razeen');
    await signIn(t, 'laptop', 'user_razeen');
    const { dropId } = await hostWith(t, 'phone', 4);
    expect(await hostWhopUserIds(t)).toEqual(['user_razeen']);
    expect(await t.query(api.drops.hostView, { deviceToken: 'laptop', dropId })).toMatchObject({ dropId, entrantCount: 4, status: 'scheduled' });
    await t.mutation(api.drops.dealSquads, { deviceToken: 'laptop', dropId });
    expect((await t.query(api.drops.hostView, { deviceToken: 'phone', dropId }))?.status).toBe('live');
    expect((await t.query(api.drops.hostView, { deviceToken: 'laptop', dropId }))?.squads).toHaveLength(2);
  });

  test('a passphrase drop is dealt from the second device too', async () => {
    const t = newTest();
    await signIn(t, 'phone', 'user_razeen');
    await signIn(t, 'laptop', 'user_razeen');
    const { dropId } = await hostWith(t, 'phone', 4, { template: 'split-passphrase' });
    await t.mutation(api.drops.dealSquads, { deviceToken: 'laptop', dropId });
    const code = (await t.query(api.drops.drop, { deviceToken: dropId + '-p1', dropId }))?.me.squad?.code;
    expect(await t.query(api.passphrase.piece, { deviceToken: dropId + '-p1', code: code! })).not.toBeNull();
  });

  test('an unsigned or different-Whop device gets NOT_HOST and no host view', async () => {
    const t = newTest();
    await signIn(t, 'phone', 'user_razeen');
    await signIn(t, 'intruder', 'user_other');
    const { dropId } = await hostWith(t, 'phone', 4);
    for (const deviceToken of ['intruder', 'stranger', '']) {
      expect(await t.query(api.drops.hostView, { deviceToken, dropId })).toBeNull();
      expect(await errorCode(t.mutation(api.drops.dealSquads, { deviceToken, dropId }))).toBe('NOT_HOST');
    }
  });

  test('signing out takes host access away from that device only', async () => {
    const t = newTest();
    await signIn(t, 'phone', 'user_razeen');
    await signIn(t, 'laptop', 'user_razeen');
    const { dropId } = await hostWith(t, 'phone', 4);
    await t.mutation(api.whopAuth.signOut, { deviceToken: 'laptop' });
    expect(await t.query(api.drops.hostView, { deviceToken: 'laptop', dropId })).toBeNull();
    expect(await errorCode(t.mutation(api.drops.dealSquads, { deviceToken: 'laptop', dropId }))).toBe('NOT_HOST');
    await t.mutation(api.drops.dealSquads, { deviceToken: 'phone', dropId });
  });

  test('a token-only host behaves exactly as before', async () => {
    const t = newTest();
    await signIn(t, 'laptop', 'user_razeen');
    const { dropId } = await hostWith(t, 'host', 4);
    expect(await hostWhopUserIds(t)).toEqual([null]);
    expect(await t.query(api.drops.hostView, { deviceToken: 'laptop', dropId })).toBeNull();
    expect(await errorCode(t.mutation(api.drops.dealSquads, { deviceToken: 'laptop', dropId }))).toBe('NOT_HOST');
    expect(await t.query(api.drops.myHostedDrops, { deviceToken: 'laptop' })).toEqual([]);
    await t.mutation(api.drops.dealSquads, { deviceToken: 'host', dropId });
    expect((await t.query(api.drops.hostView, { deviceToken: 'host', dropId }))?.status).toBe('live');
  });

  test("myHostedDrops lists only this account's drops from the last 24 hours, newest first", async () => {
    const t = newTest();
    await signIn(t, 'phone', 'user_razeen');
    await signIn(t, 'laptop', 'user_razeen');
    await signIn(t, 'rival', 'user_other');
    expect(await t.query(api.drops.myHostedDrops, { deviceToken: 'stranger' })).toEqual([]);
    await hostWith(t, 'phone', 0, { title: 'Old drop' });
    vi.advanceTimersByTime(25 * 60 * 60 * 1000);
    await hostWith(t, 'rival', 0, { title: 'Not mine' });
    await hostWith(t, 'host-token-only', 0, { title: 'Unsigned' });
    const first = await hostWith(t, 'phone', 4, { title: 'Case drop' });
    await t.mutation(api.drops.dealSquads, { deviceToken: 'phone', dropId: first.dropId });
    vi.advanceTimersByTime(60_000);
    const startsAt = Date.now() + 60 * 60 * 1000;
    const second = await hostWith(t, 'laptop', 2, { title: 'Passphrase drop', startsAt, template: 'split-passphrase' });
    const rows = await t.query(api.drops.myHostedDrops, { deviceToken: 'phone' });
    expect(rows).toEqual([
      {
        dropId: second.dropId,
        code: second.joinCode,
        title: 'Passphrase drop',
        template: 'split-passphrase',
        status: 'lobby',
        players: 2,
        createdAt: expect.any(Number),
        scheduledFor: startsAt,
      },
      {
        dropId: first.dropId,
        code: first.joinCode,
        title: 'Case drop',
        template: 'case01',
        status: 'live',
        players: 4,
        createdAt: expect.any(Number),
        scheduledFor: null,
      },
    ]);
    expect(rows[0].createdAt).toBeGreaterThan(rows[1].createdAt);
    expect(await t.query(api.drops.myHostedDrops, { deviceToken: 'laptop' })).toEqual(rows);
    expect((await t.query(api.drops.myHostedDrops, { deviceToken: 'rival' })).map((r) => r.title)).toEqual(['Not mine']);
  });
});

describe('host sign-in', () => {
  beforeEach(() => {
    vi.stubEnv('WHOP_OAUTH_CLIENT_ID', 'app_test');
    vi.stubEnv('CONVEX_SITE_URL', 'https://example.convex.site');
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL) => {
        const url = String(input);
        if (url.endsWith('/oauth/token')) return Response.json({ access_token: 'at_1', refresh_token: 'rt_1', expires_in: 3600 });
        if (url.endsWith('/users/me')) return Response.json({ id: 'user_razeen', name: 'Razeen', username: 'razeen' });
        return new Response('not found', { status: 404 });
      }),
    );
  });

  async function callback(t: T, url: string | null, query: string) {
    const state = new URL(url!).searchParams.get('state');
    return t.fetch('/whop/oauth/callback?' + query + '&state=' + state, { method: 'GET' });
  }

  test('any device can start host sign-in; it links the starting device, whose next drop records the account', async () => {
    const t = newTest();
    const { url, reason } = await t.action(api.whopAuth.startSignIn, { deviceToken: 'laptop', purpose: 'host', returnUrl: 'exp://192.168.1.5:8081/--/host' });
    expect(reason).toBeNull();
    const response = await callback(t, url, 'code=c1');
    const back = new URL(response.headers.get('Location')!);
    expect(back.href.split('?')[0]).toBe('exp://192.168.1.5:8081/--/host');
    expect(back.searchParams.get('whop')).toBe('link');
    expect(await t.mutation(api.whopAuth.completeSignIn, { deviceToken: 'laptop', linkCode: back.searchParams.get('code')! })).toBe(true);
    expect((await t.query(api.whopAuth.account, { deviceToken: 'laptop' })).account?.whopUserId).toBe('user_razeen');
    const { dropId } = await t.mutation(api.drops.hostDrop, { deviceToken: 'laptop' });
    expect(await hostWhopUserIds(t)).toEqual(['user_razeen']);
    expect((await t.query(api.drops.myHostedDrops, { deviceToken: 'laptop' })).map((r) => r.dropId)).toEqual([dropId]);
  });

  test('the web app origin is an allowed return URL; lookalike origins are not', async () => {
    const t = newTest();
    const web = await t.action(api.whopAuth.startSignIn, { deviceToken: 'web', purpose: 'host', returnUrl: 'https://signal-app-wine.vercel.app/host' });
    expect((await callback(t, web.url, 'error=access_denied')).headers.get('Location')).toBe('https://signal-app-wine.vercel.app/host?whop=cancelled');
    for (const returnUrl of ['https://signal-app-wine.vercel.app.evil.com/host', 'https://signal-app-wine.vercel.appx/', 'http://signal-app-wine.vercel.app/host']) {
      const started = await t.action(api.whopAuth.startSignIn, { deviceToken: 'web', purpose: 'host', returnUrl });
      expect((await callback(t, started.url, 'error=access_denied')).headers.get('Location')).toBe('cmhmaxwin://whop-auth?whop=cancelled');
    }
  });

  test('host sign-in degrades without an OAuth app', async () => {
    vi.stubEnv('WHOP_OAUTH_CLIENT_ID', '');
    const t = newTest();
    expect(await t.action(api.whopAuth.startSignIn, { deviceToken: 'laptop', purpose: 'host' })).toEqual({ url: null, reason: 'unavailable' });
  });
});
