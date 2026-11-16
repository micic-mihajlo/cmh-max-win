import { ConvexError, v } from 'convex/values';

import { internal } from './_generated/api';
import type { Doc } from './_generated/dataModel';
import { internalMutation, mutation, query, type MutationCtx, type QueryCtx } from './_generated/server';
import { awardModeWithBudget, realBudgetRemainingCents, realPayoutBudgetCents, realPayoutCapCents } from './bounty';
import { ROLES, type Role } from './case01';
import { checkScheduledStart, noteHostedDrop } from './feed';
import { dealPassphrase } from './passphrase';
import { presence as presenceComponent } from './presence';
import { enforceRateLimit } from './rateLimits';
import { squadSize } from './schema';
import { CODE_ALPHABET, generateCode } from './signal';
import { resolveIdentity } from './whopAuth';
import type {
  BountyView,
  DropSummaryView,
  DropView,
  HostView,
  LeaderboardRow,
  LeaderboardView,
  SignalErrorCode,
  AwardPayoutView,
  SquadAwardView,
  SquadSize,
  DropTemplateId,
  RealPayoutStatusView,
} from '../src/lib/contract';
import type { HostedDropRow } from '../src/lib/contract-host';

export const DEMO_DROP_ID = 'aurora-demo';

function fail(code: SignalErrorCode, message: string, extra: Record<string, number> = {}): never {
  throw new ConvexError({ code, message, ...extra });
}

// Squad sizes for n entrants in entry order. N = 3: remainder 2 -> one duo, remainder 1 -> two duos.
// N = 2: remainder 1 -> one trio. Fewer than 2 entrants: no squads.
export function splitSizes(n: number, target: SquadSize): SquadSize[] {
  if (n < 2) return [];
  if (target === 2) {
    const sizes: SquadSize[] = Array(Math.floor(n / 2)).fill(2);
    if (n % 2) sizes[sizes.length - 1] = 3;
    return sizes;
  }
  if (n === 4) return [2, 2];
  const r = n % 3;
  const trios = r === 1 ? (n - 4) / 3 : Math.floor(n / 3);
  return [...Array(trios).fill(3), ...(r === 0 ? [] : r === 2 ? [2] : [2, 2])];
}

