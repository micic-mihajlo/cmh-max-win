import { MINUTE, RateLimiter } from '@convex-dev/rate-limiter';
import { ConvexError } from 'convex/values';

import { components } from './_generated/api';
import type { MutationCtx } from './_generated/server';

export const rateLimiter = new RateLimiter(components.rateLimiter, {
  hostDrop: { kind: 'fixed window', rate: 5, period: 10 * MINUTE },
});

export type RateLimitName = keyof NonNullable<typeof rateLimiter.limits>;

// Consumes one token for key, or throws RATE_LIMITED with retryAfterMs.
export async function enforceRateLimit(ctx: MutationCtx, name: RateLimitName, key: string) {
  const { ok, retryAfter } = await rateLimiter.limit(ctx, name, { key });
  if (ok) return;
  const seconds = Math.ceil(retryAfter / 1000);
  throw new ConvexError({
    code: 'RATE_LIMITED',
    message: `Too many tries. Try again in ${seconds}s.`,
    retryAfterMs: retryAfter,
  });
}
