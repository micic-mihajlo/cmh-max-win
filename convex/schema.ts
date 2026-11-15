import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export const role = v.union(v.literal('detective'), v.literal('hacker'), v.literal('witness'));
export const suspect = v.union(v.literal('theo'), v.literal('priya'), v.literal('ines'), v.literal('jun'));
export const presence = v.union(v.literal('online'), v.literal('reviewing'), v.literal('ready'));

export default defineSchema({
  pings: defineTable({
    source: v.string(),
  }),
  rooms: defineTable({
    code: v.string(),
    hostToken: v.string(),
    caseId: v.literal('case01'),
    status: v.union(v.literal('lobby'), v.literal('intro'), v.literal('playing'), v.literal('resolved')),
    theory: v.object({
      culprit: v.union(suspect, v.null()),
      revision: v.number(),
      lastEditedBy: v.union(v.id('members'), v.null()),
    }),
    attempts: v.number(),
    lastNudge: v.union(
      v.object({ wrongPick: suspect, forRole: role, text: v.string(), revision: v.number() }),
      v.null(),
    ),
    checkedRevision: v.union(v.number(), v.null()),
    checkSeq: v.number(),
    lastCheck: v.union(
      v.object({ seq: v.number(), result: v.union(v.literal('wrong'), v.literal('correct')), at: v.number() }),
      v.null(),
    ),
  }).index('by_code', ['code']),
  members: defineTable({
    roomId: v.id('rooms'),
    deviceToken: v.string(),
    name: v.string(),
    role: v.union(role, v.null()),
    presence,
  })
    .index('by_room', ['roomId'])
    .index('by_token', ['deviceToken'])
    .index('by_room_token', ['roomId', 'deviceToken']),
  lockIns: defineTable({
    roomId: v.id('rooms'),
    memberId: v.id('members'),
    revision: v.number(),
  })
    .index('by_room', ['roomId'])
    .index('by_member', ['memberId']),
  // Written only by internal.whop.grantFromPayment after a verified Whop payment.
  entitlements: defineTable({
    deviceToken: v.string(),
    pack: v.literal('season01'),
    source: v.literal('whop'),
    environment: v.union(v.literal('sandbox'), v.literal('production')),
    whopPaymentId: v.string(),
    verifiedAt: v.number(),
  })
    .index('by_token', ['deviceToken'])
    .index('by_payment', ['whopPaymentId']),
  whopCheckouts: defineTable({
    deviceToken: v.string(),
    pack: v.literal('season01'),
    checkoutConfigId: v.optional(v.string()),
    createdAt: v.number(),
  }),
});