function hash(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

// Pieces per seat, varied per squad but reproducible from (dropId, squadIndex). A duo gets one 2-piece seat
// and one 1-piece seat; every seat's first role is its primary (seal and color).
// 3 pieces per team. Trio: one each. Duo: a 2-piece phone and a 1-piece phone. Solo (challenges): all three. Four
// (challenges): one each, and the fourth member holds a copy of the first piece, so every member holds one.
export function dealPieces(dropId: string, squadIndex: number, size: number): Role[][] {
  const k = hash(`${dropId}:${squadIndex}`) % 3;
  const order = [...ROLES.slice(k), ...ROLES.slice(0, k)];
  if (size === 1) return [order];
  if (size === 2) return [[order[0], order[1]], [order[2]]];
  return [...order.map((r) => [r]), ...(size === 4 ? [[order[0]]] : [])];
}

async function findDropByCode(ctx: QueryCtx, code: string) {
  const matches = await ctx.db
    .query('drops')
    .withIndex('by_joinCode', (q) => q.eq('joinCode', code.trim().toUpperCase()))
    .collect();
  return matches.find((d) => d.status !== 'ended') ?? null;
}

async function generateJoinCode(ctx: MutationCtx) {
  for (;;) {
    let code = '';
    for (let i = 0; i < 4; i++) code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    if (!(await findDropByCode(ctx, code))) return code;
  }
}

async function findDrop(ctx: QueryCtx, dropId: string) {
  return ctx.db
    .query('drops')
    .withIndex('by_dropId', (q) => q.eq('dropId', dropId))
    .unique();
}

// The host of a hosted drop: the device that made it, or any device signed in to the Whop account that made it.
export async function isDropHost(ctx: Pick<QueryCtx, 'db'>, drop: Doc<'drops'>, deviceToken: string): Promise<boolean> {
  if (!drop.hostToken) return false;
  if (drop.hostToken === deviceToken) return true;
  if (!drop.hostWhopUserId || !deviceToken) return false;
  return (await resolveIdentity(ctx, deviceToken)).whopUserId === drop.hostWhopUserId;
}

async function requireDrop(ctx: QueryCtx, dropId: string) {
  const drop = await findDrop(ctx, dropId);
  if (!drop) fail('DROP_NOT_FOUND', 'No drop with that id.');
  return drop;
}

async function entriesOf(ctx: QueryCtx, dropId: string) {
  return ctx.db
    .query('dropEntries')
    .withIndex('by_drop', (q) => q.eq('dropId', dropId))
    .collect();
}

async function findEntry(ctx: QueryCtx, dropId: string, deviceToken: string) {
  return ctx.db
    .query('dropEntries')
    .withIndex('by_drop_token', (q) => q.eq('dropId', dropId).eq('deviceToken', deviceToken))
    .unique();
}

// mode is what an award would get right now, so it respects the remaining real-payout budget.
export async function bountyView(ctx: Pick<QueryCtx, 'db'>, drop: Doc<'drops'>): Promise<BountyView> {
  const perSquadCents = Math.floor(drop.bounty.totalCents / drop.bounty.winnerSlots);
  return {
    totalCents: drop.bounty.totalCents,
    currency: 'usd',
    winnerSlots: drop.bounty.winnerSlots,
    perSquadCents,
    mode: await awardModeWithBudget(ctx, drop, perSquadCents),
  };
}

async function summary(ctx: QueryCtx, drop: Doc<'drops'>, entrantCount: number): Promise<DropSummaryView> {
  return {
    dropId: drop.dropId,
    title: drop.title,
    creatorName: drop.creatorName,
    caseId: drop.caseId,
    squadSize: drop.squadSize,
    joinCode: drop.joinCode ?? null,
    hosted: !!drop.hostToken,
    startsAt: drop.startsAt,
    status: drop.status,
    entrantCount,
    bounty: await bountyView(ctx, drop),
    winnersSoFar: Math.min(drop.solvedCount, drop.bounty.winnerSlots),
  };
}

export const listDrops = query({
  args: {},
  handler: async (ctx): Promise<DropSummaryView[]> => {
    const open = [
      ...(await ctx.db
        .query('drops')
        .withIndex('by_status', (q) => q.eq('status', 'live'))
        .collect()),
      ...(await ctx.db
        .query('drops')
        .withIndex('by_status', (q) => q.eq('status', 'scheduled'))
        .collect()),
    ];
    const listed = open.filter((d) => !d.hostToken);
    return Promise.all(listed.map(async (d) => summary(ctx, d, (await entriesOf(ctx, d.dropId)).length)));
  },
});

async function dropView(ctx: QueryCtx, drop: Doc<'drops'>, deviceToken: string): Promise<DropView> {
  const entries = await entriesOf(ctx, drop.dropId);
    const mine = entries.find((e) => e.deviceToken === deviceToken);
    const room = mine?.squadRoomId ? await ctx.db.get(mine.squadRoomId) : null;
    return {
      ...(await summary(ctx, drop, entries.length)),
      entrants: entries.map((e) => ({ name: e.name, isMe: e.deviceToken === deviceToken })),
      me: {
        entered: !!mine,
        name: mine?.name ?? null,
        squad: room ? { code: room.code, size: (room.squadSize ?? 3) as SquadSize, label: room.squadLabel ?? '' } : null,
        unmatched: mine?.unmatched ?? false,
      },
      ...(drop.template ? { template: drop.template } : {}),
    };
}

export const drop = query({
  args: { deviceToken: v.string(), dropId: v.string() },
  handler: async (ctx, { deviceToken, dropId }): Promise<DropView | null> => {
    const drop = await findDrop(ctx, dropId);
    return drop ? dropView(ctx, drop, deviceToken) : null;
  },
});

// QR / typed join: the code a host screen shows. Only drops that haven't ended answer to their code.
export const dropByCode = query({
  args: { deviceToken: v.string(), code: v.string() },
  handler: async (ctx, { deviceToken, code }): Promise<DropView | null> => {
    const drop = await findDropByCode(ctx, code);
    return drop ? dropView(ctx, drop, deviceToken) : null;
  },
});

export const DROP_CAPACITY = 150;

// Free entry: no entitlement is read or required, ever. One seat per device token: a device that already
// entered keeps its seat (renamed while the drop is still scheduled), even once the drop is full or live.
async function enter(ctx: MutationCtx, drop: Doc<'drops'>, deviceToken: string, name: string) {
  const dropId = drop.dropId;
  const clean = name.trim().slice(0, 24);
  const existing = await findEntry(ctx, dropId, deviceToken);
  if (existing) {
    if (drop.status === 'scheduled' && clean && clean !== existing.name) await ctx.db.patch(existing._id, { name: clean });
    return;
  }
  if (drop.status !== 'scheduled') fail('DROP_CLOSED', 'Entries closed when the drop started.');
  if (!clean) fail('WRONG_STATUS', 'Enter a name first.');
  const seat = await freeSeat(ctx, dropId, deviceToken);
  if (seat === null) fail('DROP_FULL', `This drop is full (${DROP_CAPACITY} players).`);
  await ctx.db.insert('dropSeats', { dropId, seat, deviceToken });
  await ctx.db.insert('dropEntries', { dropId, deviceToken, name: clean, unmatched: false });
}

// Counting entries would make every concurrent join conflict on the same index range. Instead each join
// point-reads a few seats starting from its token's hash, so joins only collide on the same seat, and it
// scans the whole seat range only when those probes are all taken.
async function freeSeat(ctx: MutationCtx, dropId: string, deviceToken: string): Promise<number | null> {
  const start = hash(deviceToken) % DROP_CAPACITY;
  for (let i = 0; i < 8; i++) {
    const seat = (start + i * 61) % DROP_CAPACITY;
    const taken = await ctx.db
      .query('dropSeats')
      .withIndex('by_drop_seat', (q) => q.eq('dropId', dropId).eq('seat', seat))
      .first();
    if (!taken) return seat;
  }
  const taken = new Set(
    (await ctx.db.query('dropSeats').withIndex('by_drop_seat', (q) => q.eq('dropId', dropId)).collect()).map((s) => s.seat),
  );
  for (let seat = 0; seat < DROP_CAPACITY; seat++) if (!taken.has(seat)) return seat;
  return null;
}

export const enterDrop = mutation({
  args: { deviceToken: v.string(), dropId: v.string(), name: v.string() },
  handler: async (ctx, { deviceToken, dropId, name }) => enter(ctx, await requireDrop(ctx, dropId), deviceToken, name),
});

export const enterDropByCode = mutation({
  args: { deviceToken: v.string(), code: v.string(), name: v.string() },
  handler: async (ctx, { deviceToken, code, name }) => {
    const drop = await findDropByCode(ctx, code);
    if (!drop) fail('DROP_NOT_FOUND', 'No open drop with that code.');
    await enter(ctx, drop, deviceToken, name);
    return { dropId: drop.dropId };
  },
});

// One-off: give open drops created before join codes existed (e.g. aurora-demo) a code.
export const backfillJoinCodes = internalMutation({
  args: {},
  handler: async (ctx) => {
    const done: { dropId: string; joinCode: string }[] = [];
    for (const d of await ctx.db.query('drops').collect()) {
      if (d.joinCode || d.status === 'ended') continue;
      const joinCode = await generateJoinCode(ctx);
      await ctx.db.patch(d._id, { joinCode });
      done.push({ dropId: d.dropId, joinCode });
    }
    return done;
  },
});

export const leaveDrop = mutation({
  args: { deviceToken: v.string(), dropId: v.string() },
  handler: async (ctx, { deviceToken, dropId }) => {
    const drop = await requireDrop(ctx, dropId);
    if (drop.status !== 'scheduled') fail('DROP_CLOSED', 'The drop has started.');
    const entry = await findEntry(ctx, dropId, deviceToken);
    if (!entry) fail('NOT_ENTERED', 'You are not in this drop.');
    await ctx.db.delete(entry._id);
    const seat = await ctx.db
      .query('dropSeats')
      .withIndex('by_drop_token', (q) => q.eq('dropId', dropId).eq('deviceToken', deviceToken))
      .unique();
    if (seat) await ctx.db.delete(seat._id);
  },
});

// The video's rival squads (scripts/demo/rivals.mjs) enter with this prefix; an all-demo squad is labelled
// "Demo Squad A/B/C" so it never reads as real players.
export const DEMO_NAME_PREFIX = 'Demo · ';

async function formSquads(ctx: MutationCtx, drop: Doc<'drops'>) {
  if (drop.status !== 'scheduled') return;
  const entries = await entriesOf(ctx, drop.dropId);
  const sizes = drop.strictSquadSize
    ? (Array(Math.floor(entries.length / drop.squadSize)).fill(drop.squadSize) as SquadSize[])
    : splitSizes(entries.length, drop.squadSize);
  if (!sizes.length) {
    await Promise.all(entries.map((e) => ctx.db.patch(e._id, { unmatched: true })));
    await ctx.db.patch(drop._id, { status: 'ended' });
    return;
  }
  let next = 0;
  let demoSquads = 0;
  const usedWords: string[] = [];
  for (const [squadIndex, size] of sizes.entries()) {
    const seats = entries.slice(next, next + size);
    next += size;
    const demo = seats.every((e) => e.name.startsWith(DEMO_NAME_PREFIX));
    const roomId = await ctx.db.insert('rooms', {
      code: await generateCode(ctx),
      hostToken: '',
      caseId: 'aurora01',
      dropId: drop.dropId,
      squadSize: size,
      squadIndex,
      squadLabel: demo ? `Demo Squad ${String.fromCharCode(65 + demoSquads++)}` : `Squad ${squadIndex + 1 - demoSquads}`,
      status: drop.template ? 'playing' : 'intro',
      theory: { culprit: null, revision: 0, lastEditedBy: null },
      attempts: 0,
      lastNudge: null,
      checkedRevision: null,
      checkSeq: 0,
      lastCheck: null,
    });
    if (drop.template) {
      const memberIds = [];
      for (const entry of seats) {
        memberIds.push(await ctx.db.insert('members', { roomId, deviceToken: entry.deviceToken, name: entry.name, role: null, presence: 'online' }));
        await ctx.db.patch(entry._id, { squadRoomId: roomId });
      }
      usedWords.push(...(await dealPassphrase(ctx, roomId, memberIds.map((id, i) => ({ playerId: id, name: seats[i].name })), usedWords)));
      continue;
    }
    const hands = dealPieces(drop.dropId, squadIndex, size);
    for (const [i, entry] of seats.entries()) {
      await ctx.db.insert('members', {
        roomId,
        deviceToken: entry.deviceToken,
        name: entry.name,
        role: hands[i][0],
        roles: hands[i],
        presence: 'online',
      });
      await ctx.db.patch(entry._id, { squadRoomId: roomId });
    }
  }
  await Promise.all(entries.slice(next).map((e) => ctx.db.patch(e._id, { unmatched: true })));
  await ctx.db.patch(drop._id, { status: 'live' });
}

export const startDrop = internalMutation({
  args: { dropId: v.string() },
  handler: async (ctx, { dropId }) => {
    const drop = await findDrop(ctx, dropId);
    if (drop) await formSquads(ctx, drop);
  },
});

const createArgs = {
  dropId: v.string(),
  title: v.string(),
  creatorName: v.string(),
  caseId: v.optional(v.literal('aurora01')),
  squadSize,
  startsAt: v.number(),
  bounty: v.object({ totalCents: v.number(), currency: v.optional(v.literal('usd')), winnerSlots: v.number() }),
};

export async function insertDrop(
  ctx: MutationCtx,
  args: {
    dropId: string;
    title: string;
    creatorName: string;
    squadSize: SquadSize;
    startsAt: number;
    bounty: { totalCents: number; winnerSlots: number };
    strictSquadSize?: boolean;
    hostToken?: string;
    hostWhopUserId?: string;
    template?: DropTemplateId;
    payoutMode?: 'real' | 'concept';
    minPlayers?: number;
  },
) {
  const { totalCents, winnerSlots } = args.bounty;
  if (!Number.isInteger(winnerSlots) || winnerSlots < 1 || !Number.isInteger(totalCents) || totalCents < 0) {
    fail('WRONG_STATUS', 'A drop needs at least one winner slot and a whole-cent bounty.');
  }
  if (await findDrop(ctx, args.dropId)) fail('WRONG_STATUS', 'A drop with that id already exists.');
  const id = await ctx.db.insert('drops', {
    dropId: args.dropId,
    title: args.title,
    creatorName: args.creatorName,
    caseId: 'aurora01',
    squadSize: args.squadSize,
    joinCode: await generateJoinCode(ctx),
    ...(args.strictSquadSize ? { strictSquadSize: true } : {}),
    ...(args.hostToken ? { hostToken: args.hostToken, conceptOnly: true } : {}),
    ...(args.hostToken && args.hostWhopUserId ? { hostWhopUserId: args.hostWhopUserId } : {}),
    ...(args.template ? { template: args.template } : {}),
    ...(args.payoutMode ? { payoutMode: args.payoutMode } : {}),
    ...(args.minPlayers !== undefined ? { minPlayers: args.minPlayers } : {}),
    startsAt: args.startsAt,
    status: 'scheduled',
    bounty: { totalCents, currency: 'usd', winnerSlots },
    solvedCount: 0,
  });
  if (!args.hostToken) {
    const startJobId = await ctx.scheduler.runAt(args.startsAt, internal.drops.startDrop, { dropId: args.dropId });
    await ctx.db.patch(id, { startJobId });
  }
  return { dropId: args.dropId, joinCode: (await ctx.db.get(id))!.joinCode! };
}

// Creator side: internal only, so it runs from the dashboard or `npx convex run drops:createDrop`.
export const createDrop = internalMutation({
  args: createArgs,
  handler: async (ctx, args) => insertDrop(ctx, args),
});

async function deleteDrop(ctx: MutationCtx, drop: Doc<'drops'>) {
  if (drop.startJobId) await ctx.scheduler.cancel(drop.startJobId);
  const rooms = await ctx.db
    .query('rooms')
    .withIndex('by_drop', (q) => q.eq('dropId', drop.dropId))
    .collect();
  for (const room of rooms) {
    for (const m of await ctx.db
      .query('members')
      .withIndex('by_room', (q) => q.eq('roomId', room._id))
      .collect()) {
      await ctx.db.delete(m._id);
    }
    for (const l of await ctx.db
      .query('lockIns')
      .withIndex('by_room', (q) => q.eq('roomId', room._id))
      .collect()) {
      await ctx.db.delete(l._id);
    }
    for (const a of await ctx.db
      .query('bountyAwards')
      .withIndex('by_room', (q) => q.eq('roomId', room._id))
      .collect()) {
      await ctx.db.delete(a._id);
    }
    await presenceComponent.removeRoom(ctx, room.code);
    await ctx.db.delete(room._id);
  }
  for (const s of await ctx.db
    .query('solves')
    .withIndex('by_drop', (q) => q.eq('dropId', drop.dropId))
    .collect()) {
    await ctx.db.delete(s._id);
  }
  for (const e of await entriesOf(ctx, drop.dropId)) await ctx.db.delete(e._id);
  const seats = await ctx.db.query('dropSeats').withIndex('by_drop_seat', (q) => q.eq('dropId', drop.dropId)).collect();
  for (const s of seats) await ctx.db.delete(s._id);
  await ctx.db.delete(drop._id);
}

// Demo seed: (re)creates the aurora-demo drop. `npx convex run drops:seedDemo '{"startsInSeconds":600}'`
export const seedDemo = internalMutation({
  args: {
    startsInSeconds: v.optional(v.number()),
    totalCents: v.optional(v.number()),
    winnerSlots: v.optional(v.number()),
    squadSize: v.optional(squadSize),
  },
  handler: async (ctx, args) => {
    const existing = await findDrop(ctx, DEMO_DROP_ID);
    if (existing) await deleteDrop(ctx, existing);
    return insertDrop(ctx, {
      dropId: DEMO_DROP_ID,
      title: 'The Aurora Seed',
      creatorName: 'SIGNAL',
      startsAt: Date.now() + (args.startsInSeconds ?? 600) * 1000,
      squadSize: args.squadSize ?? 3,
      bounty: { totalCents: args.totalCents ?? 30_000, winnerSlots: args.winnerSlots ?? 3 },
    });
  },
});

// Demo control: start a drop right now. Internal, so only a server-side call (`npx convex run`) can trigger it.
export async function startDropNow(ctx: MutationCtx, dropId: string) {
  const drop = await requireDrop(ctx, dropId);
  if (drop.status !== 'scheduled') fail('WRONG_STATUS', 'The drop already started.');
  if (drop.startJobId) await ctx.scheduler.cancel(drop.startJobId);
  const startsAt = Date.now();
  await ctx.db.patch(drop._id, { startsAt });
  await formSquads(ctx, { ...drop, startsAt });
}

export const startNow = internalMutation({
  args: { dropId: v.string() },
  handler: async (ctx, { dropId }) => startDropNow(ctx, dropId),
});

export const leaderboard = query({
  args: { deviceToken: v.string(), dropId: v.string() },
  handler: async (ctx, { deviceToken, dropId }): Promise<LeaderboardView | null> => {
    const drop = await findDrop(ctx, dropId);
    if (!drop) return null;
    const mine = await findEntry(ctx, dropId, deviceToken);
    const rooms = await ctx.db
      .query('rooms')
      .withIndex('by_drop', (q) => q.eq('dropId', dropId))
      .collect();
    const solves = await ctx.db
      .query('solves')
      .withIndex('by_drop', (q) => q.eq('dropId', dropId))
      .collect();
    const rows: (LeaderboardRow & { order: number })[] = [];
    for (const room of rooms) {
      const solve = solves.find((s) => s.roomId === room._id);
      const names = (
        await ctx.db
          .query('members')
          .withIndex('by_room', (q) => q.eq('roomId', room._id))
          .collect()
      ).map((m) => m.name);
      rows.push({
        rank: solve?.place ?? null,
        squadLabel: room.squadLabel ?? '',
        memberNames: names,
        status: !solve ? 'solving' : solve.place <= drop.bounty.winnerSlots ? 'winner' : 'solved',
        solveMs: solve?.solveMs ?? null,
        attempts: solve?.attempts ?? room.attempts,
        isMine: mine?.squadRoomId === room._id,
        order: solve ? solve.place : solves.length + 1 + (room.squadIndex ?? 0),
      });
    }
    rows.sort((a, b) => a.order - b.order);
    return {
      dropId,
      status: drop.status,
      startsAt: drop.startsAt,
      winnerSlots: drop.bounty.winnerSlots,
      rows: rows.map(({ order: _order, ...row }) => row),
    };
  },
});

// Server clock for the client's offset. A mutation, so the value is never a cached query result.
export const serverTime = mutation({
  args: {},
  handler: async () => Date.now(),
});

// The claim link is a bearer secret: only members of the room that won it ever receive it.
function payoutMessage(status: Doc<'bountyPayouts'>['status'], cents: number) {
  if (status === 'sent') return 'Sent to your Whop balance';
  if (status === 'sign_in_required') return `Sign in with Whop to receive ${dollars(cents)}`;
  if (status === 'sending') return 'Sending to your Whop balance…';
  return "The transfer didn't go through.";
}

export const myAward = query({
  args: { deviceToken: v.string(), code: v.string() },
  handler: async (ctx, { deviceToken, code }): Promise<SquadAwardView | null> => {
    const room = await ctx.db
      .query('rooms')
      .withIndex('by_code', (q) => q.eq('code', code.trim().toUpperCase()))
      .unique();
    if (!room?.dropId) return null;
    const member = await ctx.db
      .query('members')
      .withIndex('by_room_token', (q) => q.eq('roomId', room._id).eq('deviceToken', deviceToken))
      .unique();
    if (!member) return null;
    const award = await ctx.db
      .query('bountyAwards')
      .withIndex('by_room', (q) => q.eq('roomId', room._id))
      .unique();
    if (!award) return null;
    const squad = await ctx.db
      .query('members')
      .withIndex('by_room', (q) => q.eq('roomId', room._id))
      .collect();
    const mine =
      award.mode === 'transfer'
        ? await ctx.db
            .query('bountyPayouts')
            .withIndex('by_award', (q) => q.eq('awardId', award._id))
            .filter((q) => q.eq(q.field('memberId'), member._id))
            .first()
        : null;
    const myPayout: AwardPayoutView = mine
      ? {
          status: mine.status,
          amountCents: mine.cents,
          ...(mine.failureCode ? { failureCode: mine.failureCode } : {}),
          ...(mine.transferId && mine.status === 'sent' ? { transferId: mine.transferId } : {}),
          message: payoutMessage(mine.status, mine.cents),
        }
      : { status: award.mode === 'transfer' ? 'sending' : 'concept', amountCents: award.perPlayerCents };
    return {
      myPayout,
      split: squad.map((m) => ({ name: m.name, cents: award.perPlayerCents, isMe: m._id === member._id })),
      place: award.place,
      amountCents: award.amountCents,
      perPlayerCents: award.perPlayerCents,
      currency: 'usd',
      mode: award.mode,
      status: award.status,
      claimUrl: award.claimUrl,
      redeemableCount: award.redeemableCount,
      label: award.label,
      expiresAt: award.expiresAt ? Date.parse(award.expiresAt) : null,
    };
  },
});

const HOSTED_DROP_HOLD_MS = 24 * 60 * 60 * 1000;

// Host screen: creates a drop this device runs and deals by hand. Public, so it always pays in concept mode;
// no client can create a drop that spends real money. The bounty is display only.
// The newest name this device has played or entered a drop under, from squad seats and drop entries.
async function lastNameOf(ctx: MutationCtx, deviceToken: string): Promise<string | null> {
  const [member, entry] = await Promise.all([
    ctx.db.query('members').withIndex('by_token', (q) => q.eq('deviceToken', deviceToken)).order('desc').first(),
    ctx.db.query('dropEntries').withIndex('by_token', (q) => q.eq('deviceToken', deviceToken)).order('desc').first(),
  ]);
  const latest = [member, entry].filter((d) => d !== null).sort((a, b) => b._creationTime - a._creationTime)[0];
  return latest?.name.trim() || null;
}

export const hostDrop = mutation({
  args: {
    deviceToken: v.string(),
    title: v.optional(v.string()),
    winnerSlots: v.optional(v.number()),
    totalCents: v.optional(v.number()),
    creatorName: v.optional(v.string()),
    startsAt: v.optional(v.number()), // a scheduled drop (feed.ts); omitted, the drop opens now
    avatarUrl: v.optional(v.string()), // https only; shown on the streamer's card
    template: v.optional(v.literal('split-passphrase')), // omitted: the Case 01 mystery
    rehearsal: v.optional(v.boolean()), // a rehearsal: plays as usual, but stays out of discovery and the feed (feed.ts)
    // real: pay winners by Whop transfer (refused unless real payouts are on and the pool fits the remaining budget).
    // concept: never real money. Omitted: as before.
    payoutMode: v.optional(v.union(v.literal('real'), v.literal('concept'))),
    minPlayers: v.optional(v.number()), // players dealSquads waits for, clamped to squadSize..DROP_CAPACITY; omitted: squadSize
  },
  handler: async (ctx, { deviceToken, title, winnerSlots, totalCents, creatorName, startsAt, avatarUrl, template, rehearsal, payoutMode, minPlayers }) => {
    if (!deviceToken) fail('WRONG_STATUS', 'Missing device token.');
    await enforceRateLimit(ctx, 'hostDrop', deviceToken);
    if (payoutMode === 'real') await requireRealBudget(ctx, totalCents ?? 30_000, winnerSlots ?? 3);
    if (startsAt !== undefined) checkScheduledStart(startsAt, Date.now());
    const name = (creatorName ?? '').trim().slice(0, 24) || (await lastNameOf(ctx, deviceToken)) || 'Host';
    const { whopUserId } = await resolveIdentity(ctx, deviceToken);
    const hosted = await insertDrop(ctx, {
      dropId: `host-${Date.now().toString(36)}-${Math.floor(Math.random() * 46656).toString(36)}`,
      title: (title ?? 'The Aurora Seed').trim().slice(0, 60) || 'The Aurora Seed',
      creatorName: name,
      squadSize: 3,
      startsAt: startsAt ?? Date.now() + HOSTED_DROP_HOLD_MS,
      bounty: { totalCents: totalCents ?? 30_000, winnerSlots: winnerSlots ?? 3 },
      hostToken: deviceToken,
      ...(whopUserId ? { hostWhopUserId: whopUserId } : {}),
      ...(template ? { template } : {}),
      ...(payoutMode ? { payoutMode } : {}),
      ...(minPlayers !== undefined ? { minPlayers: clampMinPlayers(minPlayers, 3) } : {}),
    });
    await noteHostedDrop(ctx, { hostToken: deviceToken, name, dropId: hosted.dropId, scheduledFor: startsAt ?? null, avatarUrl, rehearsal });
    return hosted;
  },
});

const dollars = (cents: number) => '$' + (cents / 100).toFixed(2).replace(/\.00$/, '');

// A real-money pool must fit what's left of the real budget, and each squad's share the per-award cap.
async function requireRealBudget(ctx: QueryCtx, totalCents: number, winnerSlots: number) {
  if (process.env.SIGNAL_REAL_PAYOUTS !== 'on') fail('REAL_PAYOUTS_OFF', 'Real payouts are off on this server. Pick concept.');
  const remaining = await realBudgetRemainingCents(ctx);
  if (totalCents <= 0 || totalCents > remaining) {
    fail('REAL_BUDGET_EXCEEDED', `Real payouts have ${dollars(remaining)} left. Pick a pot up to ${dollars(remaining)}, or concept.`);
  }
  if (Math.floor(totalCents / Math.max(1, winnerSlots)) > realPayoutCapCents()) {
    fail('REAL_BUDGET_EXCEEDED', `Each winning squad can get at most ${dollars(realPayoutCapCents())} in real money. Lower the pot, add winner slots, or pick concept.`);
  }
}

// The host screen's pot picker: whether a real pot can be chosen and how much is left.
export const realPayoutStatus = query({
  args: {},
  handler: async (ctx): Promise<RealPayoutStatusView> => ({
    enabled: process.env.SIGNAL_REAL_PAYOUTS === 'on' && realPayoutBudgetCents() > 0,
    remainingCents: await realBudgetRemainingCents(ctx),
    capPerSquadCents: realPayoutCapCents(),
  }),
});

// One full squad can play, and a race always has at least two entrants, unless the host asked for more (minPlayers).
export const minToDeal = (drop: Doc<'drops'>) => drop.minPlayers ?? Math.max(2, drop.squadSize);

export const clampMinPlayers = (minPlayers: number, size: number) =>
  Number.isFinite(minPlayers) ? Math.min(DROP_CAPACITY, Math.max(2, size, Math.floor(minPlayers))) : Math.max(2, size);

// Host-only "Deal squads": starts the drop now and splits squads with the usual rules.
export const dealSquads = mutation({
  args: { deviceToken: v.string(), dropId: v.string() },
  handler: async (ctx, { deviceToken, dropId }) => {
    const drop = await requireDrop(ctx, dropId);
    if (!(await isDropHost(ctx, drop, deviceToken))) fail('NOT_HOST', 'Only the host can deal squads.');
    const needMore = minToDeal(drop) - (await entriesOf(ctx, dropId)).length;
    if (needMore > 0) fail('NOT_ENOUGH_PLAYERS', `Deal squads needs at least ${minToDeal(drop)} players.`, { needMore });
    await startDropNow(ctx, dropId);
  },
});

export const hostView = query({
  args: { deviceToken: v.string(), dropId: v.string() },
  handler: async (ctx, { deviceToken, dropId }): Promise<HostView | null> => {
    const drop = await findDrop(ctx, dropId);
    if (!drop || !(await isDropHost(ctx, drop, deviceToken))) return null;
    const entries = await entriesOf(ctx, dropId);
    const rooms = await ctx.db
      .query('rooms')
      .withIndex('by_drop', (q) => q.eq('dropId', dropId))
      .collect();
    const solves = await ctx.db
      .query('solves')
      .withIndex('by_drop', (q) => q.eq('dropId', dropId))
      .collect();
    const labelOf = new Map(rooms.map((r) => [r._id, r.squadLabel ?? '']));
    const squads = [];
    for (const room of rooms) {
      const solve = solves.find((s) => s.roomId === room._id);
      const names = (
        await ctx.db
          .query('members')
          .withIndex('by_room', (q) => q.eq('roomId', room._id))
          .collect()
      ).map((m) => m.name);
      squads.push({
        squadLabel: room.squadLabel ?? '',
        memberNames: names,
        status: !solve ? ('solving' as const) : solve.place <= drop.bounty.winnerSlots ? ('winner' as const) : ('solved' as const),
        rank: solve?.place ?? null,
      });
    }
    return {
      dropId,
      title: drop.title,
      joinCode: drop.joinCode ?? '',
      status: drop.status,
      bounty: await bountyView(ctx, drop),
      entrantCount: entries.length,
      minToDeal: minToDeal(drop),
      needMore: Math.max(0, minToDeal(drop) - entries.length),
      entrants: entries.map((e) => ({ name: e.name, joinedAt: e._creationTime })),
      squads,
      solves: solves.map((s) => ({
        place: s.place,
        squadLabel: labelOf.get(s.roomId) ?? '',
        solvedAt: s.solvedAt,
        solveMs: s.solveMs,
        isWinner: s.place <= drop.bounty.winnerSlots,
      })),
    };
  },
});

const MY_HOSTED_WINDOW_MS = 24 * 60 * 60 * 1000;
const HOSTED_STATUS = { scheduled: 'lobby', live: 'live', ended: 'finished' } as const;

// "My live drops": the drops the signed-in Whop account hosted in the last 24 hours, from any device, newest first.
export const myHostedDrops = query({
  args: { deviceToken: v.string() },
  handler: async (ctx, { deviceToken }): Promise<HostedDropRow[]> => {
    const { whopUserId } = await resolveIdentity(ctx, deviceToken);
    if (!whopUserId) return [];
    const drops = await ctx.db
      .query('drops')
      .withIndex('by_host_whop', (q) => q.eq('hostWhopUserId', whopUserId).gt('_creationTime', Date.now() - MY_HOSTED_WINDOW_MS))
      .order('desc')
      .take(50);
    return Promise.all(
      drops.map(async (drop) => {
        const listing = await ctx.db
          .query('streamerDrops')
          .withIndex('by_drop', (q) => q.eq('dropId', drop.dropId))
          .unique();
        return {
          dropId: drop.dropId,
          code: drop.joinCode ?? '',
          title: drop.title,
          template: drop.template ?? 'case01',
          status: HOSTED_STATUS[drop.status],
          players: (await entriesOf(ctx, drop.dropId)).length,
          createdAt: drop._creationTime,
          scheduledFor: listing?.scheduledFor ?? null,
        };
      }),
    );
  },
});
