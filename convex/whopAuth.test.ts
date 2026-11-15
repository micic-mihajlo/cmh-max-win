/// <reference types="vite/client" />
import { convexTest } from 'convex-test';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { api, internal } from './_generated/api';
import { DEFAULT_CONFIG } from './challenges';
import schema from './schema';
import { resolveIdentity } from './whopAuth';

const modules = import.meta.glob('./**/*.ts');
const DEVICE = 'device-token-1';

let users: Record<string, { id: string; name: string; username: string }>;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.stubEnv('WHOP_API_KEY', 'test-key');
  vi.stubEnv('WHOP_OAUTH_CLIENT_ID', 'app_test');
  vi.stubEnv('CONVEX_SITE_URL', 'https://example.convex.site');
  users = {};
  fetchMock = vi.fn(async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith('/oauth/token')) {
      const body = JSON.parse(String(init?.body));
      if (body.grant_type === 'authorization_code' && !body.code_verifier) return new Response('{}', { status: 400 });
      return Response.json({ access_token: 'at_' + body.code, refresh_token: 'rt_' + body.code, expires_in: 3600 });
    }
    if (url.endsWith('/users/me')) {
      const token = new Headers(init?.headers).get('Authorization')!.replace('Bearer at_', '');
      return Response.json(users[token]);
    }
    const access = url.match(/\/users\/(user_[^/]+)\/access\/([^/]+)$/);
    if (access) return Response.json({ has_access: access[2] === 'prod_members', access_level: access[2] === 'prod_members' ? 'customer' : 'no_access' });
    return new Response('not found', { status: 404 });
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const CLAIM = 'WIN123';

async function seedSeat(t: ReturnType<typeof convexTest>, { award = true, deviceToken = DEVICE } = {}) {
  await t.run(async (ctx) => {
    const roomId = await ctx.db.insert('rooms', {
      code: CLAIM,
      hostToken: '',
      caseId: 'case01',
      dropId: 'drop1',
      status: 'resolved',
      theory: { culprit: null, revision: 0, lastEditedBy: null },
      attempts: 1,
      lastNudge: null,
      checkedRevision: null,
      checkSeq: 0,
      lastCheck: null,
    });
    await ctx.db.insert('members', { roomId, deviceToken, name: 'Nova', role: 'detective', presence: 'online' });
    if (award) {
      await ctx.db.insert('bountyAwards', {
        dropId: 'drop1',
        roomId,
        place: 1,
        amountCents: 10_000,
        perPlayerCents: 5_000,
        redeemableCount: 2,
        mode: 'concept',
        status: 'ready',
        claimUrl: null,
        label: '1st',
      });
    }
  });
}

async function start(t: ReturnType<typeof convexTest>, deviceToken = DEVICE, returnUrl?: string) {
  return t.action(api.whopAuth.startSignIn, { deviceToken, claimCode: CLAIM, returnUrl });
}

async function signIn(t: ReturnType<typeof convexTest>, code: string, user: { id: string; name: string; username: string }, deviceToken = DEVICE) {
  users[code] = user;
  const { url } = await start(t, deviceToken, 'cmhmaxwin://award/ABC');
  const authorize = new URL(url!);
  expect(authorize.searchParams.get('code_challenge_method')).toBe('S256');
  expect(authorize.searchParams.get('redirect_uri')).toBe('https://example.convex.site/whop/oauth/callback');
  const state = authorize.searchParams.get('state')!;
  return t.fetch(`/whop/oauth/callback?code=${code}&state=${state}`, { method: 'GET' });
}

