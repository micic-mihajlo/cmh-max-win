import { ConvexError, v } from 'convex/values';

import { internal } from './_generated/api';
import { action, internalMutation, internalQuery, mutation, query, type QueryCtx } from './_generated/server';
import { checkWhopAccess, resolveIdentity } from './whopAuth';

import type { CreatorWhopView } from '../src/lib/contract-whop';

// A creator connects the Whop business they run challenges for. Signing in with Whop (whopAuth.startSignIn with
// no claimCode) proves who they are; Whop's access check proves they admin the company before it is stored.

async function creatorFor(ctx: Pick<QueryCtx, 'db'>, deviceToken: string) {
  return ctx.db
    .query('creators')
    .withIndex('by_token', (q) => q.eq('deviceToken', deviceToken))
    .first();
}

export const creatorWhop = query({
  args: { deviceToken: v.string() },
  handler: async (ctx, { deviceToken }): Promise<CreatorWhopView | null> => {
    const creator = await creatorFor(ctx, deviceToken);
    if (!creator) return null;
    const identity = await ctx.db
      .query('identities')
      .withIndex('by_token', (q) => q.eq('deviceToken', deviceToken))
      .unique();
    return {
      signInAvailable: Boolean(process.env.WHOP_OAUTH_CLIENT_ID),
      whopUserId: identity?.whopUserId ?? null,
      whopName: identity?.name ?? null,
      companyId: creator.whopCompanyId ?? null,
    };
  },
});

export const connectGate = internalQuery({
  args: { deviceToken: v.string() },
  handler: async (ctx, { deviceToken }) => {
    const creator = await creatorFor(ctx, deviceToken);
    if (!creator) return null;
    return { creatorId: creator._id, whopUserId: (await resolveIdentity(ctx, deviceToken)).whopUserId ?? null };
  },
});

export const connectWhopCompany = action({
  args: { deviceToken: v.string(), companyId: v.string() },
  handler: async (ctx, { deviceToken, companyId }): Promise<{ companyId: string }> => {
    const id = companyId.trim();
    if (!/^biz_[A-Za-z0-9]+$/.test(id)) {
      throw new ConvexError({ code: 'INVALID_CONFIG', message: 'A Whop company id starts with biz_.' });
    }
    const gate = await ctx.runQuery(internal.whopCreator.connectGate, { deviceToken });
    if (!gate) throw new ConvexError({ code: 'NO_PROFILE', message: 'Save a creator profile first.' });
    if (!gate.whopUserId) throw new ConvexError({ code: 'WHOP_SIGN_IN_REQUIRED', message: 'Sign in with Whop first.' });
    const { accessLevel } = await checkWhopAccess(gate.whopUserId, id);
    if (accessLevel !== 'admin') {
      throw new ConvexError({ code: 'NOT_WHOP_ADMIN', message: 'Your Whop account is not an admin of that company.' });
    }
    await ctx.runMutation(internal.whopCreator.saveCompany, { creatorId: gate.creatorId, companyId: id });
    return { companyId: id };
  },
});

export const saveCompany = internalMutation({
  args: { creatorId: v.id('creators'), companyId: v.string() },
  handler: async (ctx, { creatorId, companyId }) => {
    await ctx.db.patch(creatorId, { whopCompanyId: companyId });
  },
});

export const disconnectWhopCompany = mutation({
  args: { deviceToken: v.string() },
  handler: async (ctx, { deviceToken }) => {
    const creator = await creatorFor(ctx, deviceToken);
    if (creator?.whopCompanyId) await ctx.db.patch(creator._id, { whopCompanyId: undefined });
  },
});
