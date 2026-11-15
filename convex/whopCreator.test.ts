/// <reference types="vite/client" />
import { convexTest } from 'convex-test';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { api, internal } from './_generated/api';
import schema from './schema';

const modules = import.meta.glob('./**/*.ts');
const HOST = 'creator-device';

beforeEach(() => {
  vi.stubEnv('WHOP_API_KEY', 'test-key');
  vi.stubEnv('WHOP_OAUTH_CLIENT_ID', 'app_test');
  vi.stubEnv('CONVEX_SITE_URL', 'https://example.convex.site');
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL) => {
      const m = String(input).match(/\/users\/(user_[^/]+)\/access\/([^/]+)$/);
      if (!m) return new Response('not found', { status: 404 });
      const admin = m[1] === 'user_nova' && m[2] === 'biz_nova';
      return Response.json({ has_access: admin, access_level: admin ? 'admin' : 'no_access' });
    }),
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function errorCode(p: Promise<unknown>) {
  try {
    await p;
  } catch (e) {
    return (e as { data?: { code?: string } }).data?.code;
  }
  return 'no error';
}

async function creator(t: ReturnType<typeof convexTest>, whopUserId?: string) {
  await t.mutation(api.challenges.saveCreatorProfile, { deviceToken: HOST, displayName: 'Nova', handle: 'nova' });
  if (whopUserId) {
    await t.mutation(internal.whopAuth.linkIdentity, {
      deviceToken: HOST,
      whopUserId,
      name: 'Nova',
      accessToken: 'at',
      expiresAt: Date.now() + 3_600_000,
    });
  }
}

describe('Whop for creators', () => {
  test('only a device with a creator profile can start creator sign-in', async () => {
    const t = convexTest(schema, modules);
    expect(await t.action(api.whopAuth.startSignIn, { deviceToken: HOST })).toEqual({ url: null, reason: 'no_profile' });
    expect(await t.query(api.whopCreator.creatorWhop, { deviceToken: HOST })).toBeNull();
    await creator(t);
    expect((await t.action(api.whopAuth.startSignIn, { deviceToken: HOST })).url).toMatch(/\/oauth\/authorize\?/);
    expect(await t.query(api.whopCreator.creatorWhop, { deviceToken: HOST })).toEqual({
      signInAvailable: true,
      whopUserId: null,
      whopName: null,
      companyId: null,
    });
  });

  test('connecting a company needs a profile, a Whop sign-in and admin access', async () => {
    const t = convexTest(schema, modules);
    expect(await errorCode(t.action(api.whopCreator.connectWhopCompany, { deviceToken: HOST, companyId: 'biz_nova' }))).toBe('NO_PROFILE');
    await creator(t);
    expect(await errorCode(t.action(api.whopCreator.connectWhopCompany, { deviceToken: HOST, companyId: 'biz_nova' }))).toBe('WHOP_SIGN_IN_REQUIRED');
    expect(await errorCode(t.action(api.whopCreator.connectWhopCompany, { deviceToken: HOST, companyId: 'nova' }))).toBe('INVALID_CONFIG');
  });

  test('stores the company id only for an admin, and disconnects', async () => {
    const t = convexTest(schema, modules);
    await creator(t, 'user_nova');
    expect(await errorCode(t.action(api.whopCreator.connectWhopCompany, { deviceToken: HOST, companyId: 'biz_other' }))).toBe('NOT_WHOP_ADMIN');
    expect(await t.action(api.whopCreator.connectWhopCompany, { deviceToken: HOST, companyId: ' biz_nova ' })).toEqual({ companyId: 'biz_nova' });
    expect(await t.query(api.whopCreator.creatorWhop, { deviceToken: HOST })).toMatchObject({ whopUserId: 'user_nova', whopName: 'Nova', companyId: 'biz_nova' });
    await t.mutation(api.whopCreator.disconnectWhopCompany, { deviceToken: HOST });
    expect((await t.query(api.whopCreator.creatorWhop, { deviceToken: HOST }))?.companyId).toBeNull();
  });
});
