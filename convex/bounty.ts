import { ConvexError, v } from 'convex/values';

import { internal } from './_generated/api';
import type { Doc, Id } from './_generated/dataModel';
import { internalAction, internalMutation, internalQuery, type MutationCtx, type QueryCtx } from './_generated/server';
import { WHOP_API_VERSION_DATE, WHOP_TRANSFER_API_VERSION_DATE, whopApiBase, whopEnvironment, whopRequest } from './whop';

type WhopClaimLink = {
  id: string;
  claim_url: string | null;
  status: string;
  claimable: boolean;
  amount: string;
  redeemable_count: number;
  remaining_claims: number;
  expires_at: string | null;
};

const claimLinkResult = v.object({
  claimLinkId: v.string(),
  claimUrl: v.string(),
  status: v.string(),
  amountPerClaim: v.string(),
  redeemableCount: v.number(),
  expiresAt: v.union(v.string(), v.null()),
});

export async function createSandboxClaimLink(args: { amountCents: number; redeemableCount: number; idempotencyKey: string }) {
  if (whopEnvironment() !== 'sandbox') {
    throw new ConvexError({ code: 'BOUNTY_SANDBOX_ONLY', message: 'Bounty claim links only run against the Whop sandbox.' });
  }
  const accountId = process.env.WHOP_ACCOUNT_ID;
  if (!accountId) {
    throw new ConvexError({ code: 'WHOP_NOT_CONFIGURED', message: 'Whop is not configured on this deployment.' });
  }
  if (!Number.isInteger(args.amountCents) || args.amountCents < 1 || !Number.isInteger(args.redeemableCount) || args.redeemableCount < 1) {
    throw new ConvexError({ code: 'BOUNTY_INVALID_AMOUNT', message: 'amountCents and redeemableCount must be positive integers.' });
  }
  const link = await whopRequest<WhopClaimLink>('/transfers', {
    method: 'POST',
    headers: { 'Idempotency-Key': args.idempotencyKey },
    body: {
      type: 'claim_link',
      origin_id: accountId,
      amount: args.amountCents / 100,
      currency: 'usd',
      redeemable_count: args.redeemableCount,
    },
  });
  if (!link.claim_url) {
    throw new ConvexError({ code: 'WHOP_REQUEST_FAILED', message: `Whop created ${link.id} without a claim URL` });
  }
  return {
    claimLinkId: link.id,
    claimUrl: link.claim_url,
    status: link.status,
    amountPerClaim: link.amount,
    redeemableCount: link.redeemable_count,
    expiresAt: link.expires_at,
  };
}

// Sandbox mode of a squad's bounty share: one Whop claim link that each squad member claims once.
// amountCents is what each claim pays. Reuse idempotencyKey (e.g. the award id) on retries so Whop funds one link.
export const createClaimLink = internalAction({
  args: { amountCents: v.number(), redeemableCount: v.number(), idempotencyKey: v.string() },
  returns: claimLinkResult,
  handler: (_ctx, args) => createSandboxClaimLink(args),
});

// One-off spike: fund a $1 x 3 sandbox claim link and read it back. Returns ids and statuses only, never the URL or key.
export const spikeClaimLink = internalAction({
  args: {},
  returns: v.union(
    v.object({
      ok: v.literal(true),
      claimLinkId: v.string(),
      status: v.string(),
      readBack: v.object({ status: v.string(), claimable: v.boolean(), remainingClaims: v.number(), redeemableCount: v.number() }),
    }),
    v.object({ ok: v.literal(false), error: v.string() }),
  ),
  handler: async () => {
    try {
      const link = await createSandboxClaimLink({ amountCents: 100, redeemableCount: 3, idempotencyKey: `signal-spike-${Date.now()}` });
      const back = await whopRequest<WhopClaimLink>(`/claim_links/${encodeURIComponent(link.claimLinkId)}`);
      return {
        ok: true as const,
        claimLinkId: link.claimLinkId,
        status: link.status,
        readBack: { status: back.status, claimable: back.claimable, remainingClaims: back.remaining_claims, redeemableCount: back.redeemable_count },
      };
    } catch (e) {
      const data = e instanceof ConvexError ? (e.data as { message?: string }) : null;
      return { ok: false as const, error: data?.message ?? (e instanceof Error ? e.message : 'unknown error') };
    }
  },
});

export const CONCEPT_LABEL = 'Concept payout — no real money moves';

