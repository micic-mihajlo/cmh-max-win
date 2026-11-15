/// <reference types="vite/client" />
import presenceTest from '@convex-dev/presence/test';
import rateLimiterTest from '@convex-dev/rate-limiter/test';
import { convexTest } from 'convex-test';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { api, internal } from './_generated/api';
import { ABANDONED_LOBBY_MS, STALE_DRAFT_MS, WHOP_SESSION_SWEEP_AFTER_MS } from './hardening';
import schema from './schema';
import { CHALLENGE_CAPACITY_MAX, type ChallengeConfigPatch } from '../src/lib/contract';

const modules = import.meta.glob('./**/*.ts');
const HOST = 'host';
const MIN = 60_000;

function newTest() {
  const t = convexTest(schema, modules);
  presenceTest.register(t);
  rateLimiterTest.register(t);
  return t;
}
type T = ReturnType<typeof newTest>;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-15T22:00:00Z'));
});
afterEach(() => vi.useRealTimers());

async function failure(p: Promise<unknown>) {
  try {
    await p;
  } catch (e) {
    return (e as { data: { code: string; retryAfterMs?: number } }).data;
  }
  throw new Error('expected the call to fail');
}
const errorCode = async (p: Promise<unknown>) => (await failure(p)).code;
const tokens = (n: number, prefix = 'p') => Array.from({ length: n }, (_, i) => prefix + (i + 1));

async function draft(t: T, patch: ChallengeConfigPatch = {}) {
  await t.mutation(api.challenges.saveCreatorProfile, { deviceToken: HOST, displayName: 'Nova', handle: '@nova' });
  const { challengeId } = await t.mutation(api.challenges.createChallenge, { deviceToken: HOST, patch: { title: 'Friday race', poolCents: 10_000, ...patch } });
  return challengeId;
}
async function publish(t: T, challengeId: string) {
  return (await t.mutation(api.challenges.publishChallenge, { deviceToken: HOST, challengeId })).joinCode;
}
const join = (t: T, code: string, deviceToken: string) => t.action(api.challenges.joinChallenge, { deviceToken, code, name: deviceToken.toUpperCase() });

describe('rate limits', () => {
  test('a device gets 10 quick joins, then RATE_LIMITED with a retry time', async () => {
    const t = newTest();
    for (let i = 0; i < 10; i++) expect(await errorCode(join(t, 'ZZZZ', 'p1'))).toBe('CHALLENGE_NOT_FOUND');
    const limited = await failure(join(t, 'ZZZZ', 'p1'));
    expect(limited.code).toBe('RATE_LIMITED');
    expect(limited.retryAfterMs).toBeGreaterThan(0);
    expect(await errorCode(join(t, 'ZZZZ', 'p2'))).toBe('CHALLENGE_NOT_FOUND');
    vi.setSystemTime(Date.now() + MIN);
    expect(await errorCode(join(t, 'ZZZZ', 'p1'))).toBe('CHALLENGE_NOT_FOUND');
  });

  test('one challenge takes a crowd of joins at once, then RATE_LIMITED past its burst', async () => {
    const t = newTest();
    const code = await publish(t, await draft(t));
    const results = [];
    for (const deviceToken of tokens(320)) {
      results.push(await join(t, code, deviceToken).then(() => 'ok', (e) => (e as { data: { code: string } }).data.code));
    }
    expect(results.slice(0, 100).every((r) => r === 'ok')).toBe(true);
    expect(results).toContain('RATE_LIMITED');
    expect(results.filter((r) => r === 'ok').length).toBeLessThanOrEqual(300);
  });

  test('a host gets 10 quick host actions per challenge', async () => {
    const t = newTest();
    const challengeId = await draft(t);
    for (let i = 0; i < 10; i++) await t.mutation(api.challenges.updateChallengeDraft, { deviceToken: HOST, challengeId, patch: { title: 'T' + i } });
    expect(await errorCode(t.mutation(api.challenges.updateChallengeDraft, { deviceToken: HOST, challengeId, patch: { title: 'X' } }))).toBe(
      'RATE_LIMITED',
    );
    const other = (await t.mutation(api.challenges.createChallenge, { deviceToken: HOST })).challengeId;
    await t.mutation(api.challenges.updateChallengeDraft, { deviceToken: HOST, challengeId: other, patch: { title: 'Y' } });
  });

  test('a seat gets 20 quick player actions, and the other seats are unaffected', async () => {
    const t = newTest();
    const challengeId = await draft(t, { teamFormation: 'mixer', templateId: 'split-passphrase', mixerColors: ['red', 'blue'] });
    const code = await publish(t, challengeId);
    for (const p of tokens(4)) await join(t, code, p);
    const me = await Promise.all(tokens(4).map(async (deviceToken) => (await t.query(api.challenges.myChallenge, { deviceToken, challengeId }))!.me.mixer!));
    const p1 = me.findIndex((m) => m.color === 'red');
    const partner = me.findIndex((m) => m.color === 'blue');
    const seat = 'p' + (p1 + 1);
    for (let i = 0; i < 10; i++) {
      await t.mutation(api.challenges.linkPlayer, { deviceToken: seat, challengeId, playerCode: me[partner].playerCode });
      await t.mutation(api.challenges.leaveMixerTeam, { deviceToken: seat, challengeId });
    }
    expect(await errorCode(t.mutation(api.challenges.linkPlayer, { deviceToken: seat, challengeId, playerCode: me[partner].playerCode }))).toBe(
      'RATE_LIMITED',
    );
    await t.mutation(api.challenges.linkPlayer, { deviceToken: 'p' + (partner + 1), challengeId, playerCode: me[p1].playerCode });
  });

  test('a creator makes at most 20 drafts an hour, counting clones', async () => {
    const t = newTest();
    const first = await draft(t);
    for (let i = 0; i < 18; i++) await t.mutation(api.challenges.createChallenge, { deviceToken: HOST });
    await t.mutation(api.challenges.cloneChallenge, { deviceToken: HOST, challengeId: first });
    expect(await errorCode(t.mutation(api.challenges.createChallenge, { deviceToken: HOST }))).toBe('RATE_LIMITED');
    expect(await errorCode(t.mutation(api.challenges.cloneChallenge, { deviceToken: HOST, challengeId: first }))).toBe('RATE_LIMITED');
  });
});

