import { ConvexError, v } from 'convex/values';

import { internal } from './_generated/api';
import { internalAction, internalMutation, mutation } from './_generated/server';

// Expo push tokens per device, and the one action that talks to Expo's push API. Messages are built and deduped
// in feed.ts (queuePush); this file only delivers them and drops tokens Expo reports as gone.

export const EXPO_SEND_URL = 'https://exp.host/--/api/v2/push/send';
export const EXPO_RECEIPTS_URL = 'https://exp.host/--/api/v2/push/getReceipts';
export const RECEIPT_DELAY_MS = 15 * 60 * 1000; // Expo has receipts ready within about 15 minutes
const SEND_CHUNK = 100;
const RECEIPT_CHUNK = 1000;
const TOKEN_PATTERN = /^(ExponentPushToken|ExpoPushToken)\[[^\]]+\]$/;

export const registerPushToken = mutation({
  args: { deviceToken: v.string(), token: v.string(), platform: v.union(v.literal('ios'), v.literal('android')) },
  handler: async (ctx, { deviceToken, token, platform }) => {
    if (!deviceToken) throw new ConvexError({ code: 'WRONG_STATUS', message: 'Missing device token.' });
    if (!TOKEN_PATTERN.test(token)) throw new ConvexError({ code: 'WRONG_STATUS', message: 'Not an Expo push token.' });
    // A reinstall can hand the same push token to a new device token; it belongs to the newest one only.
    for (const other of await ctx.db
      .query('pushTokens')
      .withIndex('by_token', (q) => q.eq('token', token))
      .collect()) {
      if (other.deviceToken !== deviceToken) await ctx.db.delete(other._id);
    }
    const [mine, ...extra] = await ctx.db
      .query('pushTokens')
      .withIndex('by_device', (q) => q.eq('deviceToken', deviceToken))
      .collect();
    for (const row of extra) await ctx.db.delete(row._id);
    if (mine) await ctx.db.patch(mine._id, { token, platform, updatedAt: Date.now() });
    else await ctx.db.insert('pushTokens', { deviceToken, token, platform, updatedAt: Date.now() });
  },
});

export const removePushToken = mutation({
  args: { deviceToken: v.string() },
  handler: async (ctx, { deviceToken }) => {
    for (const row of await ctx.db
      .query('pushTokens')
      .withIndex('by_device', (q) => q.eq('deviceToken', deviceToken))
      .collect()) {
      await ctx.db.delete(row._id);
    }
  },
});

export const removeTokens = internalMutation({
  args: { tokens: v.array(v.string()) },
  handler: async (ctx, { tokens }) => {
    for (const token of tokens) {
      for (const row of await ctx.db
        .query('pushTokens')
        .withIndex('by_token', (q) => q.eq('token', token))
        .collect()) {
        await ctx.db.delete(row._id);
      }
    }
  },
});

function expoHeaders(): Record<string, string> {
  const headers: Record<string, string> = { Accept: 'application/json', 'Content-Type': 'application/json' };
  if (process.env.EXPO_ACCESS_TOKEN) headers.Authorization = `Bearer ${process.env.EXPO_ACCESS_TOKEN}`;
  return headers;
}

type ExpoTicket = { status: 'ok'; id: string } | { status: 'error'; message?: string; details?: { error?: string } };
type ExpoReceipt = { status: 'ok' } | { status: 'error'; message?: string; details?: { error?: string } };

const pushData = v.object({
  kind: v.union(v.literal('live'), v.literal('starting')),
  dropId: v.string(),
  joinCode: v.string(),
  streamerId: v.string(),
});

export const send = internalAction({
  args: { messages: v.array(v.object({ to: v.string(), title: v.string(), body: v.string(), data: pushData })) },
  handler: async (ctx, { messages }) => {
    const tickets: { id: string; token: string }[] = [];
    const gone: string[] = [];
    for (let i = 0; i < messages.length; i += SEND_CHUNK) {
      const chunk = messages.slice(i, i + SEND_CHUNK);
      try {
        const response = await fetch(EXPO_SEND_URL, {
          method: 'POST',
          headers: expoHeaders(),
          body: JSON.stringify(chunk.map((m) => ({ ...m, sound: 'default' }))),
        });
        if (!response.ok) {
          console.warn(`Expo push send returned ${response.status}`);
          continue;
        }
        const { data } = (await response.json()) as { data: ExpoTicket[] };
        data.forEach((ticket, j) => {
          if (ticket.status === 'ok') tickets.push({ id: ticket.id, token: chunk[j].to });
          else if (ticket.details?.error === 'DeviceNotRegistered') gone.push(chunk[j].to);
        });
      } catch (error) {
        console.warn('Expo push send failed', String(error));
      }
    }
    if (gone.length) await ctx.runMutation(internal.push.removeTokens, { tokens: gone });
    if (tickets.length) await ctx.scheduler.runAfter(RECEIPT_DELAY_MS, internal.push.checkReceipts, { tickets });
    return { sent: tickets.length, removed: gone.length };
  },
});

export const checkReceipts = internalAction({
  args: { tickets: v.array(v.object({ id: v.string(), token: v.string() })) },
  handler: async (ctx, { tickets }) => {
    const gone: string[] = [];
    for (let i = 0; i < tickets.length; i += RECEIPT_CHUNK) {
      const chunk = tickets.slice(i, i + RECEIPT_CHUNK);
      try {
        const response = await fetch(EXPO_RECEIPTS_URL, {
          method: 'POST',
          headers: expoHeaders(),
          body: JSON.stringify({ ids: chunk.map((t) => t.id) }),
        });
        if (!response.ok) {
          console.warn(`Expo push receipts returned ${response.status}`);
          continue;
        }
        const { data } = (await response.json()) as { data: Record<string, ExpoReceipt> };
        for (const t of chunk) {
          const receipt = data[t.id];
          if (receipt?.status === 'error' && receipt.details?.error === 'DeviceNotRegistered') gone.push(t.token);
        }
      } catch (error) {
        console.warn('Expo push receipts failed', String(error));
      }
    }
    if (gone.length) await ctx.runMutation(internal.push.removeTokens, { tokens: gone });
    return { removed: gone.length };
  },
});