// Pays one winning squad's award. Scheduled only by the lock-in that wins a place within winnerSlots.
// concept (BOUNTY_MODE unset, the default): a labeled concept award with no URL.
// sandbox: one Whop claim link, redeemable once per squad member, keyed by the award id so retries fund one link.
export const payAward = internalAction({
  args: {
    awardId: v.id('bountyAwards'),
    mode: v.union(v.literal('concept'), v.literal('sandbox'), v.literal('transfer')),
    perPlayerCents: v.number(),
    redeemableCount: v.number(),
  },
  handler: async (ctx, { awardId, mode, perPlayerCents, redeemableCount }) => {
    if (mode === 'transfer') {
      await ctx.runMutation(internal.bounty.startTransfers, { awardId });
      return;
    }
    if (mode !== 'sandbox') {
      await ctx.runMutation(internal.bounty.recordAward, { awardId, status: 'ready', claimUrl: null, label: CONCEPT_LABEL });
      return;
    }
    try {
      const link = await ctx.runAction(internal.bounty.createClaimLink, {
        amountCents: perPlayerCents,
        redeemableCount,
        idempotencyKey: awardId,
      });
      await ctx.runMutation(internal.bounty.recordAward, {
        awardId,
        status: 'ready',
        claimUrl: link.claimUrl,
        claimLinkId: link.claimLinkId,
        expiresAt: link.expiresAt ?? undefined,
        label: 'Whop sandbox claim link',
      });
    } catch (e) {
      const data = e instanceof ConvexError ? (e.data as { message?: string }) : null;
      await ctx.runMutation(internal.bounty.recordAward, {
        awardId,
        status: 'failed',
        claimUrl: null,
        label: 'Payout could not be created',
        error: data?.message ?? (e instanceof Error ? e.message : 'unknown error'),
      });
    }
  },
});

export const recordAward = internalMutation({
  args: {
    awardId: v.id('bountyAwards'),
    status: v.union(v.literal('ready'), v.literal('failed')),
    claimUrl: v.union(v.string(), v.null()),
    claimLinkId: v.optional(v.string()),
    expiresAt: v.optional(v.string()),
    label: v.string(),
    error: v.optional(v.string()),
  },
  handler: async (ctx, { awardId, ...result }) => {
    await ctx.db.patch(awardId, result);
  },
});

// ---------- Real payouts: Whop balance transfers (CMHM-11) ----------
// SIGNAL_REAL_PAYOUTS=on (dev only) turns every drop award, hosted drops included, into one Whop balance
// transfer per squad member to their linked whopUserId. Off (the default) keeps today's behaviour exactly.

export const TRANSFER_LABEL = 'Paid by Whop transfer';
const FAILED_TRANSFER_STATUSES = new Set(['failed', 'canceled', 'cancelled', 'reversed', 'rejected']);
const MAX_TRANSFER_ATTEMPTS = 4;
export const MIN_TRANSFER_CENTS = 100; // Whop refuses a transfer under $1 ("minimum amount you can pay is $1.00")
export const SIGN_IN_RELEASE_MS = 30 * 60 * 1000; // an unclaimed share goes back to the real budget after this

// Real transfers are capped per award (SIGNAL_REAL_PAYOUT_CAP_CENTS, default $10): anyone can host a drop
// with any pool, so an award above the cap stays concept.
export function realPayoutCapCents(): number {
  const cap = Number(process.env.SIGNAL_REAL_PAYOUT_CAP_CENTS);
  return Number.isFinite(cap) && cap >= 0 && process.env.SIGNAL_REAL_PAYOUT_CAP_CENTS ? cap : 1000;
}

// Total cents all real transfers may ever commit (SIGNAL_REAL_PAYOUT_BUDGET_CENTS). Unset means 0: no real payouts.
export function realPayoutBudgetCents(): number {
  const budget = Number(process.env.SIGNAL_REAL_PAYOUT_BUDGET_CENTS);
  return Number.isFinite(budget) && budget > 0 ? budget : 0;
}

export function awardMode(drop: Pick<Doc<'drops'>, 'conceptOnly'>, awardCents: number): 'concept' | 'sandbox' | 'transfer' {
  if (process.env.SIGNAL_REAL_PAYOUTS === 'on') {
    return awardCents > 0 && awardCents <= realPayoutCapCents() && awardCents <= realPayoutBudgetCents() ? 'transfer' : 'concept';
  }
  return !drop.conceptOnly && process.env.BOUNTY_MODE === 'sandbox' ? 'sandbox' : 'concept';
}

