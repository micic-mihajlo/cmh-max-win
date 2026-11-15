import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  pings: defineTable({
    source: v.string(),
  }),
});
