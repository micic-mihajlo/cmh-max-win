/// <reference types="vite/client" />
import presenceTest from '@convex-dev/presence/test';
import rateLimiterTest from '@convex-dev/rate-limiter/test';
import { convexTest } from 'convex-test';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { api, internal } from './_generated/api';
import type { Doc, Id } from './_generated/dataModel';
import { awardMode, awardModeWithBudget, createTransferRows } from './bounty';
import { bountyView } from './drops';
import schema from './schema';

const modules = import.meta.glob('./**/*.ts');
const SEATS = ['dev-a', 'dev-b', 'dev-c'];

let transfers: { key: string | null; body: { amount: number; destination_id: string; idempotence_key: string; type: string } }[];
let respond: () => Response;

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubEnv('WHOP_API_KEY', 'test-key');
  vi.stubEnv('WHOP_ACCOUNT_ID', 'biz_platform');
  vi.stubEnv('SIGNAL_REAL_PAYOUT_BUDGET_CENTS', '100000');
  transfers = [];
  respond = () => Response.json({ id: 'xfer_' + transfers.length });
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL, init?: RequestInit) => {
      if (!String(input).endsWith('/transfers')) return new Response('not found', { status: 404 });
      transfers.push({ key: new Headers(init?.headers).get('Idempotency-Key'), body: JSON.parse(String(init?.body)) });
      return respond();
    }),
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function link(t: ReturnType<typeof convexTest>, deviceToken: string, whopUserId: string) {
  await t.mutation(internal.whopAuth.linkIdentity, { deviceToken, whopUserId, name: whopUserId, accessToken: 'at', expiresAt: Date.now() + 3_600_000 });
}

async function seedAward(t: ReturnType<typeof convexTest>, mode: 'concept' | 'transfer' = 'transfer') {
  return t.run(async (ctx) => {
    const roomId = await ctx.db.insert('rooms', {
      code: 'SQUAD1',
      hostToken: '',
      caseId: 'aurora01',
      dropId: 'drop1',
      status: 'resolved',
      theory: { culprit: null, revision: 0, lastEditedBy: null },
      attempts: 1,
      lastNudge: null,
      checkedRevision: null,
      checkSeq: 0,
      lastCheck: null,
    });
    const memberIds: Id<'members'>[] = [];
    for (const [i, deviceToken] of SEATS.entries()) {
      memberIds.push(await ctx.db.insert('members', { roomId, deviceToken, name: 'P' + i, role: 'detective', presence: 'online' }));
    }
    const awardId = await ctx.db.insert('bountyAwards', {
      dropId: 'drop1',
      roomId,
      place: 1,
      amountCents: 999,
      perPlayerCents: 333,
      redeemableCount: 3,
      mode,
      status: 'pending',
      claimUrl: null,
      label: '',
    });
    return { awardId, memberIds };
  });
}

const rows = (t: ReturnType<typeof convexTest>) => t.run((ctx) => ctx.db.query('bountyPayouts').collect());
const settle = (t: ReturnType<typeof convexTest>) => t.finishAllScheduledFunctions(vi.runAllTimers);
const myAward = (t: ReturnType<typeof convexTest>, deviceToken: string) => t.query(api.drops.myAward, { deviceToken, code: 'SQUAD1' });

