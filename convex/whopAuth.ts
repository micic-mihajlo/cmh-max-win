import { ConvexError, v } from 'convex/values';

import { internal } from './_generated/api';
import {
  action,
  httpAction,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
  type ActionCtx,
  type MutationCtx,
  type QueryCtx,
} from './_generated/server';
import { releaseTransfersFor } from './bounty';
import { whopApiBase, whopEnvironment, whopRequest } from './whop';

const SESSION_TTL_MS = 10 * 60 * 1000;
const DEFAULT_RETURN_URL = 'cmhmaxwin://whop-auth';
const RETURN_URL_PREFIXES = ['cmhmaxwin://', 'exp://', 'exps://', 'https://signal-app-wine.vercel.app/'];

export type ResolvedIdentity = { deviceToken: string; whopUserId?: string; name?: string };

export async function resolveIdentity(ctx: Pick<QueryCtx, 'db'>, deviceToken: string): Promise<ResolvedIdentity> {
  const identity = await ctx.db
    .query('identities')
    .withIndex('by_token', (q) => q.eq('deviceToken', deviceToken))
    .unique();
  return identity ? { deviceToken, whopUserId: identity.whopUserId, name: identity.name } : { deviceToken };
}

export async function checkWhopAccess(
  whopUserId: string,
  resourceId: string,
): Promise<{ hasAccess: boolean; accessLevel: string }> {
  const result = await whopRequest<{ has_access: boolean; access_level: string }>(
    `/users/${encodeURIComponent(whopUserId)}/access/${encodeURIComponent(resourceId)}`,
  );
  return { hasAccess: result.has_access, accessLevel: result.access_level };
}

function oauthBase(): string {
  return whopEnvironment() === 'production' ? 'https://api.whop.com/oauth' : 'https://sandbox-api.whop.com/oauth';
}

function redirectUri(): string {
  return process.env.WHOP_OAUTH_REDIRECT_URI ?? `${process.env.CONVEX_SITE_URL}/whop/oauth/callback`;
}

function base64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function randomString(): string {
  return base64Url(crypto.getRandomValues(new Uint8Array(32)));
}

