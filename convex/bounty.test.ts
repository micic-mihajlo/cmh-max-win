import { convexTest } from 'convex-test';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { internal } from './_generated/api';
import schema from './schema';

const modules = import.meta.glob('./**/*.ts');
const KEY = 'sandbox-key-do-not-print';

const link = {
  object: 'claim_link',
  id: 'airdrp_1',
  code: 'abc',
  claim_url: 'https://sandbox.whop.com/claim/abc',
  status: 'active',
  claimable: true,
  amount: '1.00',
  currency: 'usd',
  redeemable_count: 3,
  redeemed_count: 0,
  remaining_claims: 3,
  expires_at: '2026-11-16T20:00:00.000Z',
};

let calls: { url: string; init?: RequestInit }[];
let respond: (url: string, init?: RequestInit) => Response;

beforeEach(() => {
  vi.stubEnv('WHOP_API_KEY', KEY);
  vi.stubEnv('WHOP_ACCOUNT_ID', 'biz_test');
  vi.stubEnv('WHOP_ENVIRONMENT', 'sandbox');
  calls = [];
  respond = (url, init) =>
    init?.method === 'POST' ? Response.json(link, { status: 201 }) : url.endsWith('/claim_links/airdrp_1') ? Response.json(link) : new Response('nope', { status: 404 });
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      return respond(url, init);
    }),
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('bounty.createClaimLink (sandbox)', () => {
  test('funds one claim link per call with the squad size and per-claim amount', async () => {
    const t = convexTest(schema, modules);
    const result = await t.action(internal.bounty.createClaimLink, { amountCents: 250, redeemableCount: 3, idempotencyKey: 'award_1' });
    expect(result).toEqual({
      claimLinkId: 'airdrp_1',
      claimUrl: 'https://sandbox.whop.com/claim/abc',
      status: 'active',
      amountPerClaim: '1.00',
      redeemableCount: 3,
      expiresAt: '2026-11-16T20:00:00.000Z',
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://sandbox-api.whop.com/api/v1/transfers');
    const headers = calls[0].init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Bearer ${KEY}`);
    expect(headers['Idempotency-Key']).toBe('award_1');
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({
      type: 'claim_link',
      origin_id: 'biz_test',
      amount: 2.5,
      currency: 'usd',
      redeemable_count: 3,
    });
  });

  test('refuses outside the sandbox and never calls Whop', async () => {
    vi.stubEnv('WHOP_ENVIRONMENT', 'production');
    const t = convexTest(schema, modules);
    await expect(t.action(internal.bounty.createClaimLink, { amountCents: 100, redeemableCount: 3, idempotencyKey: 'k' })).rejects.toThrow();
    expect(calls).toHaveLength(0);
  });

  test('rejects non-integer or non-positive amounts', async () => {
    const t = convexTest(schema, modules);
    for (const amountCents of [0, -5, 1.5]) {
      await expect(t.action(internal.bounty.createClaimLink, { amountCents, redeemableCount: 3, idempotencyKey: 'k' })).rejects.toThrow();
    }
    expect(calls).toHaveLength(0);
  });
});

describe('bounty.spikeClaimLink', () => {
  test('creates a $1 x 3 link, reads it back, and returns no URL or key', async () => {
    const t = convexTest(schema, modules);
    const result = await t.action(internal.bounty.spikeClaimLink, {});
    expect(result).toEqual({
      ok: true,
      claimLinkId: 'airdrp_1',
      status: 'active',
      readBack: { status: 'active', claimable: true, remainingClaims: 3, redeemableCount: 3 },
    });
    expect(JSON.parse(String(calls[0].init?.body))).toMatchObject({ amount: 1, redeemable_count: 3 });
    expect(calls[1].url).toBe('https://sandbox-api.whop.com/api/v1/claim_links/airdrp_1');
    const text = JSON.stringify(result);
    expect(text).not.toContain('claim/abc');
    expect(text).not.toContain(KEY);
  });

  test("reports Whop's error (e.g. a missing scope) without the key", async () => {
    respond = () => new Response('{"error":{"message":"missing airdrop_link:manage"}}', { status: 403 });
    const t = convexTest(schema, modules);
    const result = await t.action(internal.bounty.spikeClaimLink, {});
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).toContain('403');
    expect(JSON.stringify(result)).toContain('airdrop_link:manage');
    expect(JSON.stringify(result)).not.toContain(KEY);
  });
});