describe('real payouts (SIGNAL_REAL_PAYOUTS)', () => {
  test('the flag off keeps concept and sandbox exactly as before', async () => {
    expect(awardMode({ conceptOnly: true }, 999)).toBe('concept');
    expect(awardMode({}, 999)).toBe('concept');
    vi.stubEnv('BOUNTY_MODE', 'sandbox');
    expect(awardMode({}, 999)).toBe('sandbox');
    expect(awardMode({ conceptOnly: true }, 999)).toBe('concept');

    vi.stubEnv('SIGNAL_REAL_PAYOUTS', '');
    const t = convexTest(schema, modules);
    const { awardId } = await seedAward(t, 'concept');
    await t.action(internal.bounty.payAward, { awardId, mode: 'concept', perPlayerCents: 333, redeemableCount: 3 });
    await settle(t);
    expect(await rows(t)).toEqual([]);
    expect(transfers).toEqual([]);
    expect((await myAward(t, 'dev-a'))?.myPayout).toEqual({ status: 'concept', amountCents: 333 });
  });

  test('the flag on pays hosted drops by transfer up to the cap, and above it stays concept', async () => {
    vi.stubEnv('SIGNAL_REAL_PAYOUTS', 'on');
    expect(awardMode({ conceptOnly: true }, 1000)).toBe('transfer');
    expect(awardMode({ conceptOnly: true }, 1001)).toBe('concept');
    expect(awardMode({}, 1001)).toBe('concept');
    vi.stubEnv('SIGNAL_REAL_PAYOUT_CAP_CENTS', '300');
    expect(awardMode({ conceptOnly: true }, 300)).toBe('transfer');
    expect(awardMode({ conceptOnly: true }, 301)).toBe('concept');
    vi.stubEnv('SIGNAL_REAL_PAYOUT_CAP_CENTS', '0');
    expect(awardMode({}, 1)).toBe('concept');
  });

  test('no budget means no real payouts, even with the flag on', async () => {
    vi.stubEnv('SIGNAL_REAL_PAYOUTS', 'on');
    vi.stubEnv('SIGNAL_REAL_PAYOUT_BUDGET_CENTS', '');
    expect(awardMode({}, 1)).toBe('concept');
    vi.stubEnv('SIGNAL_REAL_PAYOUT_BUDGET_CENTS', '0');
    expect(awardMode({}, 1)).toBe('concept');
  });

  test('a $10 budget: the first award pays by transfer, the second goes concept', async () => {
    vi.stubEnv('SIGNAL_REAL_PAYOUTS', 'on');
    vi.stubEnv('SIGNAL_REAL_PAYOUT_BUDGET_CENTS', '1000');
    const t = convexTest(schema, modules);
    const { awardId } = await seedAward(t);
    expect(await t.run((ctx) => awardModeWithBudget(ctx, {}, 999))).toBe('transfer');
    await t.run((ctx) => createTransferRows(ctx, awardId));
    expect(await t.run((ctx) => awardModeWithBudget(ctx, {}, 999))).toBe('concept');
    expect(await t.run((ctx) => awardModeWithBudget(ctx, {}, 1))).toBe('transfer');
    await t.run(async (ctx) => {
      for (const r of await ctx.db.query('bountyPayouts').collect()) await ctx.db.patch(r._id, { status: 'failed' });
    });
    expect(await t.run((ctx) => awardModeWithBudget(ctx, {}, 999))).toBe('transfer');
  });

  test('retries_exhausted rows stay counted against the budget; definite refusals release theirs', async () => {
    vi.stubEnv('SIGNAL_REAL_PAYOUTS', 'on');
    vi.stubEnv('SIGNAL_REAL_PAYOUT_BUDGET_CENTS', '1000');
    const t = convexTest(schema, modules);
    const { awardId } = await seedAward(t);
    await t.run((ctx) => createTransferRows(ctx, awardId));
    const failAll = (failureCode: string) =>
      t.run(async (ctx) => {
        for (const r of await ctx.db.query('bountyPayouts').collect()) await ctx.db.patch(r._id, { status: 'failed', failureCode });
      });
    await failAll('retries_exhausted');
    expect(await t.run((ctx) => awardModeWithBudget(ctx, {}, 999))).toBe('concept');
    await failAll('kyc_required');
    expect(await t.run((ctx) => awardModeWithBudget(ctx, {}, 999))).toBe('transfer');
  });

  test('a zero-cent award creates no transfer rows', async () => {
    vi.stubEnv('SIGNAL_REAL_PAYOUTS', 'on');
    expect(awardMode({}, 0)).toBe('concept');
    const t = convexTest(schema, modules);
    const { awardId } = await seedAward(t);
    await t.run((ctx) => ctx.db.patch(awardId, { amountCents: 0, perPlayerCents: 0 }));
    await link(t, 'dev-a', 'user_a');
    await t.run((ctx) => createTransferRows(ctx, awardId));
    await settle(t);
    expect(await rows(t)).toEqual([]);
    expect(transfers).toEqual([]);
  });

  test('the drop card mode follows the remaining budget', async () => {
    vi.stubEnv('SIGNAL_REAL_PAYOUTS', 'on');
    vi.stubEnv('SIGNAL_REAL_PAYOUT_BUDGET_CENTS', '1000');
    const t = convexTest(schema, modules);
    const drop = { conceptOnly: true, bounty: { totalCents: 1998, currency: 'usd' as const, winnerSlots: 2 } } as unknown as Doc<'drops'>;
    expect((await t.run((ctx) => bountyView(ctx, drop))).mode).toBe('transfer');
    const { awardId } = await seedAward(t);
    await t.run((ctx) => createTransferRows(ctx, awardId));
    expect((await t.run((ctx) => bountyView(ctx, drop))).mode).toBe('concept');
  });

  test('linked members are paid once each; the split adds up to the squad share', async () => {
    const t = convexTest(schema, modules);
    const { awardId, memberIds } = await seedAward(t);
    await link(t, 'dev-a', 'user_a');
    await link(t, 'dev-b', 'user_b');
    await t.action(internal.bounty.payAward, { awardId, mode: 'transfer', perPlayerCents: 333, redeemableCount: 3 });
    await t.mutation(internal.bounty.startTransfers, { awardId });
    await settle(t);

    expect(transfers.map((x) => x.body)).toEqual([
      { type: 'balance', amount: 3.33, currency: 'usd', origin_id: 'biz_platform', destination_id: 'user_a', idempotence_key: `${awardId}:${memberIds[0]}` },
      { type: 'balance', amount: 3.33, currency: 'usd', origin_id: 'biz_platform', destination_id: 'user_b', idempotence_key: `${awardId}:${memberIds[1]}` },
    ]);
    expect(transfers.map((x) => x.key)).toEqual([`${awardId}:${memberIds[0]}`, `${awardId}:${memberIds[1]}`]);
    expect((await rows(t)).map((r) => r.status)).toEqual(['sent', 'sent', 'sign_in_required']);

    const a = (await myAward(t, 'dev-a'))!;
    expect(a.mode).toBe('transfer');
    expect(a.myPayout).toEqual({ status: 'sent', amountCents: 333, transferId: 'xfer_1', message: 'Sent to your Whop balance' });
    expect(a.split.reduce((s, r) => s + r.cents, 0)).toBe(a.amountCents);
    expect((await myAward(t, 'dev-c'))!.myPayout).toEqual({ status: 'sign_in_required', amountCents: 333, message: 'Sign in with Whop to receive $3.33' });

    for (const r of await rows(t)) await t.action(internal.bounty.sendTransfer, { payoutId: r._id });
    expect(transfers).toHaveLength(2);
  });

  test('a member who links Whop later is paid on link', async () => {
    const t = convexTest(schema, modules);
    const { awardId } = await seedAward(t);
    await t.mutation(internal.bounty.startTransfers, { awardId });
    await settle(t);
    expect(transfers).toEqual([]);
    await link(t, 'dev-c', 'user_c');
    await settle(t);
    expect(transfers.map((x) => x.body.destination_id)).toEqual(['user_c']);
    expect((await myAward(t, 'dev-c'))!.myPayout.status).toBe('sent');
    await link(t, 'dev-c', 'user_c');
    await settle(t);
    expect(transfers).toHaveLength(1);
  });

  test('KYC refusals fail with a code; transient errors retry with the same key', async () => {
    const t = convexTest(schema, modules);
    const { awardId } = await seedAward(t);
    respond = () => Response.json({ error: { message: 'Please verify your business before transferring funds.' } }, { status: 400 });
    await link(t, 'dev-a', 'user_a');
    await t.mutation(internal.bounty.startTransfers, { awardId });
    await settle(t);
    expect((await myAward(t, 'dev-a'))!.myPayout).toEqual({ status: 'failed', amountCents: 333, failureCode: 'kyc_required', message: "The transfer didn't go through." });

    let calls = 0;
    respond = () => (++calls < 3 ? new Response('busy', { status: 503 }) : Response.json({ id: 'xfer_ok' }));
    await link(t, 'dev-b', 'user_b');
    await settle(t);
    const b = (await rows(t)).find((r) => r.deviceToken === 'dev-b')!;
    expect(b).toMatchObject({ status: 'sent', transferId: 'xfer_ok', attempts: 3 });
    expect(new Set(transfers.filter((x) => x.body.destination_id === 'user_b').map((x) => x.key)).size).toBe(1);
  });
});

