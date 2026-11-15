import { ConvexError, v } from 'convex/values';

import { internal } from './_generated/api';
import type { Doc } from './_generated/dataModel';
import { internalMutation, mutation, query, type MutationCtx, type QueryCtx } from './_generated/server';
import { ROLES, type Role } from './case01';
import { presence as presenceComponent } from './presence';
import { squadSize } from './schema';
import { CODE_ALPHABET, generateCode } from './signal';
import type {
  BountyView,
  DropSummaryView,
  DropView,
  HostView,
  LeaderboardRow,
  LeaderboardView,
  SignalErrorCode,
  SquadAwardView,
  SquadSize,
} from '../src/lib/contract';

export const DEMO_DROP_ID = 'aurora-demo';

function fail(code: SignalErrorCode, message: string): never {
  throw new ConvexError({ code, message });
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
export function dealPieces(dropId: string, squadIndex: number, size: SquadSize): Role[][] {
  const k = hash(`${dropId}:${squadIndex}`) % 3;
  const order = [...ROLES.slice(k), ...ROLES.slice(0, k)];
  return size === 3 ? order.map((r) => [r]) : [[order[0], order[1]], [order[2]]];
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

function bountyView(drop: Doc<'drops'>): BountyView {
  const sandbox = !drop.conceptOnly && process.env.BOUNTY_MODE === 'sandbox';
  return {
    totalCents: drop.bounty.totalCents,
    currency: 'usd',
    winnerSlots: drop.bounty.winnerSlots,
    perSquadCents: Math.floor(drop.bounty.totalCents / drop.bounty.winnerSlots),
    mode: sandbox ? 'sandbox' : 'concept',
  };
}

function summary(drop: Doc<'drops'>, entrantCount: number): DropSummaryView {
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
    bounty: bountyView(drop),
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
    return Promise.all(listed.map(async (d) => summary(d, (await entriesOf(ctx, d.dropId)).length)));
  },
});

async function dropView(ctx: QueryCtx, drop: Doc<'drops'>, deviceToken: string): Promise<DropView> {
  const entries = await entriesOf(ctx, drop.dropId);
    const mine = entries.find((e) => e.deviceToken === deviceToken);
    const room = mine?.squadRoomId ? await ctx.db.get(mine.squadRoomId) : null;
    return {
      ...summary(drop, entries.length),
      entrants: entries.map((e) => ({ name: e.name, isMe: e.deviceToken === deviceToken })),
      me: {
        entered: !!mine,
        name: mine?.name ?? null,
        squad: room ? { code: room.code, size: room.squadSize ?? 3, label: room.squadLabel ?? '' } : null,
        unmatched: mine?.unmatched ?? false,
      },
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

// Free entry: no entitlement is read or required, ever.
async function enter(ctx: MutationCtx, drop: Doc<'drops'>, deviceToken: string, name: string) {
  const dropId = drop.dropId;
  if (drop.status !== 'scheduled') fail('DROP_CLOSED', 'Entries closed when the drop started.');
  const clean = name.trim().slice(0, 24);
  if (!clean) fail('WRONG_STATUS', 'Enter a name first.');
  const existing = await findEntry(ctx, dropId, deviceToken);
  if (existing) {
    await ctx.db.patch(existing._id, { name: clean });
    return;
  }
  await ctx.db.insert('dropEntries', { dropId, deviceToken, name: clean, unmatched: false });
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
      status: 'intro',
      theory: { culprit: null, revision: 0, lastEditedBy: null },
      attempts: 0,
      lastNudge: null,
      checkedRevision: null,
      checkSeq: 0,
      lastCheck: null,
    });
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
    return {
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
export const hostDrop = mutation({
  args: {
    deviceToken: v.string(),
    title: v.optional(v.string()),
    winnerSlots: v.optional(v.number()),
    totalCents: v.optional(v.number()),
    creatorName: v.optional(v.string()),
  },
  handler: async (ctx, { deviceToken, title, winnerSlots, totalCents, creatorName }) => {
    if (!deviceToken) fail('WRONG_STATUS', 'Missing device token.');
    return insertDrop(ctx, {
      dropId: `host-${Date.now().toString(36)}-${Math.floor(Math.random() * 46656).toString(36)}`,
      title: (title ?? 'The Aurora Seed').trim().slice(0, 60) || 'The Aurora Seed',
      creatorName: (creatorName ?? '').trim().slice(0, 24) || 'Host',
      squadSize: 3,
      startsAt: Date.now() + HOSTED_DROP_HOLD_MS,
      bounty: { totalCents: totalCents ?? 30_000, winnerSlots: winnerSlots ?? 3 },
      hostToken: deviceToken,
    });
  },
});

export const MIN_DEAL_ENTRANTS = 4;

// Host-only "Deal squads": starts the drop now and splits squads with the usual rules.
export const dealSquads = mutation({
  args: { deviceToken: v.string(), dropId: v.string() },
  handler: async (ctx, { deviceToken, dropId }) => {
    const drop = await requireDrop(ctx, dropId);
    if (!drop.hostToken || drop.hostToken !== deviceToken) fail('NOT_HOST', 'Only the host can deal squads.');
    if ((await entriesOf(ctx, dropId)).length < MIN_DEAL_ENTRANTS) {
      fail('NOT_ENOUGH_PLAYERS', `Deal squads needs at least ${MIN_DEAL_ENTRANTS} players.`);
    }
    await startDropNow(ctx, dropId);
  },
});

export const hostView = query({
  args: { deviceToken: v.string(), dropId: v.string() },
  handler: async (ctx, { deviceToken, dropId }): Promise<HostView | null> => {
    const drop = await findDrop(ctx, dropId);
    if (!drop?.hostToken || drop.hostToken !== deviceToken) return null;
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
      bounty: bountyView(drop),
      entrantCount: entries.length,
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
