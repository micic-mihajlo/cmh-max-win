/// <reference types="vite/client" />
import presenceTest from '@convex-dev/presence/test';
import { convexTest } from 'convex-test';
import { describe, expect, test } from 'vitest';

import { api } from './_generated/api';
import schema from './schema';

const modules = import.meta.glob('./**/*.ts');

const HOST = 'token-host';
const B = 'token-b';
const C = 'token-c';
const ALL = [HOST, B, C];
const ROLE_OF: Record<string, 'hacker' | 'witness' | 'detective'> = { [HOST]: 'hacker', [B]: 'witness', [C]: 'detective' };

const UNIQUE_DOSSIER_TEXT = {
  hacker: 'DOCK RING seal test',
  witness: 'game of Go',
  detective: 'tamper strip',
} as const;
const ANSWER_LEAKS = ['jun', 'Jun', 'Halloway', 'drill override', 'anonymous message', 'Second Seed'];

function newTest() {
  const t = convexTest(schema, modules);
  presenceTest.register(t);
  return t;
}
type T = ReturnType<typeof newTest>;

async function online(t: T, code: string, deviceToken: string) {
  const { sessionToken } = await t.mutation(api.presence.heartbeat, {
    roomId: code,
    userId: deviceToken,
    sessionId: `session-${deviceToken}`,
    interval: 10_000,
  });
  return sessionToken;
}

async function errorCode(p: Promise<unknown>) {
  try {
    await p;
  } catch (e) {
    return (e as { data?: { code?: string } }).data?.code;
  }
  throw new Error('expected the call to fail');
}

async function lobby() {
  const t = newTest();
  const { code } = await t.mutation(api.signal.createRoom, { deviceToken: HOST, name: 'Maya' });
  await t.mutation(api.signal.joinRoom, { deviceToken: B, code, name: 'Ravi' });
  await t.mutation(api.signal.joinRoom, { deviceToken: C, code, name: 'Ana' });
  for (const deviceToken of ALL) {
    await t.mutation(api.signal.claimRole, { deviceToken, code, role: ROLE_OF[deviceToken] });
  }
  const sessions: Record<string, string> = {};
  for (const deviceToken of ALL) sessions[deviceToken] = await online(t, code, deviceToken);
  return { t, code, sessions };
}

async function playing() {
  const { t, code, sessions } = await lobby();
  await t.mutation(api.signal.startCase, { deviceToken: HOST, code });
  for (const deviceToken of ALL) await t.mutation(api.signal.setPresence, { deviceToken, code, presence: 'ready' });
  return { t, code, sessions };
}

async function pickAndLock(t: T, code: string, culprit: 'theo' | 'priya' | 'ines' | 'jun', lockers = ALL) {
  const { revision } = await t.mutation(api.signal.setTheory, { deviceToken: B, code, culprit });
  const results = [];
  for (const deviceToken of lockers) results.push(await t.mutation(api.signal.lockIn, { deviceToken, code, revision }));
  return { revision, results };
}

