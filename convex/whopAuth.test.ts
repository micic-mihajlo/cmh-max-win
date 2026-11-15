/// <reference types="vite/client" />
import { convexTest } from 'convex-test';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { api, internal } from './_generated/api';
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

async function signIn(t: ReturnType<typeof convexTest>, code: string, user: { id: string; name: string; username: string }, deviceToken = DEVICE) {
  users[code] = user;
  const { url } = await t.action(api.whopAuth.startSignIn, { deviceToken, returnUrl: 'cmhmaxwin://award/ABC' });
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
    expect(await t.action(api.whopAuth.startSignIn, { deviceToken: DEVICE })).toEqual({ url: null });
    expect(await t.run((ctx) => resolveIdentity(ctx, DEVICE))).toEqual({ deviceToken: DEVICE });
  });

  test('links the device token that started sign-in and never exposes tokens', async () => {
    const t = convexTest(schema, modules);
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
    const { url } = await t.action(api.whopAuth.startSignIn, { deviceToken: DEVICE });
    const state = new URL(url!).searchParams.get('state');
    expect((await t.fetch(`/whop/oauth/callback?code=c1&state=${state}`, { method: 'GET' })).headers.get('Location')).toBe('cmhmaxwin://whop-auth?whop=linked');
    expect((await t.fetch(`/whop/oauth/callback?code=c1&state=${state}`, { method: 'GET' })).status).toBe(400);
  });

  test('ignores return URLs outside the app scheme', async () => {
    const t = convexTest(schema, modules);
    const { url } = await t.action(api.whopAuth.startSignIn, { deviceToken: DEVICE, returnUrl: 'https://evil.example' });
    const state = new URL(url!).searchParams.get('state');
    const response = await t.fetch(`/whop/oauth/callback?error=access_denied&state=${state}`, { method: 'GET' });
    expect(response.headers.get('Location')).toBe('cmhmaxwin://whop-auth?whop=cancelled');
  });

  test('refreshes an expired token server-side', async () => {
    const t = convexTest(schema, modules);
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
    await signIn(t, 'c1', { id: 'user_nova', name: 'Nova', username: 'nova' });
    await t.mutation(api.whopAuth.signOut, { deviceToken: DEVICE });
    expect((await t.query(api.whopAuth.account, { deviceToken: DEVICE })).account).toBeNull();
    expect(await t.run((ctx) => ctx.db.query('whopOAuthTokens').collect())).toHaveLength(0);
  });

  test('checkWhopAccess reads has_access for a resource', async () => {
    const t = convexTest(schema, modules);
    expect(await t.action(internal.whopAuth.checkAccess, { whopUserId: 'user_nova', resourceId: 'prod_members' })).toEqual({ hasAccess: true, accessLevel: 'customer' });
    expect(await t.action(internal.whopAuth.checkAccess, { whopUserId: 'user_nova', resourceId: 'prod_other' })).toEqual({ hasAccess: false, accessLevel: 'no_access' });
  });
});
