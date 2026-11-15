import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export const role = v.union(v.literal('detective'), v.literal('hacker'), v.literal('witness'));
export const suspect = v.union(v.literal('theo'), v.literal('priya'), v.literal('ines'), v.literal('jun'));
export const presence = v.union(v.literal('online'), v.literal('reviewing'), v.literal('ready'));
export const squadSize = v.union(v.literal(2), v.literal(3));
export const bountyMode = v.union(v.literal('concept'), v.literal('sandbox'));

export default defineSchema({
  pings: defineTable({
    source: v.string(),
  }),
  rooms: defineTable({
    code: v.string(),
    hostToken: v.string(),
    caseId: v.union(v.literal('case01'), v.literal('aurora01')),
    // Drop squads only: a squad is a room with no host, dealt pieces, and a cooldown after a wrong check.
    dropId: v.optional(v.string()),
    squadSize: v.optional(squadSize),
    squadIndex: v.optional(v.number()),
    squadLabel: v.optional(v.string()),
    cooldownUntil: v.optional(v.number()),
    status: v.union(v.literal('lobby'), v.literal('intro'), v.literal('playing'), v.literal('resolved')),
    theory: v.object({
      culprit: v.union(suspect, v.null()),
      revision: v.number(),
      lastEditedBy: v.union(v.id('members'), v.null()),
    }),
    attempts: v.number(),
    lastNudge: v.union(
      v.object({
        wrongPick: suspect,
        forRole: role,
        text: v.string(),
        revision: v.number(),
        holderMemberId: v.optional(v.id('members')),
      }),
      v.null(),
    ),
    checkedRevision: v.union(v.number(), v.null()),
    checkSeq: v.number(),
    lastCheck: v.union(
      v.object({ seq: v.number(), result: v.union(v.literal('wrong'), v.literal('correct')), at: v.number() }),
      v.null(),
    ),
  })
    .index('by_code', ['code'])
    .index('by_drop', ['dropId', 'squadIndex']),
  members: defineTable({
    roomId: v.id('rooms'),
    deviceToken: v.string(),
    name: v.string(),
    role: v.union(role, v.null()), // primary role
    roles: v.optional(v.array(role)), // every role's evidence this member holds; defaults to [role]
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
  drops: defineTable({
    dropId: v.string(),
    title: v.string(),
    creatorName: v.string(),
    caseId: v.literal('aurora01'),
    squadSize,
    joinCode: v.optional(v.string()), // 4 chars, unique among drops that aren't ended; the QR payload
    hostToken: v.optional(v.string()), // drops:hostDrop: the device that runs the host screen and deals
    conceptOnly: v.optional(v.boolean()), // hosted drops never take the sandbox payout path
    strictSquadSize: v.optional(v.boolean()), // demo controls: every squad is exactly squadSize, leftovers unmatched
    startsAt: v.number(),
    status: v.union(v.literal('scheduled'), v.literal('live'), v.literal('ended')),
    bounty: v.object({ totalCents: v.number(), currency: v.literal('usd'), winnerSlots: v.number() }),
    solvedCount: v.number(),
    startJobId: v.optional(v.id('_scheduled_functions')),
  })
    .index('by_dropId', ['dropId'])
    .index('by_joinCode', ['joinCode'])
    .index('by_status', ['status', 'startsAt']),
  dropEntries: defineTable({
    dropId: v.string(),
    deviceToken: v.string(),
    name: v.string(),
    squadRoomId: v.optional(v.id('rooms')),
    unmatched: v.boolean(),
  })
    .index('by_drop', ['dropId'])
    .index('by_drop_token', ['dropId', 'deviceToken'])
    .index('by_token', ['deviceToken']),
  solves: defineTable({
    dropId: v.string(),
    roomId: v.id('rooms'),
    place: v.number(),
    solvedAt: v.number(),
    solveMs: v.number(),
    attempts: v.number(),
  })
    .index('by_drop', ['dropId', 'place'])
    .index('by_room', ['roomId']),
  bountyAwards: defineTable({
    dropId: v.string(),
    roomId: v.id('rooms'),
    place: v.number(),
    amountCents: v.number(),
    perPlayerCents: v.number(),
    redeemableCount: v.number(),
    mode: bountyMode,
    status: v.union(v.literal('pending'), v.literal('ready'), v.literal('failed')),
    claimUrl: v.union(v.string(), v.null()),
    claimLinkId: v.optional(v.string()),
    expiresAt: v.optional(v.string()),
    label: v.string(),
    error: v.optional(v.string()),
  }).index('by_room', ['roomId']),
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