// The mode an award actually gets: a 'transfer' award that would push the cents already committed to real
// transfers past the budget stays concept. Waiting, sending and sent rows count. A failed row releases its cents
// only when Whop definitely refused it; retries_exhausted stays counted, since the last attempt may have landed.
export async function realBudgetCommittedCents(ctx: Pick<QueryCtx, 'db'>) {
  return (await ctx.db.query('bountyPayouts').collect())
    .filter((r) => r.status !== 'failed' || r.failureCode === 'retries_exhausted')
    .reduce((sum, r) => sum + r.cents, 0);
}

// What's left of SIGNAL_REAL_PAYOUT_BUDGET_CENTS, and no more than the cached Whop balance can pay with the fee;
// 0 when real payouts are off. Before the first balance read there is no cap; each transfer still checks the ledger.
export async function realBudgetRemainingCents(ctx: Pick<QueryCtx, 'db'>) {
  if (process.env.SIGNAL_REAL_PAYOUTS !== 'on') return 0;
  const budget = Math.max(0, realPayoutBudgetCents() - (await realBudgetCommittedCents(ctx)));
  const cached = await ctx.db.query('whopBalanceCache').first();
  return cached ? Math.min(budget, Math.max(0, Math.floor(cached.availableCents / (1 + TRANSFER_FEE_RATE)))) : budget;
}

// A drop hosted with payoutMode 'concept' never moves real money, even with real payouts on, and neither does an
// award whose per-player share is under Whop's $1 minimum.
export async function awardModeWithBudget(
  ctx: Pick<QueryCtx, 'db'>,
  drop: Pick<Doc<'drops'>, 'conceptOnly' | 'payoutMode'>,
  awardCents: number,
  perPlayerCents: number,
) {
  if (drop.payoutMode === 'concept') return 'concept';
  const mode = awardMode(drop, awardCents);
  if (mode !== 'transfer') return mode;
  if (perPlayerCents < MIN_TRANSFER_CENTS) return 'concept';
  return (await realBudgetCommittedCents(ctx)) + awardCents <= realPayoutBudgetCents() ? 'transfer' : 'concept';
}

async function queueTransfer(ctx: MutationCtx, payoutId: Id<'bountyPayouts'>, whopUserId: string) {
  await ctx.db.patch(payoutId, { status: 'sending', whopUserId, updatedAt: Date.now() });
  await ctx.scheduler.runAfter(0, internal.bounty.sendTransfer, { payoutId });
}

export const startTransfers = internalMutation({
  args: { awardId: v.id('bountyAwards') },
  handler: (ctx, { awardId }) => createTransferRows(ctx, awardId),
});

// Snapshots the squad into payout rows. The lock-in that awards calls this in the same transaction that
// inserts the award, so the rows reflect the squad at award time.
export async function createTransferRows(ctx: MutationCtx, awardId: Id<'bountyAwards'>) {
  const award = await ctx.db.get(awardId);
  if (!award || award.mode !== 'transfer' || award.perPlayerCents <= 0) return;
  const existing = await ctx.db
    .query('bountyPayouts')
    .withIndex('by_award', (q) => q.eq('awardId', awardId))
    .first();
  if (existing) return;
  const members = await ctx.db
    .query('members')
    .withIndex('by_room', (q) => q.eq('roomId', award.roomId))
    .collect();
  const hosted = await ctx.db
    .query('streamerDrops')
    .withIndex('by_drop', (q) => q.eq('dropId', award.dropId))
    .unique();
  for (const m of members) {
    const payoutId = await ctx.db.insert('bountyPayouts', {
      awardId,
      memberId: m._id,
      deviceToken: m.deviceToken,
      cents: award.perPlayerCents,
      status: 'sign_in_required',
      idempotencyKey: awardId + ':' + m._id,
      attempts: 0,
      updatedAt: Date.now(),
    });
    const identity = await ctx.db
      .query('identities')
      .withIndex('by_token', (q) => q.eq('deviceToken', m.deviceToken))
      .unique();
    if (identity) await queueTransfer(ctx, payoutId, identity.whopUserId);
    else if (hosted?.rehearsal) await releaseRows(ctx, [(await ctx.db.get(payoutId))!]);
  }
  await ctx.db.patch(awardId, { status: 'ready', label: TRANSFER_LABEL });
}

// An unclaimed share stops holding real budget: the row fails as sign_in_expired, which the budget doesn't count, and
// a later Whop sign-in no longer pays it.
async function releaseRows(ctx: MutationCtx, rows: Doc<'bountyPayouts'>[]) {
  let cents = 0;
  for (const row of rows) {
    if (row.status !== 'sign_in_required') continue;
    await ctx.db.patch(row._id, { status: 'failed', failureCode: 'sign_in_expired', error: 'Nobody signed in with Whop in time.', updatedAt: Date.now() });
    cents += row.cents;
  }
  return cents;
}