describe('capacity', () => {
  test('a creator caps a draft; the next new device gets CHALLENGE_FULL, a seated one rejoins, a leave frees a seat', async () => {
    const t = newTest();
    const challengeId = await draft(t, { startMode: 'live' });
    expect(await t.query(api.hardening.challengeCapacity, { challengeId })).toBeNull();
    expect(await t.mutation(api.hardening.setChallengeCapacity, { deviceToken: HOST, challengeId, capacity: 3 })).toMatchObject({ capacity: 3 });
    const code = await publish(t, challengeId);
    for (const p of tokens(3)) await join(t, code, p);
    expect(await errorCode(join(t, code, 'p4'))).toBe('CHALLENGE_FULL');
    expect(await join(t, code, 'p2')).toEqual({ challengeId });
    expect(await t.query(api.hardening.challengeCapacity, { challengeId })).toEqual({ capacity: 3, seated: 3, full: true });
    await t.mutation(api.challenges.leaveChallenge, { deviceToken: 'p1', challengeId });
    await join(t, code, 'p4');
    expect(await t.query(api.hardening.challengeCapacity, { challengeId })).toEqual({ capacity: 3, seated: 3, full: true });
  });

  test('only the creator sets capacity, only on a draft, within the platform maximum', async () => {
    const t = newTest();
    const challengeId = await draft(t);
    const set = (deviceToken: string, capacity: number) => t.mutation(api.hardening.setChallengeCapacity, { deviceToken, challengeId, capacity });
    expect(await errorCode(set('intruder', 2))).toBe('NOT_CREATOR');
    expect(await errorCode(set(HOST, 0))).toBe('INVALID_CONFIG');
    expect(await errorCode(set(HOST, CHALLENGE_CAPACITY_MAX + 1))).toBe('INVALID_CONFIG');
    expect(await errorCode(set(HOST, 2.5))).toBe('INVALID_CONFIG');
    await publish(t, challengeId);
    expect(await errorCode(set(HOST, 2))).toBe('CHALLENGE_CLOSED');
    expect(await t.query(api.hardening.challengeCapacity, { challengeId })).toEqual({ capacity: CHALLENGE_CAPACITY_MAX, seated: 0, full: false });
    expect(await errorCode(t.mutation(api.hardening.setChallengeCapacity, { deviceToken: HOST, challengeId: 'nope', capacity: 2 }))).toBe(
      'CHALLENGE_NOT_FOUND',
    );
  });
});

