/// <reference types="vite/client" />
import { convexTest } from 'convex-test';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { api, internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { awardMode, awardModeWithBudget, createTransferRows } from './bounty';
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
    expect(a.myPayout).toEqual({ status: 'sent', amountCents: 333 });
    expect(a.split.reduce((s, r) => s + r.cents, 0)).toBe(a.amountCents);
    expect((await myAward(t, 'dev-c'))!.myPayout).toEqual({ status: 'sign_in_required', amountCents: 333 });

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
    expect((await myAward(t, 'dev-a'))!.myPayout).toEqual({ status: 'failed', amountCents: 333, failureCode: 'kyc_required' });

    let calls = 0;
    respond = () => (++calls < 3 ? new Response('busy', { status: 503 }) : Response.json({ id: 'xfer_ok' }));
    await link(t, 'dev-b', 'user_b');
    await settle(t);
    const b = (await rows(t)).find((r) => r.deviceToken === 'dev-b')!;
    expect(b).toMatchObject({ status: 'sent', transferId: 'xfer_ok', attempts: 3 });
    expect(new Set(transfers.filter((x) => x.body.destination_id === 'user_b').map((x) => x.key)).size).toBe(1);
  });
});
