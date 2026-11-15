import { ConvexError, v } from 'convex/values';
import type { Doc, Id } from './_generated/dataModel';
import { mutation, query, type MutationCtx, type QueryCtx } from './_generated/server';
import { ANSWER, DOSSIERS, NUDGES, REVEAL, ROLES } from './case01';
import { presence as presenceComponent } from './presence';
import { presence, role, suspect } from './schema';
import type {
  ActiveRoomView,
  DossierView,
  JoinResult,
  LockInResult,
  Role,
  RevealView,
  RoomView,
  SignalErrorCode,
} from '../src/lib/contract';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MAX_MEMBERS = 3;

function fail(code: SignalErrorCode, message: string): never {
  throw new ConvexError({ code, message });
}

function cleanName(name: string) {
  const trimmed = name.trim().slice(0, 24);
  if (!trimmed) fail('WRONG_STATUS', 'Enter a name first.');
  return trimmed;
}

async function findRoom(ctx: QueryCtx, code: string) {
  return ctx.db
    .query('rooms')
    .withIndex('by_code', (q) => q.eq('code', code.trim().toUpperCase()))
    .unique();
}

async function findMember(ctx: QueryCtx, roomId: Id<'rooms'>, deviceToken: string) {
  return ctx.db
    .query('members')
    .withIndex('by_room_token', (q) => q.eq('roomId', roomId).eq('deviceToken', deviceToken))
    .unique();
}

async function requireRoom(ctx: QueryCtx, code: string) {
  const room = await findRoom(ctx, code);
  if (!room) fail('ROOM_NOT_FOUND', 'No room with that code.');
  return room;
}

async function requireCaller(ctx: MutationCtx, code: string, deviceToken: string) {
  const room = await requireRoom(ctx, code);
  const me = await findMember(ctx, room._id, deviceToken);
  if (!me) fail('NOT_A_MEMBER', 'You are not in this room.');
  return { room, me };
}

function requireHost(room: Doc<'rooms'>, deviceToken: string) {
  if (room.hostToken !== deviceToken) fail('NOT_HOST', 'Only the host can do that.');
}

async function members(ctx: QueryCtx, roomId: Id<'rooms'>) {
  return ctx.db
    .query('members')
    .withIndex('by_room', (q) => q.eq('roomId', roomId))
    .collect();
}

async function onlineMemberIds(ctx: QueryCtx, room: Doc<'rooms'>) {
  const online = await presenceComponent.listRoom(ctx, room.code, true);
  return new Set(online.map((p) => p.userId));
}

function reclaimable(all: Doc<'members'>[], online: Set<string>): Role[] {
  return ROLES.filter((r) => all.some((m) => m.role === r && !online.has(m._id)));
}

async function clearLockIns(ctx: MutationCtx, roomId: Id<'rooms'>) {
  const locks = await ctx.db
    .query('lockIns')
    .withIndex('by_room', (q) => q.eq('roomId', roomId))
    .collect();
  await Promise.all(locks.map((l) => ctx.db.delete(l._id)));
}

async function generateCode(ctx: MutationCtx) {
  for (;;) {
    let code = '';
    for (let i = 0; i < 4; i++) code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    if (!(await findRoom(ctx, code))) return code;
  }
}

export const activeRoom = query({
  args: { deviceToken: v.string() },
  handler: async (ctx, { deviceToken }): Promise<ActiveRoomView> => {
    const mine = await ctx.db
      .query('members')
      .withIndex('by_token', (q) => q.eq('deviceToken', deviceToken))
      .order('desc')
      .first();
    if (!mine) return null;
    const room = await ctx.db.get(mine.roomId);
    if (!room) return null;
    return { code: room.code, status: room.status, role: mine.role };
  },
});