describe('Whop transfer quirks and real pots', () => {
  // Whop's real create response: fee null until a later GET or the webhook, succeeded_at null even when succeeded.
  const created = (status: string) => Response.json({ id: 'ctt_98IpVoIUH8J8CJ', status, fee: null, succeeded_at: null, amount: 1 }, { status: 201 });

  test('status is the source of truth; the fee and succeeded_at are never read; the key goes in the header', async () => {
    const t = convexTest(schema, modules);
    const headers: Headers[] = [];
    vi.stubGlobal('fetch', vi.fn(async (_input: string | URL, init?: RequestInit) => {
      headers.push(new Headers(init?.headers));
      return created('succeeded');
    }));
    const { awardId, memberIds } = await seedAward(t);
    await link(t, 'dev-a', 'user_41t2bclWAC2x6');
    await t.mutation(internal.bounty.startTransfers, { awardId });
    await settle(t);
    expect(headers[0].get('Idempotency-Key')).toBe(`${awardId}:${memberIds[0]}`);
    expect(headers[0].get('Api-Version-Date')).toBe('2026-11-14-1');
    const row = (await rows(t)).find((r) => r.deviceToken === 'dev-a')!;
    expect(row).toMatchObject({ status: 'sent', transferId: 'ctt_98IpVoIUH8J8CJ', transferStatus: 'succeeded' });
    expect(Object.keys(row)).not.toContain('fee');
    expect((await myAward(t, 'dev-a'))!.myPayout).toEqual({ status: 'sent', amountCents: 333, transferId: 'ctt_98IpVoIUH8J8CJ', message: 'Sent to your Whop balance' });
  });

  test('a 2xx with a failed status is a failure, and releases its budget', async () => {
    vi.stubEnv('SIGNAL_REAL_PAYOUTS', 'on');
    vi.stubEnv('SIGNAL_REAL_PAYOUT_BUDGET_CENTS', '1000');
    const t = convexTest(schema, modules);
    vi.stubGlobal('fetch', vi.fn(async () => created('failed')));
    const { awardId } = await seedAward(t);
    await link(t, 'dev-a', 'user_a');
    await t.mutation(internal.bounty.startTransfers, { awardId });
    await settle(t);
    expect((await rows(t)).find((r) => r.deviceToken === 'dev-a')).toMatchObject({ status: 'failed', failureCode: 'transfer_failed', transferStatus: 'failed' });
  });

  test('real $3 and $6 pots are accepted, a pot over the remaining budget is refused, and concept stays selectable', async () => {
    vi.stubEnv('SIGNAL_REAL_PAYOUTS', 'on');
    vi.stubEnv('SIGNAL_REAL_PAYOUT_BUDGET_CENTS', '700');
    const t = convexTest(schema, modules);
    rateLimiterTest.register(t);
    presenceTest.register(t);
    const host = (deviceToken: string, totalCents: number, payoutMode: 'real' | 'concept') => t.mutation(api.drops.hostDrop, { deviceToken, totalCents, winnerSlots: 1, payoutMode });
    expect(await t.query(api.drops.realPayoutStatus, {})).toEqual({ enabled: true, remainingCents: 700, capPerSquadCents: 1000 });
    const three = await host('h1', 300, 'real');
    const six = await host('h2', 600, 'real');
    const view = (dropId: string) => t.query(api.drops.drop, { deviceToken: 'x', dropId });
    expect((await view(three.dropId))!.bounty.mode).toBe('transfer');
    expect((await view(six.dropId))!.bounty.mode).toBe('transfer');
    const code = await errorCode(host('h3', 800, 'real'));
    expect(code).toEqual({ code: 'REAL_BUDGET_EXCEEDED', message: 'Real payouts have $7 left. Pick a pot up to $7, or concept.' });
    const concept = await host('h4', 800, 'concept');
    expect((await view(concept.dropId))!.bounty.mode).toBe('concept');
    const drop = (await t.run((ctx) => ctx.db.query('drops').withIndex('by_dropId', (q) => q.eq('dropId', concept.dropId)).unique()))!;
    expect(await t.run((ctx) => awardModeWithBudget(ctx, drop, 300))).toBe('concept');
    vi.stubEnv('SIGNAL_REAL_PAYOUTS', '');
    expect((await errorCode(host('h5', 300, 'real')))!.code).toBe('REAL_PAYOUTS_OFF');
    expect(await t.query(api.drops.realPayoutStatus, {})).toMatchObject({ enabled: false, remainingCents: 0 });
  });
});

async function errorCode(p: Promise<unknown>) {
  try {
    await p;
  } catch (e) {
    const data = (e as { data?: { code?: string; message?: string } }).data;
    return data ? { code: data.code, message: data.message } : null;
  }
  throw new Error('expected the call to fail');
}
