import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export const role = v.union(v.literal('detective'), v.literal('hacker'), v.literal('witness'));
export const suspect = v.union(v.literal('theo'), v.literal('priya'), v.literal('ines'), v.literal('jun'));
export const presence = v.union(v.literal('online'), v.literal('reviewing'), v.literal('ready'));
export const squadSize = v.union(v.literal(2), v.literal(3));
export const bountyMode = v.union(v.literal('concept'), v.literal('sandbox'), v.literal('transfer'));

export const mixerColor = v.union(v.literal('red'), v.literal('blue'), v.literal('green'), v.literal('yellow'));

export const challengeConfig = v.object({
  title: v.string(),
  blurb: v.string(),
  templateId: v.union(v.literal('mystery-aurora'), v.literal('split-passphrase'), v.literal('quick-quiz')),
  templateConfig: v.optional(v.any()), // the template's own creator content (quick-quiz: its questions), checked at publish
  teamFormation: v.union(v.literal('dealt'), v.literal('mixer')),
  teamSize: v.union(v.literal(1), v.literal(2), v.literal(3), v.literal(4)),
  mixerColors: v.array(mixerColor),
  leftover: v.union(v.literal('smaller_teams'), v.literal('wait_next_round')),
  startMode: v.union(v.literal('live'), v.literal('scheduled'), v.literal('window')),
  startsAt: v.union(v.number(), v.null()),
  endsAt: v.union(v.number(), v.null()),
  eligibility: v.union(
    v.object({ kind: v.literal('open') }),
    v.object({ kind: v.literal('whop_members'), productId: v.string() }),
  ),
  reward: v.union(
    v.object({ kind: v.literal('winner_takes_all') }),
    v.object({ kind: v.literal('top_x_equal'), places: v.number() }),
    v.object({ kind: v.literal('placement'), percents: v.array(v.number()) }),
  ),
  poolCents: v.number(),
  currency: v.literal('usd'),
  payoutAdapter: v.union(v.literal('concept'), v.literal('whop')),
  requireWhopToJoin: v.boolean(),
  claimWindowMs: v.number(),
});