describe('lobby', () => {
  test('one role per player, 3 max, start is host-only and needs all roles', async () => {
    const t = newTest();
    const { code } = await t.mutation(api.signal.createRoom, { deviceToken: HOST, name: 'Maya' });
    expect(code).toMatch(/^[A-Z2-9]{4}$/);
    await t.mutation(api.signal.joinRoom, { deviceToken: B, code: code.toLowerCase(), name: 'Ravi' });
    await t.mutation(api.signal.claimRole, { deviceToken: HOST, code, role: 'hacker' });
    expect(await errorCode(t.mutation(api.signal.claimRole, { deviceToken: B, code, role: 'hacker' }))).toBe('ROLE_TAKEN');
    expect(await errorCode(t.mutation(api.signal.startCase, { deviceToken: HOST, code }))).toBe('ROLES_NOT_FILLED');
    await t.mutation(api.signal.joinRoom, { deviceToken: C, code, name: 'Ana' });
    for (const deviceToken of ALL) await online(t, code, deviceToken);
    expect(await errorCode(t.mutation(api.signal.joinRoom, { deviceToken: 'd', code, name: 'Dee' }))).toBe('ROOM_FULL');
    expect(await errorCode(t.mutation(api.signal.joinRoom, { deviceToken: 'd', code: 'ZZZZ', name: 'Dee' }))).toBe(
      'ROOM_NOT_FOUND',
    );
    await t.mutation(api.signal.claimRole, { deviceToken: B, code, role: 'witness' });
    await t.mutation(api.signal.claimRole, { deviceToken: C, code, role: 'detective' });
    expect(await errorCode(t.mutation(api.signal.startCase, { deviceToken: B, code }))).toBe('NOT_HOST');
    await t.mutation(api.signal.startCase, { deviceToken: HOST, code });
    expect((await t.query(api.signal.room, { deviceToken: B, code }))?.status).toBe('intro');
  });

  test('the room moves from intro to playing once all 3 are ready', async () => {
    const { t, code } = await lobby();
    await t.mutation(api.signal.startCase, { deviceToken: HOST, code });
    await t.mutation(api.signal.setPresence, { deviceToken: HOST, code, presence: 'ready' });
    await t.mutation(api.signal.setPresence, { deviceToken: B, code, presence: 'ready' });
    expect((await t.query(api.signal.room, { deviceToken: B, code }))?.status).toBe('intro');
    await t.mutation(api.signal.setPresence, { deviceToken: C, code, presence: 'ready' });
    expect((await t.query(api.signal.room, { deviceToken: B, code }))?.status).toBe('playing');
  });
});

describe('dossier gating', () => {
  test('each client receives only its own dossier and never the answer', async () => {
    const { t, code } = await playing();
    for (const deviceToken of ALL) {
      const mine = ROLE_OF[deviceToken];
      const dossier = await t.query(api.signal.myDossier, { deviceToken, code });
      const room = await t.query(api.signal.room, { deviceToken, code });
      const reveal = await t.query(api.signal.reveal, { deviceToken, code });
      const received = JSON.stringify({ dossier, room, reveal });
      expect(dossier?.role).toBe(mine);
      expect(reveal).toBeNull();
      for (const [role, text] of Object.entries(UNIQUE_DOSSIER_TEXT)) {
        expect(received.includes(text)).toBe(role === mine);
      }
      for (const leak of ANSWER_LEAKS) expect(received).not.toContain(leak);
      for (const token of ALL) expect(received).not.toContain(token);
    }
  });

  test('no dossier in the lobby or for an outsider', async () => {
    const { t, code } = await lobby();
    expect(await t.query(api.signal.myDossier, { deviceToken: HOST, code })).toBeNull();
    await t.mutation(api.signal.startCase, { deviceToken: HOST, code });
    expect(await t.query(api.signal.myDossier, { deviceToken: 'outsider', code })).toBeNull();
    const outsiderView = await t.query(api.signal.room, { deviceToken: 'outsider', code });
    expect(outsiderView?.me).toBeNull();
    expect(JSON.stringify(outsiderView)).not.toMatch(/tamper strip|game of Go|DOCK RING/);
  });
});