export const room = query({
  args: { deviceToken: v.string(), code: v.string() },
  handler: async (ctx, { deviceToken, code }): Promise<RoomView | null> => {
    const room = await findRoom(ctx, code);
    if (!room) return null;
    const me = await findMember(ctx, room._id, deviceToken);
    const all = await members(ctx, room._id);
    const online = await onlineMemberIds(ctx, room);
    const editor = room.theory.lastEditedBy ? all.find((m) => m._id === room.theory.lastEditedBy) : undefined;
    const locks = (
      await ctx.db
        .query('lockIns')
        .withIndex('by_room', (q) => q.eq('roomId', room._id))
        .collect()
    ).filter((l) => l.revision === room.theory.revision);
    const locked = new Set(locks.map((l) => l.memberId));
    return {
      code: room.code,
      status: room.status,
      caseId: room.caseId,
      isHost: room.hostToken === deviceToken,
      me: me ? { memberId: me._id, role: me.role, name: me.name } : null,
      members: all.map((m) => ({
        memberId: m._id,
        name: m.name,
        role: m.role,
        presence: !online.has(m._id)
          ? 'offline'
          : room.status === 'playing' && locked.has(m._id)
            ? 'ready'
            : m.presence,
        isHost: m.deviceToken === room.hostToken,
        isMe: m._id === me?._id,
      })),
      theory: {
        culprit: room.theory.culprit,
        revision: room.theory.revision,
        lastEditedBy: editor ? { memberId: editor._id, name: editor.name } : null,
      },
      lockIns: locks.map((l) => ({ memberId: l.memberId, revision: l.revision })),
      attempts: room.attempts,
      lastNudge: room.lastNudge,
      checkedRevision: room.checkedRevision,
      checkSeq: room.checkSeq,
      lastCheck: room.lastCheck,
      reclaimableRoles: reclaimable(all, online),
    };
  },
});

export const myDossier = query({
  args: { deviceToken: v.string(), code: v.string() },
  handler: async (ctx, { deviceToken, code }): Promise<DossierView | null> => {
    const room = await findRoom(ctx, code);
    if (!room || room.status === 'lobby') return null;
    const me = await findMember(ctx, room._id, deviceToken);
    if (!me?.role) return null;
    return DOSSIERS[me.role];
  },
});

export const reveal = query({
  args: { deviceToken: v.string(), code: v.string() },
  handler: async (ctx, { deviceToken, code }): Promise<RevealView | null> => {
    const room = await findRoom(ctx, code);
    if (!room || room.status !== 'resolved') return null;
    if (!(await findMember(ctx, room._id, deviceToken))) return null;
    const all = await members(ctx, room._id);
    return {
      culprit: REVEAL.culprit,
      timeline: REVEAL.timeline,
      why: REVEAL.why,
      credits: REVEAL.credits.map((c) => ({
        ...c,
        memberName: all.find((m) => m.role === c.role)?.name ?? c.role,
      })),
      teaser: REVEAL.teaser,
    };
  },
});

export const createRoom = mutation({
  args: { deviceToken: v.string(), name: v.string() },
  handler: async (ctx, { deviceToken, name }) => {
    const code = await generateCode(ctx);
    const roomId = await ctx.db.insert('rooms', {
      code,
      hostToken: deviceToken,
      caseId: 'case01',
      status: 'lobby',
      theory: { culprit: null, revision: 0, lastEditedBy: null },
      attempts: 0,
      lastNudge: null,
      checkedRevision: null,
      checkSeq: 0,
      lastCheck: null,
    });
    await ctx.db.insert('members', { roomId, deviceToken, name: cleanName(name), role: null, presence: 'online' });
    return { code };
  },
});

