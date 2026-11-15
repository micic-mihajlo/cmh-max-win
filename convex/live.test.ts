/// <reference types="vite/client" />
import presenceTest from '@convex-dev/presence/test';
import { convexTest } from 'convex-test';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { api } from './_generated/api';
import { DEFAULT_CONFIG, validateConfig } from './challenges';
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

const QUIZ = {
  questions: [
    { prompt: 'Capital of France?', choices: ['Paris', 'Rome', 'Oslo'], correct: 0, timeLimitMs: 10_000 },
    { prompt: 'What is 2 + 2?', choices: ['Three', 'Four'], correct: 1, timeLimitMs: 10_000 },
    { prompt: 'Largest planet?', choices: ['Mars', 'Jupiter', 'Venus', 'Earth'], correct: 1, timeLimitMs: 10_000 },
  ],
};

describe('quick-quiz on the live layer', () => {
  test('a dealt quiz publishes; bad questions and non-live start modes are refused', async () => {
    const fields = (patch: ChallengeConfigPatch) =>
      validateConfig({ ...DEFAULT_CONFIG, title: 'Quiz night', templateId: 'quick-quiz', teamSize: 2, templateConfig: QUIZ, ...patch }, false, Date.now()).map((i) => i.field);
    expect(fields({})).toEqual([]);
    expect(fields({ teamSize: 1 })).toEqual([]);
    expect(fields({ templateConfig: { questions: QUIZ.questions.slice(0, 2) } })).toEqual(['templateConfig']);
    expect(fields({ templateConfig: undefined })).toEqual(['templateConfig']);
    expect(fields({ startMode: 'window', endsAt: Date.now() + 60_000 })).toEqual(['startMode']);
    const { joinCode } = await published({ templateId: 'quick-quiz', teamSize: 2, templateConfig: QUIZ });
    expect(joinCode).toMatch(/^[A-Z0-9]{4}$/);
  });

  test('end to end: two teams answer, the host advances, a timeout closes a question, places feed the payout', async () => {
    const { t, challengeId, joinCode } = await published({ templateId: 'quick-quiz', teamSize: 2, templateConfig: QUIZ, reward: { kind: 'placement', percents: [60, 40] } });
    const players = tokens(4);
    for (const p of players) await join(t, joinCode, p);
    await t.mutation(api.live.startLive, { deviceToken: HOST, challengeId });

    const teamOf = async (deviceToken: string) => (await t.query(api.live.teamSessionView, { deviceToken, challengeId }))!.teamLabel;
    const labels = await Promise.all(players.map(teamOf));
    const [teamA, teamB] = [...new Set(labels)];
    const a = players.filter((_, i) => labels[i] === teamA);
    const b = players.filter((_, i) => labels[i] === teamB);
    expect([a.length, b.length]).toEqual([2, 2]);

    type Q = { choices: string[]; closed: boolean; correctChoice: number | null };
    const question = async (deviceToken: string, index: number) =>
      ((await t.query(api.live.teamSessionView, { deviceToken, challengeId }))!.shared as { questions: Q[] }).questions[index];
    const answer = async (deviceToken: string, index: number, text: string) => {
      const choice = (await question(deviceToken, index)).choices.indexOf(text);
      return t.mutation(api.live.playerAction, { deviceToken, challengeId, action: { type: 'answer', questionIndex: index, choice } });
    };
    const next = () => t.mutation(api.live.runHostAction, { deviceToken: HOST, challengeId, action: 'next' });
    const board = async () => (await t.query(api.live.liveView, { code: joinCode }))!;
    const step = (ms = 1_000) => vi.advanceTimersByTime(ms);

    // The Aurora room a quiz team is seated in never plays.
    const roomCode = (await t.query(api.challenges.myChallenge, { deviceToken: a[0], challengeId }))!.me.team!.roomCode;
    for (const deviceToken of a) await t.mutation(api.signal.setPresence, { deviceToken, code: roomCode, presence: 'ready' });
    const { revision } = await t.mutation(api.signal.setTheory, { deviceToken: a[0], code: roomCode, culprit: 'jun' });
    expect(await errorCode(t.mutation(api.signal.lockIn, { deviceToken: a[0], code: roomCode, revision }))).toBe('CHALLENGE_CLOSED');
    const early = t.mutation(api.live.playerAction, { deviceToken: a[0], challengeId, action: { type: 'answer', questionIndex: 0, choice: 0 } });
    expect(await errorCode(early)).toBe('NOT_OPEN');

    // Q1: A right, B wrong; the host closes it early. The board shows no choices, and points only once closed.
    await next();
    step();
    await answer(a[0], 0, 'Paris');
    step();
    await answer(b[1], 0, 'Rome');
    expect(await errorCode(answer(a[1], 0, 'Oslo'))).toBe('ALREADY_ANSWERED');
    let view = await board();
    expect(view).toMatchObject({ phase: 'live', hostActions: ['next'] });
    expect(JSON.stringify(view)).not.toMatch(/Paris|Rome|Oslo/);
    expect((view.view as { rows: { points: number }[] }).rows.every((r) => r.points === 0)).toBe(true);
    step();
    await next();
    view = await board();
    expect(view.view).toMatchObject({ round: { phase: 'leaderboard', index: 0, correctText: 'Paris' } });
    const pointsOf = (v: typeof view, label: string) => (v.view as { rows: { label: string; points: number }[] }).rows.find((r) => r.label === label)!.points;
    expect(pointsOf(view, teamA)).toBeGreaterThan(500);
    expect(pointsOf(view, teamB)).toBe(0);

    // Q2: both right; nobody presses Next, so the time limit closes it through the scheduled tick.
    step();
    await next();
    step();
    await answer(a[1], 1, 'Four');
    step(3_000);
    await answer(b[0], 1, 'Four');
    vi.advanceTimersByTime(10_000);
    await t.finishInProgressScheduledFunctions();
    expect((await question(a[0], 1)).closed).toBe(true);
    expect(await errorCode(answer(b[1], 1, 'Three'))).toBe('CLOSED');
    expect(pointsOf(await board(), teamB)).toBeGreaterThan(0);

    // Q3: A right, B wrong; closing the last question ends the challenge.
    step();
    await next();
    step();
    await answer(a[0], 2, 'Jupiter');
    await answer(b[0], 2, 'Mars');
    step();
    await next();
    view = await board();
    expect(view).toMatchObject({ status: 'ended', phase: 'ended' });
    expect(view.leaderboard!.map((r) => [r.place, r.label, r.inMoney])).toEqual([
      [1, teamA, true],
      [2, teamB, true],
    ]);
    const json = JSON.stringify(view);
    for (const secret of [HOST, ...players, roomCode]) expect(json).not.toContain(secret);

    // The placement feeds #58's payout: 60/40 of $100, split per player, summing to the pool.
    expect(await t.mutation(api.challenges.approvePayouts, { deviceToken: HOST, challengeId })).toEqual({ approved: 4, alreadyApproved: 0 });
    const cents = await Promise.all(players.map(async (deviceToken) => (await t.query(api.challenges.myPayout, { deviceToken, challengeId }))!.cents));
    expect(a.map((p) => cents[players.indexOf(p)])).toEqual([3000, 3000]);
    expect(b.map((p) => cents[players.indexOf(p)])).toEqual([2000, 2000]);
    expect(cents.reduce((x, y) => x + y, 0)).toBe(10_000);
  });

  test('a double tap on Next is a no-op once the round has moved on', async () => {
    const { t, challengeId, joinCode } = await published({ templateId: 'quick-quiz', teamSize: 1, templateConfig: QUIZ });
    await join(t, joinCode, 'viewer-token-1');
    await t.mutation(api.live.startLive, { deviceToken: HOST, challengeId });
    const round = async () => ((await t.query(api.live.liveView, { code: joinCode }))!.view as { round: { phase: string; index: number | null } }).round;
    const tap = async () => {
      const { phase, index } = await round();
      return () => t.mutation(api.live.runHostAction, { deviceToken: HOST, challengeId, action: 'next', payload: { expectedIndex: index, expectedPhase: phase } });
    };
    for (const expected of [
      { phase: 'question', index: 0 },
      { phase: 'leaderboard', index: 0 },
      { phase: 'question', index: 1 },
    ]) {
      const next = await tap();
      await next();
      vi.advanceTimersByTime(1_000);
      await next();
      expect(await round()).toMatchObject(expected);
      vi.advanceTimersByTime(1_000);
    }
  });
});