describe('theory and lock-in', () => {
  test('an edit bumps the revision and clears every lock-in', async () => {
    const { t, code } = await playing();
    const { revision } = await pickAndLock(t, code, 'theo', [HOST, B]);
    expect((await t.query(api.signal.room, { deviceToken: C, code }))?.lockIns).toHaveLength(2);
    const next = await t.mutation(api.signal.setTheory, { deviceToken: C, code, culprit: 'ines' });
    expect(next.revision).toBe(revision + 1);
    const room = await t.query(api.signal.room, { deviceToken: HOST, code });
    expect(room?.lockIns).toEqual([]);
    expect(room?.theory).toMatchObject({ culprit: 'ines', revision: revision + 1, lastEditedBy: { name: 'Ana' } });
  });

  test('2 of 3 locked does not resolve', async () => {
    const { t, code } = await playing();
    const { results } = await pickAndLock(t, code, 'jun', [HOST, B]);
    expect(results.at(-1)).toEqual({ outcome: 'locked', lockedCount: 2 });
    expect((await t.query(api.signal.room, { deviceToken: HOST, code }))?.status).toBe('playing');
    expect(await t.query(api.signal.reveal, { deviceToken: HOST, code })).toBeNull();
  });

  test('a lock-in for a stale revision is rejected', async () => {
    const { t, code } = await playing();
    const { revision } = await t.mutation(api.signal.setTheory, { deviceToken: B, code, culprit: 'jun' });
    await t.mutation(api.signal.setTheory, { deviceToken: C, code, culprit: 'theo' });
    expect(await errorCode(t.mutation(api.signal.lockIn, { deviceToken: HOST, code, revision }))).toBe(
      'STALE_REVISION',
    );
    expect((await t.query(api.signal.room, { deviceToken: HOST, code }))?.lockIns).toEqual([]);
  });

  test('a wrong pick nudges the right role, clears lock-ins, counts the attempt, and leaks nothing', async () => {
    const { t, code } = await playing();
    const { results } = await pickAndLock(t, code, 'theo');
    const result = results.at(-1);
    expect(result).toMatchObject({
      outcome: 'wrong',
      attempts: 1,
      nudge: { wrongPick: 'theo', forRole: 'hacker', revision: 1 },
    });
    for (const deviceToken of ALL) {
      const room = await t.query(api.signal.room, { deviceToken, code });
      const reveal = await t.query(api.signal.reveal, { deviceToken, code });
      expect(room).toMatchObject({ status: 'playing', attempts: 1, lockIns: [] });
      expect(reveal).toBeNull();
      const received = JSON.stringify({ result, room, reveal });
      for (const leak of ANSWER_LEAKS) expect(received).not.toContain(leak);
    }
    await t.mutation(api.signal.setTheory, { deviceToken: HOST, code, culprit: 'priya' });
    expect((await t.query(api.signal.room, { deviceToken: HOST, code }))?.lastNudge).toBeNull();
  });

  test('a correct pick resolves and the reveal credits all 3 clues', async () => {
    const { t, code } = await playing();
    const { results } = await pickAndLock(t, code, 'jun');
    expect(results.at(-1)).toEqual({ outcome: 'resolved' });
    const reveal = await t.query(api.signal.reveal, { deviceToken: C, code });
    expect(reveal?.culprit).toBe('jun');
    expect(reveal?.credits.map((c) => [c.role, c.cleared, c.memberName])).toEqual([
      ['hacker', 'theo', 'Maya'],
      ['witness', 'priya', 'Ravi'],
      ['detective', 'ines', 'Ana'],
    ]);
    expect(await errorCode(t.mutation(api.signal.lockIn, { deviceToken: C, code, revision: 1 }))).toBe('WRONG_STATUS');
  });
});