export const payoutStatus = v.union(
  v.literal('pending'),
  v.literal('claim_pending_whop'),
  v.literal('approved'),
  v.literal('sent'),
  v.literal('sent_concept'),
  v.literal('failed'),
  v.literal('expired'),
);

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
    challengeId: v.optional(v.id('challenges')), // a challenge team's room
    squadSize: v.optional(v.number()), // 2 or 3 for drop squads, 1 to 4 for challenge teams
    squadIndex: v.optional(v.number()),
    squadLabel: v.optional(v.string()),
    cooldownUntil: v.optional(v.number()),
    // Split-passphrase drop squads (passphrase.ts): the template session (engine.Session) and who proposed the slots.
    // typed: the current proposal exactly as its proposer typed it (shown as-is); nudge: the last wrong answer's.
    passphrase: v.optional(
      v.object({
        session: v.any(),
        proposedBy: v.union(v.id('members'), v.null()),
        typed: v.union(v.array(v.string()), v.null()),
        nudge: v.union(v.object({ text: v.string(), holderName: v.union(v.string(), v.null()) }), v.null()),
      }),
    ),
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
    hostWhopUserId: v.optional(v.string()), // hostDrop from a device signed in with Whop: any device on that account hosts it too
    conceptOnly: v.optional(v.boolean()), // hosted drops never take the sandbox payout path
    strictSquadSize: v.optional(v.boolean()), // demo controls: every squad is exactly squadSize, leftovers unmatched
    template: v.optional(v.literal('split-passphrase')), // hostDrop: squads play a split passphrase instead of the mystery
    minPlayers: v.optional(v.number()), // hostDrop: players dealSquads waits for (squadSize..150); unset: squadSize
    payoutMode: v.optional(v.union(v.literal('real'), v.literal('concept'))), // hostDrop's pick; absent: as before
    startsAt: v.number(),
    status: v.union(v.literal('scheduled'), v.literal('live'), v.literal('ended')),
    bounty: v.object({ totalCents: v.number(), currency: v.literal('usd'), winnerSlots: v.number() }),
    solvedCount: v.number(),
    startJobId: v.optional(v.id('_scheduled_functions')),
  })
    .index('by_dropId', ['dropId'])
    .index('by_joinCode', ['joinCode'])
    .index('by_status', ['status', 'startsAt'])
    .index('by_host_whop', ['hostWhopUserId']),
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
  // One numbered seat (0..DROP_CAPACITY-1) per entrant, so the cap holds without every join reading every entry.
  dropSeats: defineTable({
    dropId: v.string(),
    seat: v.number(),
    deviceToken: v.string(),
  })
    .index('by_drop_seat', ['dropId', 'seat'])
    .index('by_drop_token', ['dropId', 'deviceToken']),
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
  // One row per squad member of a 'transfer' award (SIGNAL_REAL_PAYOUTS=on): a Whop balance transfer to
  // the member's linked whopUserId. idempotencyKey = awardId:memberId, sent to Whop so a retry never pays twice.
  bountyPayouts: defineTable({
    awardId: v.id('bountyAwards'),
    memberId: v.id('members'),
    deviceToken: v.string(),
    cents: v.number(),
    status: v.union(v.literal('sign_in_required'), v.literal('sending'), v.literal('sent'), v.literal('failed')),
    idempotencyKey: v.string(),
    whopUserId: v.optional(v.string()),
    attempts: v.number(),
    transferId: v.optional(v.string()),
    transferStatus: v.optional(v.string()), // Whop's status on create ('succeeded'); the fee is never read from create
    failureCode: v.optional(v.string()),
    error: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index('by_award', ['awardId'])
    .index('by_token', ['deviceToken', 'status']),
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
  // ---------- Creator console (CAP-31) ----------
  creators: defineTable({
    deviceToken: v.string(),
    displayName: v.string(),
    handle: v.string(),
    whopCompanyId: v.optional(v.string()), // biz_…, set by whopCreator.connectWhopCompany after an admin check
  })
    .index('by_token', ['deviceToken'])
    .index('by_handle', ['handle']),
  challenges: defineTable({
    creatorToken: v.string(),
    config: challengeConfig,
    status: v.union(v.literal('draft'), v.literal('published'), v.literal('live'), v.literal('ended'), v.literal('cancelled')),
    serverCreated: v.boolean(),
    joinCode: v.optional(v.string()),
    createdAt: v.number(),
    publishedAt: v.optional(v.number()),
    firstDealtAt: v.optional(v.number()),
    endedAt: v.optional(v.number()),
    cancelReason: v.optional(v.string()),
    finishedCount: v.number(),
  })
    .index('by_creator', ['creatorToken'])
    .index('by_joinCode', ['joinCode'])
    .index('by_status', ['status', 'config.startMode', 'config.startsAt']), // discovery:home's rows
  challengeEntries: defineTable({
    challengeId: v.id('challenges'),
    deviceToken: v.string(),
    name: v.string(),
    joinedAt: v.number(),
    teamId: v.optional(v.id('challengeTeams')),
    waitingNextRound: v.boolean(),
    // mixer mode
    color: v.optional(mixerColor),
    playerCode: v.optional(v.string()),
    fragmentSeed: v.optional(v.string()),
    mixerTeamId: v.optional(v.id('mixerTeams')),
    confirmed: v.optional(v.boolean()),
  })
    .index('by_challenge', ['challengeId'])
    .index('by_challenge_token', ['challengeId', 'deviceToken']),
  challengeTeams: defineTable({
    challengeId: v.id('challenges'),
    index: v.number(),
    label: v.string(),
    roomId: v.id('rooms'),
    size: v.number(),
    dealtAt: v.number(),
    place: v.optional(v.number()),
    finishedAt: v.optional(v.number()),
  })
    .index('by_challenge', ['challengeId', 'index'])
    .index('by_room', ['roomId']),
  mixerTeams: defineTable({
    challengeId: v.id('challenges'),
    label: v.string(),
    status: v.union(v.literal('forming'), v.literal('locked'), v.literal('solved')),
    memberIds: v.array(v.id('challengeEntries')),
    attempts: v.number(),
    cooldownUntil: v.optional(v.number()),
    lockedAt: v.optional(v.number()),
    place: v.optional(v.number()),
    solvedAt: v.optional(v.number()),
  }).index('by_challenge', ['challengeId']),
  fundingLedger: defineTable({
    challengeId: v.id('challenges'),
    amountCents: v.number(),
    status: v.literal('committed_concept'),
    committedAt: v.number(),
  }).index('by_challenge', ['challengeId']),
  payouts: defineTable({
    challengeId: v.id('challenges'),
    place: v.number(),
    teamLabel: v.string(),
    playerIndex: v.number(),
    deviceToken: v.string(),
    name: v.string(),
    cents: v.number(),
    status: payoutStatus,
    adapter: v.union(v.literal('concept'), v.literal('whop')),
    method: v.optional(v.union(v.literal('concept'), v.literal('transfer'), v.literal('claim_link'))),
    idempotencyKey: v.string(),
    whopUserId: v.optional(v.string()),
    claimExpiresAt: v.optional(v.number()),
    claimUrl: v.optional(v.string()),
    error: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index('by_challenge', ['challengeId', 'place', 'playerIndex'])
    .index('by_challenge_token', ['challengeId', 'deviceToken']),
  // ---------- Live layer (CAP-40) ----------
  // One per challenge, created on the first lock, start or host action. state is the template's (Template SDK v2).
  liveSessions: defineTable({
    challengeId: v.id('challenges'),
    templateId: v.string(),
    state: v.any(),
    lockedAt: v.optional(v.number()),
    lastActionAt: v.optional(v.record(v.string(), v.number())), // per host action, for its minimum interval
  }).index('by_challenge', ['challengeId']),
  // A dealt team's engine session, for templates that run on the template engine (quick-quiz).
  teamSessions: defineTable({
    challengeId: v.id('challenges'),
    teamId: v.id('challengeTeams'),
    label: v.string(),
    session: v.any(), // engine Session: { templateId, seed, players (entry ids), state }
    finishedAt: v.optional(v.number()),
  })
    .index('by_challenge', ['challengeId'])
    .index('by_team', ['teamId']),
  identities: defineTable({
    deviceToken: v.string(),
    whopUserId: v.string(),
    name: v.string(),
    username: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    environment: v.union(v.literal('sandbox'), v.literal('production')),
    linkedAt: v.number(),
  })
    .index('by_token', ['deviceToken'])
    .index('by_whop_user', ['whopUserId']),
  whopOAuthSessions: defineTable({
    state: v.string(),
    deviceToken: v.string(),
    codeVerifier: v.string(),
    returnUrl: v.string(),
    createdAt: v.number(),
  }).index('by_state', ['state']),
  // The callback's one-time link code (whopAuth:completeSignIn): Whop tokens wait here until the starting device redeems it.
  whopPendingLinks: defineTable({
    linkCode: v.string(),
    deviceToken: v.string(),
    whopUserId: v.string(),
    name: v.string(),
    username: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    accessToken: v.string(),
    refreshToken: v.optional(v.string()),
    expiresAt: v.number(),
    createdAt: v.number(),
  }).index('by_code', ['linkCode']),
  whopOAuthTokens: defineTable({
    whopUserId: v.string(),
    accessToken: v.string(),
    refreshToken: v.optional(v.string()),
    expiresAt: v.number(),
  }).index('by_whop_user', ['whopUserId']),
  // ---------- Follow feed and push (CAP-45; signal/design/feed-notifications.md) ----------
  // A streamer is the device that hosts drops (drops.hostToken). Only streamers._id is ever shown to clients.
  // hidden: a load-test or QA host (feed.hideTestHosts), left out of every public list and page.
  streamers: defineTable({
    hostToken: v.string(),
    name: v.string(),
    avatarUrl: v.optional(v.string()),
    hidden: v.optional(v.boolean()),
    updatedAt: v.number(),
  })
    .index('by_host', ['hostToken'])
    .index('by_updated', ['updatedAt']),
  // One row per hosted drop. scheduledFor: hostDrop got a start time. openedAt: the streamer went live with it.
  streamerDrops: defineTable({
    streamerId: v.id('streamers'),
    dropId: v.string(),
    createdAt: v.number(),
    scheduledFor: v.union(v.number(), v.null()),
    openedAt: v.union(v.number(), v.null()),
    expiredAt: v.optional(v.number()), // feed.expireStaleDrops ended it as abandoned or a test; kept out of past lists
    rehearsal: v.optional(v.boolean()), // hostDrop({ rehearsal: true }): kept out of Find streamers and the following feed
  })
    .index('by_streamer', ['streamerId', 'createdAt'])
    .index('by_drop', ['dropId']),
  follows: defineTable({
    deviceToken: v.string(),
    streamerId: v.id('streamers'),
    whopUserId: v.optional(v.string()), // set when the device had a linked Whop account at follow time
    createdAt: v.number(),
  })
    .index('by_device', ['deviceToken', 'streamerId'])
    .index('by_whop_user', ['whopUserId', 'streamerId'])
    .index('by_streamer', ['streamerId']),
  dropReminders: defineTable({ deviceToken: v.string(), dropId: v.string(), createdAt: v.number() })
    .index('by_device', ['deviceToken', 'dropId'])
    .index('by_drop', ['dropId']),
  pushTokens: defineTable({
    deviceToken: v.string(),
    token: v.string(), // ExponentPushToken[...]
    platform: v.union(v.literal('ios'), v.literal('android')),
    updatedAt: v.number(),
  })
    .index('by_device', ['deviceToken'])
    .index('by_token', ['token']),
  // The platform Whop ledger's last read available balance (bounty.saveBalance); caps realPayoutStatus.
  whopBalanceCache: defineTable({ availableCents: v.number(), checkedAt: v.number() }),
  // Dedupe ledger: at most one push per device per drop (a drop has one streamer).
  pushSends: defineTable({
    deviceToken: v.string(),
    dropId: v.string(),
    kind: v.union(v.literal('live'), v.literal('starting')),
    sentAt: v.number(),
  }).index('by_device_drop', ['deviceToken', 'dropId']),
  // ---------- Creator discovery (CAP-45): "Notify me when this starts" on a challenge. Push delivery comes later. ----------
  challengeReminders: defineTable({ deviceToken: v.string(), challengeId: v.id('challenges'), createdAt: v.number() })
    .index('by_device', ['deviceToken', 'challengeId'])
    .index('by_challenge', ['challengeId']),
  // ---------- Platform hardening (CAP-44): convex/hardening.ts ----------
  // One numbered seat per entrant in a scope ('challenge:<id>'), so capacity holds without counting entries.
  capacitySeats: defineTable({
    scope: v.string(),
    seat: v.number(),
    deviceToken: v.string(),
  })
    .index('by_scope_seat', ['scope', 'seat'])
    .index('by_scope_token', ['scope', 'deviceToken']),
  // A creator-set capacity below CHALLENGE_CAPACITY_MAX, set while the challenge is a draft.
  challengeLimits: defineTable({
    challengeId: v.id('challenges'),
    capacity: v.number(),
  }).index('by_challenge', ['challengeId']),
  // ---------- Room pulse (CAP-82): convex/roomPulse.ts ----------
  // One per engine-session challenge, rewritten at the deal, each question advance and each reveal; never on a lock.
  roomPulses: defineTable({
    challengeId: v.id('challenges'),
    joined: v.number(),
    phase: v.union(v.literal('lobby'), v.literal('question'), v.literal('reveal'), v.literal('finished')),
    questionIndex: v.union(v.number(), v.null()),
    questionCount: v.number(),
    deadline: v.union(v.number(), v.null()),
    teams: v.array(
      v.object({
        id: v.id('challengeTeams'),
        label: v.string(),
        memberFirstNames: v.array(v.string()),
        memberCount: v.number(), // locks the team needs
        correct: v.union(v.boolean(), v.null()),
      }),
    ),
  }).index('by_challenge', ['challengeId']),
  // One row per player lock on one question, so concurrent locks never write a shared doc. In per-player quiz play it
  // also holds the answer until its question closes and folds into the team session (teamSessions.withOpenAnswers).
  // Server-only: choice and points never leave the server through the pulse.
  pulseLocks: defineTable({
    challengeId: v.id('challenges'),
    questionIndex: v.number(),
    teamId: v.id('challengeTeams'),
    playerId: v.string(), // the entry id, as in the engine session
    lockedAt: v.number(),
    choice: v.optional(v.number()),
    points: v.optional(v.number()),
  }).index('by_question', ['challengeId', 'questionIndex', 'teamId', 'playerId']),
  // The lobby head count, sharded by device token so concurrent joins rarely touch the same doc.
  pulseJoinShards: defineTable({
    challengeId: v.id('challenges'),
    shard: v.number(),
    joined: v.number(),
  }).index('by_challenge', ['challengeId', 'shard']),
});
