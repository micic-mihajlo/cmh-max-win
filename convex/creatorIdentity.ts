import type { QueryCtx } from './_generated/server';

// Creator and player identity for challenges. Today a device token is the identity, optionally linked to a Whop
// user through identityLinks. Sign in with Whop (CMHM-11) publishes resolveIdentity and checkWhopAccess with these
// exact signatures; swapping them in is a change of import.
export type Identity = { deviceToken: string; whopUserId?: string; name: string };

export async function resolveIdentity(ctx: QueryCtx, deviceToken: string): Promise<Identity> {
  const [link, creator] = await Promise.all([
    ctx.db.query('identityLinks').withIndex('by_token', (q) => q.eq('deviceToken', deviceToken)).order('desc').first(),
    ctx.db.query('creators').withIndex('by_token', (q) => q.eq('deviceToken', deviceToken)).first(),
  ]);
  return { deviceToken, ...(link ? { whopUserId: link.whopUserId } : {}), name: creator?.displayName ?? '' };
}

// Stub until Sign in with Whop: membership of a Whop product is recorded on the challenge but never checked.
export async function checkWhopAccess(_whopUserId: string | undefined, _resourceId: string): Promise<{ checked: false; allowed: true }> {
  return { checked: false, allowed: true };
}

export const ELIGIBILITY_STUB_NOTE = 'Whop membership is recorded but not checked yet.';