type TokenResponse = { access_token: string; refresh_token?: string; expires_in?: number };
type WhopUser = { id: string; name: string | null; username: string | null; profile_picture?: { url?: string } | null };

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const clientSecret = process.env.WHOP_OAUTH_CLIENT_SECRET;
  const response = await fetch(`${oauthBase()}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, client_id: process.env.WHOP_OAUTH_CLIENT_ID, ...(clientSecret ? { client_secret: clientSecret } : {}) }),
  });
  if (!response.ok) throw new ConvexError({ code: 'WHOP_TOKEN_FAILED', message: `Whop token endpoint returned ${response.status}` });
  return (await response.json()) as TokenResponse;
}

async function fetchMe(accessToken: string): Promise<WhopUser> {
  const response = await fetch(`${whopApiBase()}/users/me`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) throw new ConvexError({ code: 'WHOP_USER_FAILED', message: `Whop /users/me returned ${response.status}` });
  return (await response.json()) as WhopUser;
}

function profile(user: WhopUser) {
  return {
    whopUserId: user.id,
    name: user.name || user.username || 'Whop member',
    username: user.username ?? undefined,
    avatarUrl: user.profile_picture?.url ?? undefined,
  };
}

function tokenFields(tokens: TokenResponse) {
  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: Date.now() + (tokens.expires_in ?? 3600) * 1000,
  };
}

export const account = query({
  args: { deviceToken: v.string() },
  handler: async (ctx, { deviceToken }) => {
    const identity = await ctx.db
      .query('identities')
      .withIndex('by_token', (q) => q.eq('deviceToken', deviceToken))
      .unique();
    return {
      available: Boolean(process.env.WHOP_OAUTH_CLIENT_ID),
      account: identity
        ? {
            whopUserId: identity.whopUserId,
            name: identity.name,
            username: identity.username ?? null,
            avatarUrl: identity.avatarUrl ?? null,
            environment: identity.environment,
          }
        : null,
    };
  },
});

export const isWinningSeat = internalQuery({
  args: { deviceToken: v.string(), claimCode: v.string() },
  handler: async (ctx, { deviceToken, claimCode }) => {
    const room = await ctx.db
      .query('rooms')
      .withIndex('by_code', (q) => q.eq('code', claimCode.trim().toUpperCase()))
      .unique();
    if (room?.challengeId) {
      const payout = await ctx.db
        .query('payouts')
        .withIndex('by_challenge_token', (q) => q.eq('challengeId', room.challengeId!).eq('deviceToken', deviceToken))
        .first();
      return payout !== null;
    }
    if (!room?.dropId) return false;
    const [member, award] = await Promise.all([
      ctx.db
        .query('members')
        .withIndex('by_room_token', (q) => q.eq('roomId', room._id).eq('deviceToken', deviceToken))
        .unique(),
      ctx.db
        .query('bountyAwards')
        .withIndex('by_room', (q) => q.eq('roomId', room._id))
        .unique(),
    ]);
    return member !== null && award !== null;
  },
});

// Join-purpose sign-in: only for an open challenge that needs a Whop account to join (members-only or requireWhopToJoin).
export const joinNeedsWhop = internalQuery({
  args: { challengeCode: v.string() },
  handler: async (ctx, { challengeCode }) => {
    const matches = await ctx.db
      .query('challenges')
      .withIndex('by_joinCode', (q) => q.eq('joinCode', challengeCode.trim().toUpperCase()))
      .collect();
    const open = matches.find((c) => c.status === 'published' || c.status === 'live');
    return !!open && (open.config.requireWhopToJoin || open.config.eligibility.kind === 'whop_members');
  },
});

export const isCreator = internalQuery({
  args: { deviceToken: v.string() },
  handler: async (ctx, { deviceToken }) =>
    (await ctx.db
      .query('creators')
      .withIndex('by_token', (q) => q.eq('deviceToken', deviceToken))
      .first()) !== null,
});

// Two ways in: a device holding a winning seat (claimCode is its squad or team room code), or a creator
// (no claimCode, the device has a creator profile). Nobody else gets Whop sign-in, except to join or host.
export const startSignIn = action({
  // purpose 'join' (with challengeCode): sign in to join a challenge that requires Whop. purpose 'host': any device
  // signs in to host drops from it (drops:isDropHost). Otherwise, as before: claimCode for a winning seat, or neither
  // for a creator.
  args: {
    deviceToken: v.string(),
    claimCode: v.optional(v.string()),
    returnUrl: v.optional(v.string()),
    purpose: v.optional(v.union(v.literal('join'), v.literal('host'))),
    challengeCode: v.optional(v.string()),
  },
  handler: async (
    ctx,
    { deviceToken, claimCode, returnUrl, purpose, challengeCode },
  ): Promise<{ url: string; reason: null } | { url: null; reason: 'unavailable' | 'not_winner' | 'no_profile' | 'not_required' }> => {
    const clientId = process.env.WHOP_OAUTH_CLIENT_ID;
    if (!clientId) return { url: null, reason: 'unavailable' };
    if (purpose === 'host') {
      // Any device may host, so there is nothing to gate.
    } else if (purpose === 'join') {
      if (!challengeCode || !(await ctx.runQuery(internal.whopAuth.joinNeedsWhop, { challengeCode }))) return { url: null, reason: 'not_required' };
    } else if (claimCode === undefined) {
      if (!(await ctx.runQuery(internal.whopAuth.isCreator, { deviceToken }))) return { url: null, reason: 'no_profile' };
    } else if (!(await ctx.runQuery(internal.whopAuth.isWinningSeat, { deviceToken, claimCode }))) {
      return { url: null, reason: 'not_winner' };
    }
    const state = randomString();
    const codeVerifier = randomString();
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier));
    const safeReturnUrl = returnUrl && RETURN_URL_PREFIXES.some((p) => returnUrl.startsWith(p)) ? returnUrl : DEFAULT_RETURN_URL;
    await ctx.runMutation(internal.whopAuth.createSession, { state, deviceToken, codeVerifier, returnUrl: safeReturnUrl });
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri(),
      scope: 'openid profile',
      state,
      nonce: randomString(),
      code_challenge: base64Url(new Uint8Array(digest)),
      code_challenge_method: 'S256',
    });
    return { url: `${oauthBase()}/authorize?${params}`, reason: null };
  },
});

export const signOut = mutation({
  args: { deviceToken: v.string() },
  handler: async (ctx, { deviceToken }) => {
    const identity = await ctx.db
      .query('identities')
      .withIndex('by_token', (q) => q.eq('deviceToken', deviceToken))
      .unique();
    if (!identity) return;
    await ctx.db.delete(identity._id);
    const otherDevice = await ctx.db
      .query('identities')
      .withIndex('by_whop_user', (q) => q.eq('whopUserId', identity.whopUserId))
      .first();
    if (otherDevice) return;
    const tokens = await ctx.db
      .query('whopOAuthTokens')
      .withIndex('by_whop_user', (q) => q.eq('whopUserId', identity.whopUserId))
      .unique();
    if (tokens) await ctx.db.delete(tokens._id);
  },
});

export const refreshAccount = action({
  args: { deviceToken: v.string() },
  handler: async (ctx, { deviceToken }) => {
    const whopUserId = await ctx.runQuery(internal.whopAuth.linkedWhopUser, { deviceToken });
    if (!whopUserId) return;
    const accessToken = await whopUserToken(ctx, whopUserId);
    const user = await fetchMe(accessToken);
    await ctx.runMutation(internal.whopAuth.updateProfile, { deviceToken, ...profile(user) });
  },
});

export const checkAccess = internalAction({
  args: { whopUserId: v.string(), resourceId: v.string() },
  handler: (_ctx, { whopUserId, resourceId }) => checkWhopAccess(whopUserId, resourceId),
});

export async function whopUserToken(ctx: ActionCtx, whopUserId: string): Promise<string> {
  const stored = await ctx.runQuery(internal.whopAuth.storedTokens, { whopUserId });
  if (!stored) throw new ConvexError({ code: 'WHOP_NOT_LINKED', message: 'No Whop sign-in for this user.' });
  if (stored.expiresAt > Date.now() + 60_000) return stored.accessToken;
  if (!stored.refreshToken) throw new ConvexError({ code: 'WHOP_SIGN_IN_EXPIRED', message: 'Sign in with Whop again.' });
  const tokens = await tokenRequest({ grant_type: 'refresh_token', refresh_token: stored.refreshToken });
  await ctx.runMutation(internal.whopAuth.saveTokens, { whopUserId, ...tokenFields(tokens), refreshToken: tokens.refresh_token ?? stored.refreshToken });
  return tokens.access_token;
}

export const oauthCallback = httpAction(async (ctx, request) => {
  const url = new URL(request.url);
  const state = url.searchParams.get('state');
  const session = state ? await ctx.runMutation(internal.whopAuth.consumeSession, { state }) : null;
  if (!session) return new Response('Sign-in link expired. Start again from the app.', { status: 400 });
  const back = (result: string) => {
    const target = new URL(session.returnUrl);
    target.searchParams.set('whop', result);
    return new Response(null, { status: 302, headers: { Location: target.toString() } });
  };
  const code = url.searchParams.get('code');
  if (!code) return back('cancelled');
  try {
    const tokens = await tokenRequest({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri(),
      code_verifier: session.codeVerifier,
    });
    const user = await fetchMe(tokens.access_token);
    await ctx.runMutation(internal.whopAuth.linkIdentity, {
      deviceToken: session.deviceToken,
      ...profile(user),
      ...tokenFields(tokens),
    });
    return back('linked');
  } catch (error) {
    console.error('Whop sign-in failed', error instanceof ConvexError ? error.data.code : 'unknown');
    return back('error');
  }
});

export const createSession = internalMutation({
  args: { state: v.string(), deviceToken: v.string(), codeVerifier: v.string(), returnUrl: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.insert('whopOAuthSessions', { ...args, createdAt: Date.now() });
  },
});

export const consumeSession = internalMutation({
  args: { state: v.string() },
  handler: async (ctx, { state }) => {
    const session = await ctx.db
      .query('whopOAuthSessions')
      .withIndex('by_state', (q) => q.eq('state', state))
      .unique();
    if (!session) return null;
    await ctx.db.delete(session._id);
    if (session.createdAt + SESSION_TTL_MS < Date.now()) return null;
    return { deviceToken: session.deviceToken, codeVerifier: session.codeVerifier, returnUrl: session.returnUrl };
  },
});

const profileArgs = {
  whopUserId: v.string(),
  name: v.string(),
  username: v.optional(v.string()),
  avatarUrl: v.optional(v.string()),
};

export const linkIdentity = internalMutation({
  args: {
    deviceToken: v.string(),
    ...profileArgs,
    accessToken: v.string(),
    refreshToken: v.optional(v.string()),
    expiresAt: v.number(),
  },
  handler: async (ctx, { deviceToken, accessToken, refreshToken, expiresAt, ...fields }) => {
    const existing = await ctx.db
      .query('identities')
      .withIndex('by_token', (q) => q.eq('deviceToken', deviceToken))
      .unique();
    const row = { deviceToken, ...fields, environment: whopEnvironment(), linkedAt: Date.now() };
    if (existing) await ctx.db.replace(existing._id, row);
    else await ctx.db.insert('identities', row);
    await writeTokens(ctx, { whopUserId: fields.whopUserId, accessToken, refreshToken, expiresAt });
    await releaseTransfersFor(ctx, deviceToken, fields.whopUserId);
  },
});

export const updateProfile = internalMutation({
  args: { deviceToken: v.string(), ...profileArgs },
  handler: async (ctx, { deviceToken, ...fields }) => {
    const existing = await ctx.db
      .query('identities')
      .withIndex('by_token', (q) => q.eq('deviceToken', deviceToken))
      .unique();
    if (existing && existing.whopUserId === fields.whopUserId) await ctx.db.patch(existing._id, fields);
  },
});

export const saveTokens = internalMutation({
  args: { whopUserId: v.string(), accessToken: v.string(), refreshToken: v.optional(v.string()), expiresAt: v.number() },
  handler: (ctx, args) => writeTokens(ctx, args),
});

async function writeTokens(
  ctx: MutationCtx,
  args: { whopUserId: string; accessToken: string; refreshToken?: string; expiresAt: number },
) {
  const existing = await ctx.db
    .query('whopOAuthTokens')
    .withIndex('by_whop_user', (q) => q.eq('whopUserId', args.whopUserId))
    .unique();
  if (existing) await ctx.db.replace(existing._id, args);
  else await ctx.db.insert('whopOAuthTokens', args);
}

export const storedTokens = internalQuery({
  args: { whopUserId: v.string() },
  handler: (ctx, { whopUserId }) =>
    ctx.db
      .query('whopOAuthTokens')
      .withIndex('by_whop_user', (q) => q.eq('whopUserId', whopUserId))
      .unique(),
});

export const linkedWhopUser = internalQuery({
  args: { deviceToken: v.string() },
  handler: async (ctx, { deviceToken }) => (await resolveIdentity(ctx, deviceToken)).whopUserId ?? null,
});
