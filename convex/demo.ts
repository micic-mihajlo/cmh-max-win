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
    const dropId = `demo-${Date.now().toString(36)}-${Math.floor(Math.random() * 1296).toString(36)}`;
    await insertDrop(ctx, {
      dropId,
      title: args.title ?? 'The Aurora Seed',
      creatorName: 'SIGNAL',
      squadSize: args.squadSize,
      strictSquadSize: true,
      startsAt: Date.now() + Math.max(0, args.startInSeconds ?? 120) * 1000,
      bounty: { totalCents: args.totalCents ?? 30_000, winnerSlots: args.winnerSlots ?? 3 },
    });
    return { dropId };
  },
});

export const startNow = mutation({
  args: { dropId: v.string() },
  handler: async (ctx, { dropId }) => {
    requireDemoControls();
    await startDropNow(ctx, dropId);
  },
});
