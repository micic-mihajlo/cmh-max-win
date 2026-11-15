import { v } from 'convex/values';

import { query, type QueryCtx } from './_generated/server';

// Creator handles: one normalization and one rule set, shared by saveCreatorProfile, checkHandle and lookups.
// Stored without the '@', shown with it.

export const RESERVED_HANDLES = new Set([
  'about', 'account', 'admin', 'administrator', 'anonymous', 'api', 'app', 'billing', 'challenge', 'challenges',
  'creator', 'creators', 'drop', 'drops', 'everyone', 'explore', 'feed', 'guest', 'help', 'here', 'home', 'host',
  'kick', 'login', 'logout', 'me', 'mod', 'moderator', 'mods', 'null', 'official', 'payouts', 'privacy', 'prize',
  'root', 'search', 'security', 'settings', 'signal', 'signin', 'signup', 'staff', 'studio', 'support', 'system',
  'team', 'terms', 'test', 'twitch', 'undefined', 'whop', 'www', 'you', 'youtube',
]);

// '  @Ｎｏｖａ ' -> 'nova': NFKC folds full-width and compatibility forms, then trim, drop leading '@'s, lowercase.
export function normalizeHandle(raw: string) {
  return raw.normalize('NFKC').trim().replace(/^@+/, '').toLowerCase();
}

// Why a normalized handle can't be used, or null. Reserved words also match with underscores removed (s_i_g_n_a_l).
export function handleProblem(handle: string): string | null {
  if (!/^[a-z0-9_]{2,20}$/.test(handle)) return 'Handles are 2 to 20 letters, numbers or underscores.';
  if (RESERVED_HANDLES.has(handle) || RESERVED_HANDLES.has(handle.replace(/_/g, ''))) return 'That handle is reserved.';
  return null;
}

export function findCreatorByHandle(ctx: QueryCtx, raw: string) {
  return ctx.db
    .query('creators')
    .withIndex('by_handle', (q) => q.eq('handle', normalizeHandle(raw)))
    .first();
}

// Live check for the handle field. available is false when it's invalid, reserved, or another device holds it.
export const checkHandle = query({
  args: { deviceToken: v.optional(v.string()), handle: v.string() },
  handler: async (ctx, { deviceToken, handle }) => {
    const normalized = normalizeHandle(handle);
    const problem = handleProblem(normalized);
    if (problem) return { handle: normalized, available: false, problem };
    const holder = await findCreatorByHandle(ctx, normalized);
    const taken = !!holder && holder.deviceToken !== deviceToken;
    return { handle: normalized, available: !taken, problem: taken ? 'That handle is taken.' : null };
  },
});