export const joinRoom = mutation({
  args: { deviceToken: v.string(), code: v.string(), name: v.string() },
  handler: async (ctx, { deviceToken, code, name }): Promise<JoinResult> => {
    const room = await requireRoom(ctx, code);
    const all = await members(ctx, room._id);
    if (all.some((m) => m.deviceToken === deviceToken)) {
      return { code: room.code, status: 'rejoined', reclaimableRoles: [] };
    }
    if (room.status === 'lobby' && all.length < MAX_MEMBERS) {
      await ctx.db.insert('members', {
        roomId: room._id,
        deviceToken,
        name: cleanName(name),
        role: null,
        presence: 'online',
      });
      return { code: room.code, status: 'joined', reclaimableRoles: [] };
    }
    const seats = reclaimable(all, await onlineMemberIds(ctx, room));
    if (seats.length) return { code: room.code, status: 'reclaim', reclaimableRoles: seats };
    if (room.status === 'lobby') fail('ROOM_FULL', 'This room already has 3 players.');
    fail('CASE_STARTED', 'This case has already started.');
  },
});

export const reclaimRole = mutation({
  args: { deviceToken: v.string(), code: v.string(), role },
  handler: async (ctx, { deviceToken, code, role }) => {
    const room = await requireRoom(ctx, code);
    const all = await members(ctx, room._id);
    if (all.some((m) => m.deviceToken === deviceToken)) fail('WRONG_STATUS', 'You are already in this room.');
    const holder = all.find((m) => m.role === role);
    if (!holder) fail('WRONG_STATUS', 'Nobody holds that role. Join and claim it instead.');
    if ((await onlineMemberIds(ctx, room)).has(holder._id)) fail('ROLE_TAKEN', 'That player is still here.');
    await ctx.db.patch(holder._id, { deviceToken });
    if (room.hostToken === holder.deviceToken) await ctx.db.patch(room._id, { hostToken: deviceToken });
  },
});

export const claimRole = mutation({
  args: { deviceToken: v.string(), code: v.string(), role },
  handler: async (ctx, { deviceToken, code, role }) => {
    const { room, me } = await requireCaller(ctx, code, deviceToken);
    if (room.status !== 'lobby') fail('CASE_STARTED', 'Roles are locked once the case starts.');
    const holder = (await members(ctx, room._id)).find((m) => m.role === role);
    if (holder && holder._id !== me._id) fail('ROLE_TAKEN', 'Someone already took that role.');
    await ctx.db.patch(me._id, { role });
  },
});

export const startCase = mutation({
  args: { deviceToken: v.string(), code: v.string() },
  handler: async (ctx, { deviceToken, code }) => {
    const { room } = await requireCaller(ctx, code, deviceToken);
    requireHost(room, deviceToken);
    if (room.status !== 'lobby') fail('WRONG_STATUS', 'The case has already started.');
    const all = await members(ctx, room._id);
    if (!ROLES.every((r) => all.some((m) => m.role === r))) fail('ROLES_NOT_FILLED', 'All 3 roles must be claimed.');
    await Promise.all(all.map((m) => ctx.db.patch(m._id, { presence: 'online' })));
    await ctx.db.patch(room._id, { status: 'intro' });
  },
});

export const setPresence = mutation({
  args: { deviceToken: v.string(), code: v.string(), presence },
  handler: async (ctx, { deviceToken, code, presence }) => {
    const { room, me } = await requireCaller(ctx, code, deviceToken);
    await ctx.db.patch(me._id, { presence });
    if (room.status !== 'intro') return;
    const all = await members(ctx, room._id);
    if (all.every((m) => (m._id === me._id ? presence : m.presence) === 'ready')) {
      await Promise.all(all.map((m) => ctx.db.patch(m._id, { presence: 'reviewing' })));
      await ctx.db.patch(room._id, { status: 'playing' });
    }
  },
});

export const setTheory = mutation({
  args: { deviceToken: v.string(), code: v.string(), culprit: v.union(suspect, v.null()) },
  handler: async (ctx, { deviceToken, code, culprit }) => {
    const { room, me } = await requireCaller(ctx, code, deviceToken);
    if (room.status !== 'playing') fail('WRONG_STATUS', 'The theory can only change while playing.');
    if (culprit === room.theory.culprit) return { revision: room.theory.revision };
    const revision = room.theory.revision + 1;
    await clearLockIns(ctx, room._id);
    await ctx.db.patch(room._id, { theory: { culprit, revision, lastEditedBy: me._id }, lastNudge: null });
    return { revision };
  },
});

