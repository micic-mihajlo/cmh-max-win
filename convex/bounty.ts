import { ConvexError, v } from 'convex/values';

import { internal } from './_generated/api';
import { internalAction, internalMutation } from './_generated/server';
import { whopEnvironment, whopRequest } from './whop';

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

async function createSandboxClaimLink(args: { amountCents: number; redeemableCount: number; idempotencyKey: string }) {
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
  args: { awardId: v.id('bountyAwards'), perPlayerCents: v.number(), redeemableCount: v.number() },
  handler: async (ctx, { awardId, perPlayerCents, redeemableCount }) => {
    if (process.env.BOUNTY_MODE !== 'sandbox') {
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
