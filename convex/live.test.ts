/// <reference types="vite/client" />
import presenceTest from '@convex-dev/presence/test';
import { convexTest } from 'convex-test';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { api } from './_generated/api';
import { counterTemplate } from './liveTemplates';
import schema from './schema';
import type { ChallengeConfigPatch } from '../src/lib/contract';

const modules = import.meta.glob('./**/*.ts');
const HOST = 'host-device-token-9f2';

function newTest() {
  const t = convexTest(schema, modules);
  presenceTest.register(t);
  return t;
}
type T = ReturnType<typeof newTest>;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-15T22:00:00Z'));
});
afterEach(() => vi.useRealTimers());

async function errorCode(p: Promise<unknown>) {
  try {
    await p;
  } catch (e) {
    return (e as { data?: { code?: string } }).data?.code;
  }
  throw new Error('expected the call to fail');
}

const tokens = (n: number, prefix = 'viewer-token-') => Array.from({ length: n }, (_, i) => prefix + (i + 1));

async function published(patch: ChallengeConfigPatch = {}) {
  const t = newTest();
  await t.mutation(api.challenges.saveCreatorProfile, { deviceToken: HOST, displayName: 'Nova', handle: '@Nova' });
  const { challengeId } = await t.mutation(api.challenges.createChallenge, { deviceToken: HOST, patch: { title: 'Friday stream', poolCents: 10_000, ...patch } });
  const { joinCode } = await t.mutation(api.challenges.publishChallenge, { deviceToken: HOST, challengeId });
  return { t, challengeId, joinCode };
}

const join = (t: T, code: string, deviceToken: string) => t.action(api.challenges.joinChallenge, { deviceToken, code, name: 'Viewer ' + deviceToken.split('-').pop() });

// The counter reference stands in for a Template SDK v2 type until one ships in convex/templates.
const useCounter = (t: T, challengeId: string) =>
  t.run(async (ctx) => {
    await ctx.db.insert('liveSessions', { challengeId: ctx.db.normalizeId('challenges', challengeId)!, templateId: 'counter', state: counterTemplate.init(null, challengeId) });
  });

describe('host console', () => {
  test('only the host can lock, start or run host actions', async () => {
    const { t, challengeId, joinCode } = await published();
    await useCounter(t, challengeId);
    for (const deviceToken of ['stranger', 'viewer-token-1']) {
      if (deviceToken !== 'stranger') await join(t, joinCode, deviceToken);
      expect(await errorCode(t.mutation(api.live.lockEntries, { deviceToken, challengeId }))).toBe('NOT_CREATOR');
      expect(await errorCode(t.mutation(api.live.startLive, { deviceToken, challengeId }))).toBe('NOT_CREATOR');
      expect(await errorCode(t.mutation(api.live.runHostAction, { deviceToken, challengeId, action: 'tick', payload: { delta: 1 } }))).toBe('NOT_CREATOR');
    }
    expect((await t.query(api.live.liveView, { code: joinCode }))!.phase).toBe('open');
  });

  test('lock closes entries on the server clock; entrants before it keep their seat', async () => {
    const { t, challengeId, joinCode } = await published();
    await join(t, joinCode, 'viewer-token-1');
    vi.advanceTimersByTime(5_000);
    const lockAt = Date.now();
    await t.mutation(api.live.lockEntries, { deviceToken: HOST, challengeId });
    expect(await errorCode(join(t, joinCode, 'viewer-token-2'))).toBe('ENTRIES_LOCKED');
    await join(t, joinCode, 'viewer-token-1');
    const view = (await t.query(api.live.liveView, { code: joinCode }))!;
    expect(view).toMatchObject({ phase: 'locked', entriesLocked: true, lockedAt: lockAt, entryCount: 1, status: 'published' });
  });

  test('start deals dealt teams and locks entries', async () => {
    const { t, challengeId, joinCode } = await published({ teamSize: 2 });
    for (const p of tokens(4)) await join(t, joinCode, p);
    await t.mutation(api.live.startLive, { deviceToken: HOST, challengeId });
    const view = (await t.query(api.live.liveView, { code: joinCode }))!;
    expect(view).toMatchObject({ phase: 'live', status: 'live', entriesLocked: true, entryCount: 4 });
    expect((await t.query(api.challenges.myChallenge, { deviceToken: 'viewer-token-1', challengeId }))!.me.team).not.toBeNull();
    expect(await errorCode(t.mutation(api.live.startLive, { deviceToken: HOST, challengeId }))).toBe('CHALLENGE_CLOSED');
  });

  test('start below one team refuses and leaves entries open', async () => {
    const { t, challengeId, joinCode } = await published({ teamSize: 3, leftover: 'wait_next_round' });
    await join(t, joinCode, 'viewer-token-1');
    expect(await errorCode(t.mutation(api.live.startLive, { deviceToken: HOST, challengeId }))).toBe('NOT_ENOUGH_PLAYERS');
    expect((await t.query(api.live.liveView, { code: joinCode }))!.phase).toBe('open');
    await join(t, joinCode, 'viewer-token-2');
  });

  test('a started mixer challenge stops taking entries, which it otherwise would while live', async () => {
    const { t, challengeId, joinCode } = await published({ teamFormation: 'mixer', templateId: 'split-passphrase', mixerColors: ['red', 'blue'] });
    for (const p of tokens(2)) await join(t, joinCode, p);
    await t.mutation(api.live.startLive, { deviceToken: HOST, challengeId });
    expect((await t.query(api.live.liveView, { code: joinCode }))!.phase).toBe('live');
    expect(await errorCode(join(t, joinCode, 'viewer-token-3'))).toBe('ENTRIES_LOCKED');
  });
});