describe('rejoin and restart', () => {
  test('rejoining with the stored token returns the same member, role and state', async () => {
    const { t, code } = await playing();
    const { revision } = await t.mutation(api.signal.setTheory, { deviceToken: B, code, culprit: 'theo' });
    await t.mutation(api.signal.lockIn, { deviceToken: B, code, revision });
    const before = await t.query(api.signal.room, { deviceToken: B, code });
    expect(await t.mutation(api.signal.joinRoom, { deviceToken: B, code, name: 'Ravi again' })).toEqual({
      code,
      status: 'rejoined',
      reclaimableRoles: [],
    });
    const after = await t.query(api.signal.room, { deviceToken: B, code });
    expect(after?.me).toEqual(before?.me);
    expect(after?.theory).toEqual(before?.theory);
    expect(after?.lockIns).toEqual([{ memberId: before?.me?.memberId, revision }]);
    expect(await t.query(api.signal.activeRoom, { deviceToken: B })).toEqual({ code, status: 'playing', role: 'witness' });
    expect((await t.query(api.signal.myDossier, { deviceToken: B, code }))?.role).toBe('witness');
    expect(await errorCode(t.mutation(api.signal.joinRoom, { deviceToken: 'new', code, name: 'Dee' }))).toBe(
      'CASE_STARTED',
    );
  });

  test('a non-host cannot restart and the host must confirm', async () => {
    const { t, code } = await playing();
    await pickAndLock(t, code, 'theo');
    expect(await errorCode(t.mutation(api.signal.restart, { deviceToken: B, code, confirm: true }))).toBe('NOT_HOST');
    expect(await errorCode(t.mutation(api.signal.restart, { deviceToken: HOST, code, confirm: false }))).toBe(
      'CONFIRM_REQUIRED',
    );
    expect((await t.query(api.signal.room, { deviceToken: HOST, code }))?.status).toBe('playing');
    await t.mutation(api.signal.restart, { deviceToken: HOST, code, confirm: true });
    const room = await t.query(api.signal.room, { deviceToken: HOST, code });
    expect(room).toMatchObject({ status: 'lobby', attempts: 0, lastNudge: null, lockIns: [] });
    expect(room?.theory.culprit).toBeNull();
    expect(room?.members.map((m) => m.role)).toEqual(['hacker', 'witness', 'detective']);
  });
});