describe('Sign in with Whop', () => {
  test('degrades cleanly without an OAuth app', async () => {
    vi.stubEnv('WHOP_OAUTH_CLIENT_ID', '');
    const t = convexTest(schema, modules);
    expect(await t.query(api.whopAuth.account, { deviceToken: DEVICE })).toEqual({ available: false, account: null });
    await seedSeat(t);
    expect(await start(t)).toEqual({ url: null, reason: 'unavailable' });
    expect(await t.run((ctx) => resolveIdentity(ctx, DEVICE))).toEqual({ deviceToken: DEVICE });
  });

  test('links the device token that started sign-in and never exposes tokens', async () => {
    const t = convexTest(schema, modules);
    await seedSeat(t);
    const response = await signIn(t, 'c1', { id: 'user_nova', name: 'Nova', username: 'nova' });
    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toBe('cmhmaxwin://award/ABC?whop=linked');
    const state = await t.query(api.whopAuth.account, { deviceToken: DEVICE });
    expect(state.account).toMatchObject({ whopUserId: 'user_nova', name: 'Nova', username: 'nova', environment: 'sandbox' });
    expect(JSON.stringify(state)).not.toMatch(/at_|rt_/);
    expect(await t.run((ctx) => resolveIdentity(ctx, DEVICE))).toEqual({ deviceToken: DEVICE, whopUserId: 'user_nova', name: 'Nova' });
    expect(await t.run((ctx) => resolveIdentity(ctx, 'other-device'))).toEqual({ deviceToken: 'other-device' });
  });

  test('re-linking a token to another Whop user replaces the link', async () => {
    const t = convexTest(schema, modules);
    await seedSeat(t);
    await signIn(t, 'c1', { id: 'user_nova', name: 'Nova', username: 'nova' });
    await signIn(t, 'c2', { id: 'user_rex', name: 'Rex', username: 'rex' });
    const rows = await t.run((ctx) => ctx.db.query('identities').collect());
    expect(rows).toHaveLength(1);
    expect(rows[0].whopUserId).toBe('user_rex');
  });

  test('rejects unknown and replayed state', async () => {
    const t = convexTest(schema, modules);
    expect((await t.fetch('/whop/oauth/callback?code=x&state=nope', { method: 'GET' })).status).toBe(400);
    users.c1 = { id: 'user_nova', name: 'Nova', username: 'nova' };
    await seedSeat(t);
    const { url } = await start(t);
    const state = new URL(url!).searchParams.get('state');
    expect((await t.fetch(`/whop/oauth/callback?code=c1&state=${state}`, { method: 'GET' })).headers.get('Location')).toBe('cmhmaxwin://whop-auth?whop=linked');
    expect((await t.fetch(`/whop/oauth/callback?code=c1&state=${state}`, { method: 'GET' })).status).toBe(400);
  });

  test('ignores return URLs outside the app scheme', async () => {
    const t = convexTest(schema, modules);
    await seedSeat(t);
    const { url } = await start(t, DEVICE, 'https://evil.example');
    const state = new URL(url!).searchParams.get('state');
    const response = await t.fetch(`/whop/oauth/callback?error=access_denied&state=${state}`, { method: 'GET' });
    expect(response.headers.get('Location')).toBe('cmhmaxwin://whop-auth?whop=cancelled');
  });

  test('refreshes an expired token server-side', async () => {
    const t = convexTest(schema, modules);
    await seedSeat(t);
    await signIn(t, 'c1', { id: 'user_nova', name: 'Nova', username: 'nova' });
    await t.run(async (ctx) => {
      const row = (await ctx.db.query('whopOAuthTokens').first())!;
      await ctx.db.patch(row._id, { expiresAt: Date.now() - 1 });
    });
    users['rt_c1'] = { id: 'user_nova', name: 'Nova Prime', username: 'nova' };
    fetchMock.mockImplementationOnce(async () => Response.json({ access_token: 'at_rt_c1', expires_in: 3600 }));
    await t.action(api.whopAuth.refreshAccount, { deviceToken: DEVICE });
    expect((await t.query(api.whopAuth.account, { deviceToken: DEVICE })).account?.name).toBe('Nova Prime');
    const tokens = await t.run((ctx) => ctx.db.query('whopOAuthTokens').first());
    expect(tokens).toMatchObject({ accessToken: 'at_rt_c1', refreshToken: 'rt_c1' });
  });

  test('sign out unlinks the device', async () => {
    const t = convexTest(schema, modules);
    await seedSeat(t);
    await signIn(t, 'c1', { id: 'user_nova', name: 'Nova', username: 'nova' });
    await t.mutation(api.whopAuth.signOut, { deviceToken: DEVICE });
    expect((await t.query(api.whopAuth.account, { deviceToken: DEVICE })).account).toBeNull();
    expect(await t.run((ctx) => ctx.db.query('whopOAuthTokens').collect())).toHaveLength(0);
  });

  test('only a device holding a winning seat can start sign-in', async () => {
    const t = convexTest(schema, modules);
    await seedSeat(t, { award: false });
    expect(await start(t)).toEqual({ url: null, reason: 'not_winner' });
    await t.run(async (ctx) => {
      const room = (await ctx.db.query('rooms').first())!;
      await ctx.db.insert('bountyAwards', { dropId: 'drop1', roomId: room._id, place: 1, amountCents: 1, perPlayerCents: 1, redeemableCount: 1, mode: 'concept', status: 'ready', claimUrl: null, label: '1st' });
    });
    expect(await start(t, 'spectator-device')).toEqual({ url: null, reason: 'not_winner' });
    expect(await t.action(api.whopAuth.startSignIn, { deviceToken: DEVICE, claimCode: 'NOPE' })).toEqual({ url: null, reason: 'not_winner' });
    expect((await start(t)).url).toMatch(/\/oauth\/authorize\?/);
  });

  test('a challenge team winner with a payout row can start claim sign-in', async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      await ctx.db.insert('creators', { deviceToken: 'host', displayName: 'Host', handle: 'host' });
      const challengeId = await ctx.db.insert('challenges', {
        creatorToken: 'host',
        config: DEFAULT_CONFIG,
        status: 'ended',
        serverCreated: false,
        createdAt: 0,
        finishedCount: 1,
      });
      await ctx.db.insert('rooms', {
        code: 'TEAM01',
        hostToken: '',
        caseId: 'case01',
        challengeId,
        status: 'resolved',
        theory: { culprit: null, revision: 0, lastEditedBy: null },
        attempts: 1,
        lastNudge: null,
        checkedRevision: null,
        checkSeq: 0,
        lastCheck: null,
      });
      await ctx.db.insert('payouts', {
        challengeId,
        place: 1,
        teamLabel: 'A',
        playerIndex: 0,
        deviceToken: DEVICE,
        name: 'Nova',
        cents: 100,
        status: 'claim_pending_whop',
        adapter: 'concept',
        idempotencyKey: 'k',
        updatedAt: 0,
      });
    });
    expect((await t.action(api.whopAuth.startSignIn, { deviceToken: DEVICE, claimCode: 'TEAM01' })).url).toMatch(/\/oauth\/authorize\?/);
    expect(await t.action(api.whopAuth.startSignIn, { deviceToken: 'loser', claimCode: 'TEAM01' })).toEqual({ url: null, reason: 'not_winner' });
  });

  test('checkWhopAccess reads has_access for a resource', async () => {
    const t = convexTest(schema, modules);
    expect(await t.action(internal.whopAuth.checkAccess, { whopUserId: 'user_nova', resourceId: 'prod_members' })).toEqual({ hasAccess: true, accessLevel: 'customer' });
    expect(await t.action(internal.whopAuth.checkAccess, { whopUserId: 'user_nova', resourceId: 'prod_other' })).toEqual({ hasAccess: false, accessLevel: 'no_access' });
  });
});