describe('runHostAction', () => {
  test('dispatches to the template: tick, rate limit, undo, refusals', async () => {
    const { t, challengeId, joinCode } = await published({ teamSize: 1 });
    await useCounter(t, challengeId);
    const run = (action: string, payload?: unknown) => t.mutation(api.live.runHostAction, { deviceToken: HOST, challengeId, action, payload });
    expect(await errorCode(run('tick', { delta: 1 }))).toBe('NOT_LIVE');
    await join(t, joinCode, 'viewer-token-1');
    await t.mutation(api.live.startLive, { deviceToken: HOST, challengeId });
    expect(await run('tick', { delta: 1 })).toEqual({ view: { value: 1, ticks: 1, lastTickAt: expect.any(Number) } });
    vi.advanceTimersByTime(100);
    expect(await errorCode(run('tick', { delta: 1 }))).toBe('HOST_ACTION_RATE_LIMITED');
    vi.advanceTimersByTime(200);
    await run('tick', { delta: 1 });
    expect((await t.query(api.live.liveView, { code: joinCode }))!.view).toMatchObject({ value: 2, ticks: 2 });
    vi.advanceTimersByTime(300);
    expect((await run('undo')).view).toMatchObject({ value: 1, ticks: 1 });
    vi.advanceTimersByTime(300);
    await run('undo');
    vi.advanceTimersByTime(300);
    expect(await errorCode(run('undo'))).toBe('NOTHING_TO_UNDO');
    expect(await errorCode(run('tick', { delta: -1 }))).toBe('AT_ZERO');
    expect(await errorCode(run('tick', { delta: 5 }))).toBe('BAD_PAYLOAD');
    expect(await errorCode(run('reveal'))).toBe('UNKNOWN_HOST_ACTION');
    expect(await errorCode(run('toString'))).toBe('UNKNOWN_HOST_ACTION');
    expect((await t.query(api.live.liveView, { code: joinCode }))!.hostActions).toEqual(['tick', 'undo']);
    await t.mutation(api.challenges.endChallenge, { deviceToken: HOST, challengeId });
    expect(await errorCode(run('tick', { delta: 1 }))).toBe('CHALLENGE_CLOSED');
  });

  test('a template without host actions refuses them', async () => {
    const { t, challengeId, joinCode } = await published();
    expect(await errorCode(t.mutation(api.live.runHostAction, { deviceToken: HOST, challengeId, action: 'tick' }))).toBe('UNKNOWN_HOST_ACTION');
    expect((await t.query(api.live.liveView, { code: joinCode }))!).toMatchObject({ hostActions: [], view: null });
  });
});

describe('public live view', () => {
  test('phase, entry count and the leaderboard after resolve, and nothing private', async () => {
    const { t, challengeId, joinCode } = await published({ teamSize: 2, reward: { kind: 'placement', percents: [100] } });
    const players = tokens(4);
    for (const p of players) await join(t, joinCode, p);
    expect(await t.query(api.live.liveView, { code: 'ZZZZ' })).toBeNull();
    await t.mutation(api.live.startLive, { deviceToken: HOST, challengeId });
    const rooms = new Map<string, string[]>();
    for (const deviceToken of players) {
      const code = (await t.query(api.challenges.myChallenge, { deviceToken, challengeId }))!.me.team!.roomCode;
      rooms.set(code, [...(rooms.get(code) ?? []), deviceToken]);
    }
    const [[roomCode, members]] = [...rooms.entries()];
    for (const deviceToken of members) await t.mutation(api.signal.setPresence, { deviceToken, code: roomCode, presence: 'ready' });
    const { revision } = await t.mutation(api.signal.setTheory, { deviceToken: members[0], code: roomCode, culprit: 'jun' });
    for (const deviceToken of members) await t.mutation(api.signal.lockIn, { deviceToken, code: roomCode, revision });

    const view = (await t.query(api.live.liveView, { code: joinCode }))!;
    expect(view).toMatchObject({ status: 'ended', phase: 'ended', entryCount: 4 });
    expect(view.leaderboard).toEqual([{ place: 1, label: expect.any(String), memberNames: members.map((p) => 'Viewer ' + p.split('-').pop()), inMoney: true }]);
    const json = JSON.stringify(view);
    for (const secret of [HOST, ...players, ...rooms.keys()]) expect(json).not.toContain(secret);
    expect(json).not.toMatch(/deviceToken|whopUserId|creatorToken|idempotency|roomCode/);
  });

  test('a mixer challenge shows no fragments or player codes', async () => {
    const { t, challengeId, joinCode } = await published({ teamFormation: 'mixer', templateId: 'split-passphrase', mixerColors: ['red', 'blue'] });
    const players = tokens(2);
    for (const p of players) await join(t, joinCode, p);
    const json = JSON.stringify(await t.query(api.live.liveView, { code: joinCode }));
    for (const deviceToken of players) {
      const mixer = (await t.query(api.challenges.myChallenge, { deviceToken, challengeId }))!.me.mixer!;
      const secrets = [deviceToken, ...Object.values(mixer).filter((x): x is string => typeof x === 'string' && x.length >= 4)];
      if (mixer.fragment) secrets.push(mixer.fragment.text);
      for (const s of secrets) expect(json).not.toContain(s);
    }
  });
});
