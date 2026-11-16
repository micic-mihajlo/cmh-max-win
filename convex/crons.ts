import { cronJobs } from 'convex/server';

import { internal } from './_generated/api';

// Claim expiry needs no cron: approvePayouts schedules challenges.expireClaims at each claim deadline.
const crons = cronJobs();

crons.interval('expire stale hosted drops', { minutes: 15 }, internal.feed.expireStaleDrops, {});
crons.interval('sweep abandoned Whop OAuth sessions', { minutes: 15 }, internal.hardening.sweepWhopOAuthSessions, {});
crons.interval('sweep abandoned lobbies', { hours: 1 }, internal.hardening.sweepAbandonedLobbies, {});
crons.interval('release unclaimed real payout shares', { minutes: 5 }, internal.bounty.releaseUnclaimed, {});
crons.daily('sweep stale challenge drafts', { hourUTC: 11, minuteUTC: 0 }, internal.hardening.sweepStaleDrafts, {});

export default crons;
