import { HOUR, MINUTE, RateLimiter } from '@convex-dev/rate-limiter';
import { ConvexError } from 'convex/values';

import { components } from './_generated/api';
import type { ActionCtx, MutationCtx } from './_generated/server';

export const rateLimiter = new RateLimiter(components.rateLimiter, {
  hostDrop: { kind: 'fixed window', rate: 5, period: 10 * MINUTE },
  // key: deviceToken. Joining by code, including mistyped codes.
  challengeJoinDevice: { kind: 'token bucket', rate: 20, period: MINUTE, capacity: 10 },
  // key: join code. Sharded so a crowd joining at once doesn't contend on one counter: 6 shards lost 3 of 150 joins
  // to OCC on dev at about 30 joins/s (CAP-82).
  challengeJoin: { kind: 'token bucket', rate: 600, period: MINUTE, capacity: 300, shards: 32 },
  // key: `${challengeId}:${deviceToken}`, one seat's game moves.
  playerAction: { kind: 'token bucket', rate: 60, period: MINUTE, capacity: 20 },
  // key: `${challengeId}:${deviceToken}`, the host console.
  hostAction: { kind: 'token bucket', rate: 30, period: MINUTE, capacity: 10 },
  // key: deviceToken. New drafts, by create or clone.
  challengeCreate: { kind: 'fixed window', rate: 20, period: HOUR },
});

export type RateLimitName = keyof NonNullable<typeof rateLimiter.limits>;

// Consumes one token for key, or throws RATE_LIMITED with retryAfterMs.
export async function enforceRateLimit(ctx: MutationCtx | ActionCtx, name: RateLimitName, key: string) {
  const { ok, retryAfter } = await rateLimiter.limit(ctx, name, { key });
  if (ok) return;
  const seconds = Math.ceil(retryAfter / 1000);
  throw new ConvexError({
    code: 'RATE_LIMITED',
    message: `Too many tries. Try again in ${seconds}s.`,
    retryAfterMs: retryAfter,
  });
}