// ---------- Whop balance guard ----------

export const TRANSFER_FEE_RATE = 0.03;
export const BALANCE_REFRESH_MS = 60_000;
export const withFeeCents = (cents: number) => Math.ceil(cents * (1 + TRANSFER_FEE_RATE));

// The platform ledger's available USD balance in cents, or null when Whop can't be read.
async function readAvailableCents(apiKey: string, origin: string): Promise<number | null> {
  try {
    const response = await fetch(whopApiBase() + '/ledger_accounts/' + encodeURIComponent(origin), {
      headers: { Authorization: `Bearer ${apiKey}`, 'Api-Version-Date': WHOP_API_VERSION_DATE },
    });
    if (!response.ok) return null;
    const ledger = (await response.json()) as { balances?: { currency?: string; balance?: number }[] };
    const usd = ledger.balances?.find((b) => b.currency === 'usd');
    return typeof usd?.balance === 'number' ? Math.floor(usd.balance * 100) : null;
  } catch {
    return null;
  }
}

export const saveBalance = internalMutation({
  args: { availableCents: v.number() },
  handler: async (ctx, { availableCents }) => {
    const row = await ctx.db.query('whopBalanceCache').first();
    if (row) await ctx.db.patch(row._id, { availableCents, checkedAt: Date.now() });
    else await ctx.db.insert('whopBalanceCache', { availableCents, checkedAt: Date.now() });
  },
});

export const cachedBalance = internalQuery({ args: {}, handler: (ctx) => ctx.db.query('whopBalanceCache').first() });

// Cron, every minute while real payouts are on: refreshes the cached balance the host picker is capped by.
export const refreshBalance = internalAction({
  args: {},
  handler: async (ctx) => {
    const apiKey = process.env.WHOP_API_KEY;
    const origin = process.env.WHOP_ACCOUNT_ID;
    if (process.env.SIGNAL_REAL_PAYOUTS !== 'on' || !apiKey || !origin) return;
    const cached = await ctx.runQuery(internal.bounty.cachedBalance, {});
    if (cached && Date.now() - cached.checkedAt < BALANCE_REFRESH_MS) return;
    const availableCents = await readAvailableCents(apiKey, origin);
    if (availableCents !== null) await ctx.runMutation(internal.bounty.saveBalance, { availableCents });
  },
});

// Cron (no dropId): releases shares still waiting on a Whop sign-in SIGN_IN_RELEASE_MS after they were awarded.
// By hand (dropId): releases every waiting share of that drop now. Idempotent.
export const releaseUnclaimed = internalMutation({
  args: { dropId: v.optional(v.string()) },
  handler: async (ctx, { dropId }) => {
    let rows: Doc<'bountyPayouts'>[];
    if (dropId) {
      const awards = (await ctx.db.query('bountyAwards').collect()).filter((a) => a.dropId === dropId);
      rows = [];
      for (const award of awards) rows.push(...(await ctx.db.query('bountyPayouts').withIndex('by_award', (q) => q.eq('awardId', award._id)).collect()));
    } else {
      const cutoff = Date.now() - SIGN_IN_RELEASE_MS;
      rows = (await ctx.db.query('bountyPayouts').collect()).filter((r) => r.status === 'sign_in_required' && r.updatedAt <= cutoff);
    }
    const waiting = rows.filter((r) => r.status === 'sign_in_required');
    return { released: waiting.length, cents: await releaseRows(ctx, waiting) };
  },
});

// Called when a device links Whop: its waiting transfers go out to the account it just linked.
export async function releaseTransfersFor(ctx: MutationCtx, deviceToken: string, whopUserId: string) {
  const waiting = await ctx.db
    .query('bountyPayouts')
    .withIndex('by_token', (q) => q.eq('deviceToken', deviceToken).eq('status', 'sign_in_required'))
    .collect();
  for (const row of waiting) await queueTransfer(ctx, row._id, whopUserId);
}

export const transferForSend = internalMutation({
  args: { payoutId: v.id('bountyPayouts') },
  handler: async (ctx, { payoutId }) => {
    const row = await ctx.db.get(payoutId);
    if (!row || row.status !== 'sending' || !row.whopUserId) return null;
    await ctx.db.patch(payoutId, { attempts: row.attempts + 1, updatedAt: Date.now() });
    return { cents: row.cents, whopUserId: row.whopUserId, idempotencyKey: row.idempotencyKey, attempt: row.attempts + 1 };
  },
});

