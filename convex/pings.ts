import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

export const count = query({
  args: {},
  handler: async (ctx) => (await ctx.db.query('pings').collect()).length,
});

export const send = mutation({
  args: { source: v.string() },
  handler: async (ctx, { source }) => {
    await ctx.db.insert('pings', { source });
  },
});