export const lockIn = mutation({
  args: { deviceToken: v.string(), code: v.string(), revision: v.number() },
  handler: async (ctx, { deviceToken, code, revision }): Promise<LockInResult> => {
    const { room, me } = await requireCaller(ctx, code, deviceToken);
    if (room.status !== 'playing') fail('WRONG_STATUS', 'Nothing to lock in right now.');
    if (revision !== room.theory.revision) fail('STALE_REVISION', 'The theory changed. Review it and lock in again.');
    if (revision === room.checkedRevision) fail('ALREADY_CHECKED', 'Already checked. Change the theory to try again.');
    const culprit = room.theory.culprit;
    if (!culprit) fail('WRONG_STATUS', 'Pick a culprit before locking in.');

    const existing = await ctx.db
      .query('lockIns')
      .withIndex('by_member', (q) => q.eq('memberId', me._id))
      .collect();
    await Promise.all(existing.map((l) => ctx.db.delete(l._id)));
    await ctx.db.insert('lockIns', { roomId: room._id, memberId: me._id, revision });

    const locks = await ctx.db
      .query('lockIns')
      .withIndex('by_room', (q) => q.eq('roomId', room._id))
      .collect();
    const lockedCount = new Set(locks.filter((l) => l.revision === revision).map((l) => l.memberId)).size;
    if (lockedCount < MAX_MEMBERS) return { outcome: 'locked', lockedCount };

    const seq = room.checkSeq + 1;
    if (culprit === ANSWER) {
      await ctx.db.patch(room._id, {
        status: 'resolved',
        lastNudge: null,
        checkSeq: seq,
        lastCheck: { seq, result: 'correct', at: Date.now() },
      });
      return { outcome: 'resolved' };
    }
    const nudge = { wrongPick: culprit, ...NUDGES[culprit], revision };
    const attempts = room.attempts + 1;
    await clearLockIns(ctx, room._id);
    await ctx.db.patch(room._id, {
      attempts,
      lastNudge: nudge,
      checkedRevision: revision,
      checkSeq: seq,
      lastCheck: { seq, result: 'wrong', at: Date.now() },
    });
    return { outcome: 'wrong', nudge, attempts };
  },
});

export const restart = mutation({
  args: { deviceToken: v.string(), code: v.string(), confirm: v.boolean() },
  handler: async (ctx, { deviceToken, code, confirm }) => {
    const { room } = await requireCaller(ctx, code, deviceToken);
    requireHost(room, deviceToken);
    if (!confirm) fail('CONFIRM_REQUIRED', 'Confirm the restart first.');
    await clearLockIns(ctx, room._id);
    const all = await members(ctx, room._id);
    await Promise.all(all.map((m) => ctx.db.patch(m._id, { presence: 'online' })));
    await ctx.db.patch(room._id, {
      status: 'lobby',
      theory: { culprit: null, revision: room.theory.revision + 1, lastEditedBy: null },
      attempts: 0,
      lastNudge: null,
      lastCheck: null,
    });
  },
});

export const leaveRoom = mutation({
  args: { deviceToken: v.string(), code: v.string() },
  handler: async (ctx, { deviceToken, code }) => {
    const { room, me } = await requireCaller(ctx, code, deviceToken);
    if (room.status === 'intro' || room.status === 'playing') fail('CASE_STARTED', 'You can leave once the case is over.');
    await ctx.db.delete(me._id);
    await presenceComponent.removeRoomUser(ctx, room.code, me._id);
    const rest = await members(ctx, room._id);
    if (rest.length === 0) {
      await presenceComponent.removeRoom(ctx, room.code);
      await ctx.db.delete(room._id);
      return;
    }
    if (room.hostToken === deviceToken) await ctx.db.patch(room._id, { hostToken: rest[0].deviceToken });
  },
});
