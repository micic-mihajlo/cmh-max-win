// ---------- Platform hardening: rate limits, capacity, sweeps (CAP-44) ----------
// A refused call throws ConvexError({ code, message, ...data }). RATE_LIMITED carries retryAfterMs, the wait
// before the same caller's next try can succeed. Each limit is keyed by the caller, never shared across devices.

export type RateLimitedErrorData = { code: 'RATE_LIMITED'; message: string; retryAfterMs: number };

// Platform ceiling on entrants per challenge. A creator can set a lower capacity on a draft.
export const CHALLENGE_CAPACITY_MAX = 500;

// CHALLENGE_FULL: a new device joining a challenge that already seats its capacity. A device already in keeps its seat.
export type ChallengeCapacityView = { capacity: number; seated: number; full: boolean };
