import { ConvexError, v } from 'convex/values';

import { mutation } from './_generated/server';
import { insertDrop, startDropNow } from './drops';
import { squadSize } from './schema';

// Dev-only demo controls for the playtest and video threads. Public, so they work from the app without CLI
// access, but every call refuses unless the deployment env var SIGNAL_DEMO_CONTROLS is 'on' (set on dev only).
function requireDemoControls() {
  if (process.env.SIGNAL_DEMO_CONTROLS !== 'on') {
    throw new ConvexError({ code: 'DEMO_CONTROLS_OFF', message: 'Demo controls are off on this deployment.' });
  }
}

// Public, so the bounty is capped at the video's $300: no client can open a bigger sandbox payout.
const DEMO_MAX_CENTS = 30_000;

// Creates a fresh drop whose squads are all exactly squadSize (leftover entrants are unmatched).
export const openDrop = mutation({
  args: {
    squadSize,
    startInSeconds: v.optional(v.number()),
    winnerSlots: v.optional(v.number()),
    totalCents: v.optional(v.number()),
    title: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    requireDemoControls();
    const dropId = `demo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    return insertDrop(ctx, {
      dropId,
      title: args.title ?? 'The Aurora Seed',
      creatorName: 'SIGNAL',
      squadSize: args.squadSize,
      strictSquadSize: true,
      startsAt: Date.now() + Math.max(0, args.startInSeconds ?? 120) * 1000,
      bounty: { totalCents: Math.min(args.totalCents ?? DEMO_MAX_CENTS, DEMO_MAX_CENTS), winnerSlots: args.winnerSlots ?? 3 },
    });
  },
});

export const startNow = mutation({
  args: { dropId: v.string() },
  handler: async (ctx, { dropId }) => {
    requireDemoControls();
    const drop = await ctx.db
      .query('drops')
      .withIndex('by_dropId', (q) => q.eq('dropId', dropId))
      .unique();
    if (drop && !(drop.dropId.startsWith('demo-') && drop.strictSquadSize)) {
      throw new ConvexError({ code: 'WRONG_STATUS', message: 'demo:startNow only starts drops made by demo:openDrop.' });
    }
    await startDropNow(ctx, dropId);
  },
});
