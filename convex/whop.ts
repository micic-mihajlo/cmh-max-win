import { ConvexError, v } from 'convex/values';

import { internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { action, internalMutation, query } from './_generated/server';

const API_VERSION_DATE = '2026-11-04-1';
const packValidator = v.literal('season01');

export type WhopPayment = {
  id: string;
  status: string;
  variant_id: string | null;
  checkout_configuration_id: string | null;
  metadata: Record<string, unknown> | null;
};

export function whopEnvironment(): 'sandbox' | 'production' {
  return process.env.WHOP_ENVIRONMENT === 'production' ? 'production' : 'sandbox';
}

export async function whopRequest<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const apiKey = process.env.WHOP_API_KEY;
  if (!apiKey) {
    throw new ConvexError({ code: 'WHOP_NOT_CONFIGURED', message: 'Whop is not configured on this deployment.' });
  }
  const base = whopEnvironment() === 'production' ? 'https://api.whop.com/api/v1' : 'https://sandbox-api.whop.com/api/v1';
  const response = await fetch(base + path, {
    method: init.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Api-Version-Date': API_VERSION_DATE,
      'Content-Type': 'application/json',
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  if (!response.ok) {
    throw new ConvexError({ code: 'WHOP_REQUEST_FAILED', message: `Whop returned ${response.status} for ${path}` });
  }
  return (await response.json()) as T;
}

export const createCheckout = action({
  args: { deviceToken: v.string(), pack: packValidator },
  returns: v.object({ purchaseUrl: v.string() }),
  handler: async (ctx, { deviceToken, pack }): Promise<{ purchaseUrl: string }> => {
    const accountId = process.env.WHOP_ACCOUNT_ID;
    const variantId = process.env.WHOP_VARIANT_ID;
    if (!accountId || !variantId) {
      throw new ConvexError({ code: 'WHOP_NOT_CONFIGURED', message: 'Whop is not configured on this deployment.' });
    }
    const checkoutId: Id<'whopCheckouts'> = await ctx.runMutation(internal.whop.startCheckout, { deviceToken, pack });
    const config: { id: string; purchase_url: string } = await whopRequest('/checkout_configurations', {
      method: 'POST',
      body: {
        account_id: accountId,
        variant_id: variantId,
        metadata: { checkoutId, pack },
        redirect_url: `${process.env.CONVEX_SITE_URL}/whop/return`,
      },
    });
    await ctx.runMutation(internal.whop.attachCheckoutConfig, { checkoutId, checkoutConfigId: config.id });
    return { purchaseUrl: config.purchase_url };
  },
});

export const startCheckout = internalMutation({
  args: { deviceToken: v.string(), pack: packValidator },
  returns: v.id('whopCheckouts'),
  handler: (ctx, { deviceToken, pack }) => ctx.db.insert('whopCheckouts', { deviceToken, pack, createdAt: Date.now() }),
});

export const attachCheckoutConfig = internalMutation({
  args: { checkoutId: v.id('whopCheckouts'), checkoutConfigId: v.string() },
  returns: v.null(),
  handler: async (ctx, { checkoutId, checkoutConfigId }) => {
    await ctx.db.patch(checkoutId, { checkoutConfigId });
    return null;
  },
});

export const grantFromPayment = internalMutation({
  args: { checkoutId: v.string(), checkoutConfigId: v.union(v.string(), v.null()), whopPaymentId: v.string() },
  returns: v.union(v.literal('granted'), v.literal('duplicate'), v.literal('unknown_checkout')),
  handler: async (ctx, { checkoutId, checkoutConfigId, whopPaymentId }) => {
    const existing = await ctx.db
      .query('entitlements')
      .withIndex('by_payment', (q) => q.eq('whopPaymentId', whopPaymentId))
      .first();
    if (existing) return 'duplicate';
    const id = ctx.db.normalizeId('whopCheckouts', checkoutId);
    const checkout = id ? await ctx.db.get(id) : null;
    if (!checkout || !checkout.checkoutConfigId || checkout.checkoutConfigId !== checkoutConfigId) {
      return 'unknown_checkout';
    }
    await ctx.db.insert('entitlements', {
      deviceToken: checkout.deviceToken,
      pack: checkout.pack,
      source: 'whop',
      environment: whopEnvironment(),
      whopPaymentId,
      verifiedAt: Date.now(),
    });
    return 'granted';
  },
});

export const myEntitlements = query({
  args: { deviceToken: v.string() },
  returns: v.array(
    v.object({
      pack: packValidator,
      environment: v.union(v.literal('sandbox'), v.literal('production')),
      verifiedAt: v.number(),
    }),
  ),
  handler: async (ctx, { deviceToken }) => {
    const rows = await ctx.db
      .query('entitlements')
      .withIndex('by_token', (q) => q.eq('deviceToken', deviceToken))
      .collect();
    return rows.map(({ pack, environment, verifiedAt }) => ({ pack, environment, verifiedAt }));
  },
});