describe('battle-test fixes', () => {
  test('a checked revision cannot be locked again, so replays never add an attempt', async () => {
    const { t, code } = await playing();
    const { revision } = await t.mutation(api.signal.setTheory, { deviceToken: B, code, culprit: 'theo' });
    await t.mutation(api.signal.lockIn, { deviceToken: HOST, code, revision });
    expect(await t.mutation(api.signal.lockIn, { deviceToken: HOST, code, revision })).toEqual({
      outcome: 'locked',
      lockedCount: 1,
    });
    await t.mutation(api.signal.lockIn, { deviceToken: B, code, revision });
    expect((await t.mutation(api.signal.lockIn, { deviceToken: C, code, revision })).outcome).toBe('wrong');
    for (const deviceToken of ALL) {
      expect(await errorCode(t.mutation(api.signal.lockIn, { deviceToken, code, revision }))).toBe('ALREADY_CHECKED');
    }
    const room = await t.query(api.signal.room, { deviceToken: HOST, code });
    expect(room).toMatchObject({ attempts: 1, checkedRevision: revision, checkSeq: 1, lockIns: [] });
    expect(room?.lastCheck).toMatchObject({ seq: 1, result: 'wrong' });
  });

  test('every check bumps checkSeq once and a correct one records it', async () => {
    const { t, code } = await playing();
    await pickAndLock(t, code, 'theo');
    await pickAndLock(t, code, 'priya');
    await pickAndLock(t, code, 'jun');
    const room = await t.query(api.signal.room, { deviceToken: C, code });
    expect(room).toMatchObject({ status: 'resolved', attempts: 2, checkSeq: 3 });
    expect(room?.lastCheck).toMatchObject({ seq: 3, result: 'correct' });
  });

  test('re-picking the chosen suspect is a no-op that keeps lock-ins', async () => {
    const { t, code } = await playing();
    const { revision } = await t.mutation(api.signal.setTheory, { deviceToken: B, code, culprit: 'ines' });
    await t.mutation(api.signal.lockIn, { deviceToken: HOST, code, revision });
    expect(await t.mutation(api.signal.setTheory, { deviceToken: C, code, culprit: 'ines' })).toEqual({ revision });
    const room = await t.query(api.signal.room, { deviceToken: HOST, code });
    expect(room?.theory.revision).toBe(revision);
    expect(room?.lockIns).toHaveLength(1);
    expect(room?.members.find((m) => m.isMe)?.presence).toBe('ready');
  });

  test('revisions keep rising through a restart, so an old lock-in replay is stale', async () => {
    const { t, code } = await playing();
    const { revision: old } = await t.mutation(api.signal.setTheory, { deviceToken: B, code, culprit: 'theo' });
    await t.mutation(api.signal.restart, { deviceToken: HOST, code, confirm: true });
    const afterRestart = (await t.query(api.signal.room, { deviceToken: HOST, code }))!.theory.revision;
    expect(afterRestart).toBeGreaterThan(old);
    await t.mutation(api.signal.startCase, { deviceToken: HOST, code });
    for (const deviceToken of ALL) await t.mutation(api.signal.setPresence, { deviceToken, code, presence: 'ready' });
    const { revision } = await t.mutation(api.signal.setTheory, { deviceToken: B, code, culprit: 'theo' });
    expect(revision).toBeGreaterThan(afterRestart);
    expect(await errorCode(t.mutation(api.signal.lockIn, { deviceToken: HOST, code, revision: old }))).toBe(
      'STALE_REVISION',
    );
  });

  test('a new device reclaims an offline seat, never an online one', async () => {
    const { t, code, sessions } = await playing();
    const { revision } = await t.mutation(api.signal.setTheory, { deviceToken: B, code, culprit: 'theo' });
    await t.mutation(api.signal.lockIn, { deviceToken: C, code, revision });
    const before = await t.query(api.signal.room, { deviceToken: C, code });

    expect(await errorCode(t.mutation(api.signal.joinRoom, { deviceToken: 'phone', code, name: 'Ana' }))).toBe(
      'CASE_STARTED',
    );
    expect(await errorCode(t.mutation(api.signal.reclaimRole, { deviceToken: 'phone', code, role: 'detective' }))).toBe(
      'ROLE_TAKEN',
    );

    await t.mutation(api.presence.disconnect, { sessionToken: sessions[C] });
    expect((await t.query(api.signal.room, { deviceToken: HOST, code }))?.members[2].presence).toBe('offline');
    expect(await t.mutation(api.signal.joinRoom, { deviceToken: 'phone', code, name: 'Ana' })).toEqual({
      code,
      status: 'reclaim',
      reclaimableRoles: ['detective'],
    });
    expect((await t.query(api.signal.room, { deviceToken: 'phone', code }))?.reclaimableRoles).toEqual(['detective']);
    expect(await errorCode(t.mutation(api.signal.reclaimRole, { deviceToken: 'phone', code, role: 'hacker' }))).toBe(
      'ROLE_TAKEN',
    );
    await t.mutation(api.signal.reclaimRole, { deviceToken: 'phone', code, role: 'detective' });

    const after = await t.query(api.signal.room, { deviceToken: 'phone', code });
    expect(after?.me).toEqual(before?.me);
    expect(after?.lockIns).toEqual(before?.lockIns);
    expect((await t.query(api.signal.myDossier, { deviceToken: 'phone', code }))?.role).toBe('detective');
    expect(await t.query(api.signal.myDossier, { deviceToken: C, code })).toBeNull();
  });

  test('reclaiming the host seat hands the host role to the new device', async () => {
    const { t, code, sessions } = await playing();
    await t.mutation(api.presence.disconnect, { sessionToken: sessions[HOST] });
    await t.mutation(api.signal.reclaimRole, { deviceToken: 'new-host', code, role: 'hacker' });
    expect((await t.query(api.signal.room, { deviceToken: 'new-host', code }))?.isHost).toBe(true);
    expect(await errorCode(t.mutation(api.signal.restart, { deviceToken: HOST, code, confirm: true }))).toBe(
      'NOT_A_MEMBER',
    );
  });
});