export const recordTransfer = internalMutation({
  args: {
    payoutId: v.id('bountyPayouts'),
    status: v.union(v.literal('sent'), v.literal('failed')),
    transferId: v.optional(v.string()),
    transferStatus: v.optional(v.string()),
    failureCode: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, { payoutId, ...result }) => {
    const row = await ctx.db.get(payoutId);
    if (row?.status === 'sending') await ctx.db.patch(payoutId, { ...result, updatedAt: Date.now() });
  },
});

export function transferFailureCode(status: number, body: string): string {
  if (/verif/i.test(body)) return 'kyc_required';
  try {
    const parsed = JSON.parse(body) as { error?: { code?: string; type?: string } | string; code?: string };
    const code = typeof parsed.error === 'object' ? (parsed.error.code ?? parsed.error.type) : parsed.code;
    if (code) return code;
  } catch {
    // not JSON
  }
  return status === 402 ? 'insufficient_funds' : 'unknown';
}

export const sendTransfer = internalAction({
  args: { payoutId: v.id('bountyPayouts') },
  handler: async (ctx, { payoutId }) => {
    const job = await ctx.runMutation(internal.bounty.transferForSend, { payoutId });
    if (!job) return;
    if (job.cents < MIN_TRANSFER_CENTS) {
      await ctx.runMutation(internal.bounty.recordTransfer, { payoutId, status: 'failed', failureCode: 'below_minimum' });
      return;
    }
    const retry = async () => {
      if (job.attempt >= MAX_TRANSFER_ATTEMPTS) {
        await ctx.runMutation(internal.bounty.recordTransfer, { payoutId, status: 'failed', failureCode: 'retries_exhausted' });
      } else {
        await ctx.scheduler.runAfter(2 ** job.attempt * 1000, internal.bounty.sendTransfer, { payoutId });
      }
    };
    const apiKey = process.env.WHOP_API_KEY;
    const origin = process.env.WHOP_ACCOUNT_ID;
    if (!apiKey || !origin) {
      await ctx.runMutation(internal.bounty.recordTransfer, { payoutId, status: 'failed', failureCode: 'whop_not_configured' });
      return;
    }
    // A transfer Whop refuses for funds risks a fraud hold, so the ledger must cover amount plus fee first.
    const availableCents = await readAvailableCents(apiKey, origin);
    if (availableCents === null) {
      await retry();
      return;
    }
    await ctx.runMutation(internal.bounty.saveBalance, { availableCents });
    if (availableCents < withFeeCents(job.cents)) {
      console.warn('REAL_FUNDS_LOW', { payoutId, cents: job.cents, availableCents });
      await ctx.runMutation(internal.bounty.recordTransfer, { payoutId, status: 'failed', failureCode: 'REAL_FUNDS_LOW', error: `Whop balance ${availableCents}¢ is under ${withFeeCents(job.cents)}¢ with the fee.` });
      return;
    }
    let response: Response;
    try {
      response = await fetch(whopApiBase() + '/transfers', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Api-Version-Date': WHOP_TRANSFER_API_VERSION_DATE,
          'Content-Type': 'application/json',
          'Idempotency-Key': job.idempotencyKey,
        },
        body: JSON.stringify({
          type: 'balance',
          amount: job.cents / 100,
          currency: 'usd',
          origin_id: origin,
          destination_id: job.whopUserId,
          idempotence_key: job.idempotencyKey,
        }),
      });
    } catch {
      await retry();
      return;
    }
    if (response.status === 429 || response.status >= 500) {
      await retry();
      return;
    }
    const body = await response.text();
    if (!response.ok) {
      await ctx.runMutation(internal.bounty.recordTransfer, {
        payoutId,
        status: 'failed',
        failureCode: transferFailureCode(response.status, body),
        error: `Whop returned ${response.status}: ${body.slice(0, 300)}`,
      });
      return;
    }
    // status is the source of truth: succeeded_at can be null on a succeeded transfer, and fee is null on create
    // (it only appears on a later GET or the webhook), so neither is read here.
    const transfer = JSON.parse(body) as { id?: string; status?: string | null };
    const status = transfer.status ?? undefined;
    if (status && FAILED_TRANSFER_STATUSES.has(status)) {
      await ctx.runMutation(internal.bounty.recordTransfer, { payoutId, status: 'failed', transferId: transfer.id, transferStatus: status, failureCode: 'transfer_' + status });
      return;
    }
    await ctx.runMutation(internal.bounty.recordTransfer, { payoutId, status: 'sent', transferId: transfer.id, ...(status ? { transferStatus: status } : {}) });
  },
});
