import { cronJobs } from 'convex/server';

import { internal } from './_generated/api';

const crons = cronJobs();

crons.interval('expire stale hosted drops', { minutes: 15 }, internal.feed.expireStaleDrops, {});

export default crons;