describe('sweeps', () => {
  test('abandoned Whop OAuth sessions are swept, fresh ones kept, and a rerun is a no-op', async () => {
    const t = newTest();
    const session = (state: string) =>
      t.run((ctx) => ctx.db.insert('whopOAuthSessions', { state, deviceToken: 'd', codeVerifier: 'v', returnUrl: 'cmhmaxwin://', createdAt: Date.now() }));
    await session('old');
    vi.setSystemTime(Date.now() + WHOP_SESSION_SWEEP_AFTER_MS + MIN);
    await session('fresh');
    await t.mutation(internal.hardening.sweepWhopOAuthSessions, {});
    await t.mutation(internal.hardening.sweepWhopOAuthSessions, {});
    expect((await t.run((ctx) => ctx.db.query('whopOAuthSessions').collect())).map((s) => s.state)).toEqual(['fresh']);
  });

  test('stale drafts are swept with their limits; published and recent drafts stay', async () => {
    const t = newTest();
    const stale = await draft(t);
    await t.mutation(api.hardening.setChallengeCapacity, { deviceToken: HOST, challengeId: stale, capacity: 5 });
    const live = await draft(t);
    await publish(t, live);
    vi.setSystemTime(Date.now() + STALE_DRAFT_MS + MIN);
    const recent = (await t.mutation(api.challenges.createChallenge, { deviceToken: HOST })).challengeId;
    expect(await t.mutation(internal.hardening.sweepStaleDrafts, {})).toEqual({ deleted: 1 });
    expect(await t.mutation(internal.hardening.sweepStaleDrafts, {})).toEqual({ deleted: 0 });
    const left = await t.run((ctx) => ctx.db.query('challenges').collect());
    expect(left.map((c) => c._id).sort()).toEqual([live, recent].sort());
    expect(await t.run((ctx) => ctx.db.query('challengeLimits').collect())).toEqual([]);
  });

  test('abandoned free-play lobbies are swept with their members; started rooms stay', async () => {
    const t = newTest();
    const { code: lobby } = await t.mutation(api.signal.createRoom, { deviceToken: 'a', name: 'A' });
    await t.mutation(api.signal.joinRoom, { deviceToken: 'b', code: lobby, name: 'B' });
    const { code: started } = await t.mutation(api.signal.createRoom, { deviceToken: 'h', name: 'H' });
    await t.mutation(api.signal.joinRoom, { deviceToken: 'h2', code: started, name: 'H2' });
    await t.mutation(api.signal.joinRoom, { deviceToken: 'h3', code: started, name: 'H3' });
    for (const [deviceToken, role] of [['h', 'detective'], ['h2', 'hacker'], ['h3', 'witness']] as const) {
      await t.mutation(api.signal.claimRole, { deviceToken, code: started, role });
    }
    await t.mutation(api.signal.startCase, { deviceToken: 'h', code: started });
    vi.setSystemTime(Date.now() + ABANDONED_LOBBY_MS + MIN);
    const { code: fresh } = await t.mutation(api.signal.createRoom, { deviceToken: 'c', name: 'C' });
    expect(await t.mutation(internal.hardening.sweepAbandonedLobbies, {})).toEqual({ deleted: 1 });
    expect(await t.mutation(internal.hardening.sweepAbandonedLobbies, {})).toEqual({ deleted: 0 });
    const rooms = await t.run((ctx) => ctx.db.query('rooms').collect());
    expect(rooms.map((r) => r.code).sort()).toEqual([started, fresh].sort());
    const members = await t.run((ctx) => ctx.db.query('members').collect());
    expect(members.map((m) => m.deviceToken).sort()).toEqual(['c', 'h', 'h2', 'h3']);
  });
});

describe('authz fixes', () => {
  test('nobody can reclaim a seat in a challenge team room', async () => {
    const t = newTest();
    const challengeId = await draft(t, { startMode: 'live', teamSize: 2 });
    const code = await publish(t, challengeId);
    for (const p of tokens(2)) await join(t, code, p);
    await t.mutation(api.challenges.dealTeams, { deviceToken: HOST, challengeId });
    const roomCode = (await t.query(api.challenges.myChallenge, { deviceToken: 'p1', challengeId }))!.me.team!.roomCode;
    vi.setSystemTime(Date.now() + 10 * MIN);
    expect((await t.query(api.signal.room, { deviceToken: 'outsider', code: roomCode }))?.reclaimableRoles).toEqual([]);
    expect(await errorCode(t.mutation(api.signal.reclaimRole, { deviceToken: 'outsider', code: roomCode, role: 'hacker' }))).toBe('CASE_STARTED');
  });

  test('a room with no host (drop squads, challenge teams) has no host, even for an empty token', async () => {
    const t = newTest();
    const code = 'HSTL';
    await t.run(async (ctx) => {
      const roomId = await ctx.db.insert('rooms', {
        code,
        hostToken: '',
        caseId: 'aurora01',
        status: 'resolved',
        theory: { culprit: null, revision: 0, lastEditedBy: null },
        attempts: 1,
        lastNudge: null,
        checkedRevision: null,
        checkSeq: 1,
        lastCheck: null,
      });
      await ctx.db.insert('members', { roomId, deviceToken: '', name: 'Empty', role: 'hacker', presence: 'online' });
    });
    expect(await errorCode(t.mutation(api.signal.restart, { deviceToken: '', code, confirm: true }))).toBe('NOT_HOST');
  });

  test('public demo controls cap the bounty at the video amount', async () => {
    const t = newTest();
    vi.stubEnv('SIGNAL_DEMO_CONTROLS', 'on');
    try {
      const { dropId } = await t.mutation(api.demo.openDrop, { squadSize: 2, totalCents: 10_000_000 });
      const drop = await t.run((ctx) => ctx.db.query('drops').withIndex('by_dropId', (q) => q.eq('dropId', dropId)).unique());
      expect(drop?.bounty.totalCents).toBe(30_000);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
