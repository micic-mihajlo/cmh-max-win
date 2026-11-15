import { Presence } from '@convex-dev/presence';
import { v } from 'convex/values';

import { components } from './_generated/api';
import { mutation, query } from './_generated/server';

// Wrappers for @convex-dev/presence. The RN hook calls these by name (presence:heartbeat/list/disconnect).
// The client passes the room code as roomId and its device token as userId; the server swaps the token for
// the member id, so presence only ever publishes member ids and a device can only beat for its own seat.
export const presence = new Presence(components.presence);

export const heartbeat = mutation({
  args: { roomId: v.string(), userId: v.string(), sessionId: v.string(), interval: v.number() },
  handler: async (ctx, { roomId, userId, sessionId, interval }) => {
    const room = roomId
      ? await ctx.db
          .query('rooms')
          .withIndex('by_code', (q) => q.eq('code', roomId.trim().toUpperCase()))
          .unique()
      : null;
    const member =
      room && userId
        ? await ctx.db
            .query('members')
            .withIndex('by_room_token', (q) => q.eq('roomId', room._id).eq('deviceToken', userId))
            .unique()
        : null;
    if (!room || !member) return { roomToken: '', sessionToken: '' };
    return presence.heartbeat(ctx, room.code, member._id, sessionId, interval);
  },
});

export const list = query({
  args: { roomToken: v.string() },
  handler: async (ctx, { roomToken }) => (roomToken ? presence.list(ctx, roomToken) : []),
});

export const disconnect = mutation({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    if (sessionToken) await presence.disconnect(ctx, sessionToken);
    return null;
  },
});
