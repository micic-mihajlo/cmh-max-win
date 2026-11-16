/// <reference types="vite/client" />
import presenceTest from '@convex-dev/presence/test';
import rateLimiterTest from '@convex-dev/rate-limiter/test';
import { convexTest } from 'convex-test';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { api } from './_generated/api';
import schema from './schema';
import type { ChallengeConfigPatch } from '../src/lib/contract';

const modules = import.meta.glob('./**/*.ts');
const HOST = 'host-device-token-7c1';
const NAMES = ['Danny Ortiz', 'Kayla Brooks', 'Marcus Lee', 'Jess Patel'];
const QUIZ = {
  questions: [
    { prompt: 'Capital of France?', choices: ['Paris', 'Rome', 'Oslo'], correct: 0, timeLimitMs: 10_000 },
    { prompt: 'What is 2 + 2?', choices: ['Three', 'Four'], correct: 1, timeLimitMs: 10_000 },
    { prompt: 'Largest planet?', choices: ['Mars', 'Jupiter', 'Venus', 'Earth'], correct: 1, timeLimitMs: 10_000 },
  ],
};

function newTest() {
  const t = convexTest(schema, modules);
  presenceTest.register(t);
  rateLimiterTest.register(t);
  return t;
}
type T = ReturnType<typeof newTest>;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-16T02:00:00Z'));
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

async function quiz(patch: ChallengeConfigPatch = {}) {
  const t = newTest();
  await t.mutation(api.challenges.saveCreatorProfile, { deviceToken: HOST, displayName: 'Chris', handle: '@chris' });
  const { challengeId } = await t.mutation(api.challenges.createChallenge, {
    deviceToken: HOST,
    patch: { title: 'Quiz night', poolCents: 10_000, templateId: 'quick-quiz', teamSize: 2, templateConfig: QUIZ, ...patch },
  });
  const { joinCode } = await t.mutation(api.challenges.publishChallenge, { deviceToken: HOST, challengeId });
  return { t, challengeId, joinCode };
}

const join = (t: T, code: string, deviceToken: string, name: string) => t.action(api.challenges.joinChallenge, { deviceToken, code, name });
const pulse = async (t: T, code: string, deviceToken: string) => (await t.query(api.live.roomPulse, { code, deviceToken }))!;

describe('live:roomPulse', () => {
  test('lobby: shape, head count, host and entrants only', async () => {
    const { t, challengeId, joinCode } = await quiz();
    const players = NAMES.map((_, i) => 'pulse-player-' + i);
    for (const [i, p] of players.slice(0, 3).entries()) await join(t, joinCode, p, NAMES[i]);

    expect(await pulse(t, joinCode, players[0])).toEqual({
      serverNow: expect.any(Number),
      phase: 'lobby',
      joined: 3,
      questionIndex: null,
      questionCount: 3,
      deadline: null,
      spotsLeft: 3,
      myTeamId: null,
      teams: [],
    });
    expect((await pulse(t, joinCode, HOST)).joined).toBe(3);
    expect(await errorCode(t.query(api.live.roomPulse, { code: joinCode, deviceToken: 'stranger' }))).toBe('NOT_ENTERED');
    expect(await t.query(api.live.roomPulse, { code: 'ZZZZ', deviceToken: players[0] })).toBeNull();

    await t.mutation(api.challenges.leaveChallenge, { deviceToken: players[2], challengeId });
    expect((await pulse(t, joinCode, players[0])).joined).toBe(2);
    expect((await quiz({ poolCents: 0 }).then(async (q) => {
      await join(q.t, q.joinCode, 'solo', 'Mike');
      return pulse(q.t, q.joinCode, 'solo');
    })).spotsLeft).toBeNull();
  });

  test('a quiz round: teams and first names, locks, no answers or correctness before the reveal', async () => {
    const { t, challengeId, joinCode } = await quiz();
    const players = NAMES.map((_, i) => 'pulse-player-' + i);
    for (const [i, p] of players.entries()) await join(t, joinCode, p, NAMES[i]);
    await t.mutation(api.live.startLive, { deviceToken: HOST, challengeId });

    const lobby = await pulse(t, joinCode, players[0]);
    expect(lobby).toMatchObject({ phase: 'lobby', joined: 4, questionIndex: null, questionCount: 3 });
    expect(lobby.teams.map((t) => [t.label, t.memberFirstNames, t.lockedAt, t.correct])).toEqual([
      ['Team 1', ['Danny', 'Kayla'], null, null],
      ['Team 2', ['Marcus', 'Jess'], null, null],
    ]);
    const [team1, team2] = lobby.teams.map((t) => t.id);
    expect(lobby.myTeamId).toBe(team1);
    expect((await pulse(t, joinCode, players[3])).myTeamId).toBe(team2);
    expect((await pulse(t, joinCode, HOST)).myTeamId).toBeNull();

    const next = () => {
      vi.advanceTimersByTime(1_000);
      return t.mutation(api.live.runHostAction, { deviceToken: HOST, challengeId, action: 'next' });
    };
    const answer = async (deviceToken: string, index: number, text: string) => {
      const shared = (await t.query(api.live.teamSessionView, { deviceToken, challengeId }))!.shared as { questions: { choices: string[] }[] };
      return t.mutation(api.live.playerAction, { deviceToken, challengeId, action: { type: 'answer', questionIndex: index, choice: shared.questions[index].choices.indexOf(text) } });
    };

    await next();
    const closesAt = ((await t.query(api.live.teamSessionView, { deviceToken: players[0], challengeId }))!.shared as { questions: { closesAt: number }[] }).questions[0].closesAt;
    vi.advanceTimersByTime(1_500);
    await answer(players[1], 0, 'Paris');
    await answer(players[2], 0, 'Rome');

    // A teammate's lock never locks you: each team has one of two members in, so neither team is locked.
    const half = await pulse(t, joinCode, players[0]);
    expect(half.teams.map((t) => [t.lockedAt, t.lockedCount, t.memberCount, t.correct])).toEqual([
      [null, 1, 2, null],
      [null, 1, 2, null],
    ]);
    expect(await errorCode(answer(players[1], 0, 'Rome'))).toBe('ALREADY_ANSWERED');
    const view = async (deviceToken: string) => (await t.query(api.live.teamSessionView, { deviceToken, challengeId }))!;
    const [dannyView, kaylaView] = await Promise.all([view(players[0]), view(players[1])]);
    expect((dannyView.shared as { questions: { lockedBy: string[] }[] }).questions[0].lockedBy).toHaveLength(1);
    expect(dannyView.mine).toMatchObject({ answeredByMe: [], myChoices: [null, null, null] });
    expect(kaylaView.mine).toMatchObject({ answeredByMe: [0] });
    vi.advanceTimersByTime(500);
    const before = Date.now();
    await answer(players[0], 0, 'Paris');

    const open = await pulse(t, joinCode, players[3]);
    expect(open).toMatchObject({ phase: 'question', questionIndex: 0, deadline: closesAt });
    expect(open.teams.map((t) => [t.lockedCount, t.correct])).toEqual([
      [2, null],
      [1, null],
    ]);
    expect(open.teams[0].lockedAt! - before).toBeGreaterThanOrEqual(0);
    expect(open.teams[0].lockedAt! - before).toBeLessThan(50);
    expect(open.teams[1].lockedAt).toBeNull();
    const json = JSON.stringify(open);
    for (const secret of [...QUIZ.questions[0].choices, 'choice', 'points', ...players]) expect(json).not.toContain(secret);

    await next();
    const revealed = await pulse(t, joinCode, players[0]);
    expect(revealed).toMatchObject({ phase: 'reveal', questionIndex: 0 });
    expect(revealed.deadline!).toBeLessThan(closesAt);
    expect(revealed.teams.map((t) => [t.lockedAt !== null, t.correct])).toEqual([
      [true, true],
      [false, false],
    ]);

    // Q2 times out with no locks; the scheduled tick reveals it.
    await next();
    vi.advanceTimersByTime(10_000);
    await t.finishInProgressScheduledFunctions();
    const timedOut = await pulse(t, joinCode, players[0]);
    expect(timedOut).toMatchObject({ phase: 'reveal', questionIndex: 1 });
    expect(timedOut.teams.map((t) => [t.lockedAt, t.correct])).toEqual([
      [null, false],
      [null, false],
    ]);

    await next();
    await answer(players[0], 2, 'Jupiter');
    await next();
    const done = await pulse(t, joinCode, players[0]);
    expect(done).toMatchObject({ phase: 'finished', questionIndex: 2, spotsLeft: 2 });
    expect(done.teams.map((t) => t.correct)).toEqual([true, false]);
  });

  test('the shared half: one key for the whole room, members only, same pulse as roomPulse', async () => {
    const { t, challengeId, joinCode } = await quiz();
    const players = NAMES.map((_, i) => 'pulse-player-' + i);
    for (const [i, p] of players.entries()) await join(t, joinCode, p, NAMES[i]);
    await t.mutation(api.live.startLive, { deviceToken: HOST, challengeId });

    const keys = await Promise.all([...players, HOST].map((deviceToken) => t.query(api.live.roomPulseKey, { code: joinCode, deviceToken })));
    expect(new Set(keys.map((k) => k!.roomKey)).size).toBe(1);
    expect(keys.map((k) => k!.myTeamId)).toEqual(await Promise.all([...players, HOST].map(async (p) => (await pulse(t, joinCode, p)).myTeamId)));
    expect(await errorCode(t.query(api.live.roomPulseKey, { code: joinCode, deviceToken: 'stranger' }))).toBe('NOT_ENTERED');
    expect(await errorCode(t.query(api.live.roomPulseShared, { code: joinCode, roomKey: 'guess' }))).toBe('NOT_ENTERED');

    const { myTeamId: _mine, ...whole } = await pulse(t, joinCode, players[0]);
    expect(await t.query(api.live.roomPulseShared, { code: joinCode, roomKey: keys[0]!.roomKey })).toEqual({ ...whole, serverNow: expect.any(Number) });
    for (const secret of [HOST, ...players]) expect(keys[0]!.roomKey).not.toContain(secret);
  });

  test('150 players on 50 teams all lock at once: every lock lands and none writes the pulse doc', async () => {
    const { t, challengeId, joinCode } = await quiz({ teamSize: 3 });
    const names = ['Danny', 'Kayla', 'Marcus', 'Jess', 'Mike', 'Sarah', 'Chris', 'Ashley'];
    const players = Array.from({ length: 150 }, (_, i) => 'load-player-' + i);
    for (const [i, p] of players.entries()) await join(t, joinCode, p, names[i % names.length] + ' ' + i);
    expect((await pulse(t, joinCode, players[0])).joined).toBe(150);
    await t.mutation(api.live.startLive, { deviceToken: HOST, challengeId });
    await t.mutation(api.live.runHostAction, { deviceToken: HOST, challengeId, action: 'next' });

    expect((await pulse(t, joinCode, players[0])).teams).toHaveLength(50);

    const docBefore = await t.run((ctx) => ctx.db.query('roomPulses').first());
    const sessionsBefore = await t.run((ctx) => ctx.db.query('teamSessions').collect());
    const results = await Promise.allSettled(
      players.map((deviceToken) => t.mutation(api.live.playerAction, { deviceToken, challengeId, action: { type: 'answer', questionIndex: 0, choice: 0 } })),
    );
    expect(results.filter((r) => r.status === 'rejected')).toEqual([]);

    const after = await pulse(t, joinCode, players[0]);
    expect(after.teams.every((t) => t.lockedAt !== null && t.lockedCount === 3 && t.memberCount === 3 && t.correct === null)).toBe(true);
    expect(await t.run((ctx) => ctx.db.query('roomPulses').first())).toEqual(docBefore);
    // No lock wrote a team session either, so teammates locking together never touch the same doc.
    expect(await t.run((ctx) => ctx.db.query('teamSessions').collect())).toEqual(sessionsBefore);

    // The reveal folds every member's answer into the team score.
    vi.advanceTimersByTime(1_000);
    await t.mutation(api.live.runHostAction, { deviceToken: HOST, challengeId, action: 'next' });
    const views = await Promise.all(players.map((deviceToken) => t.query(api.live.teamSessionView, { deviceToken, challengeId })));
    const byTeam = new Map<string, { points: number; mine: number[] }>();
    for (const v of views) {
      const team = byTeam.get(v!.teamLabel) ?? { points: (v!.shared as { points: number }).points, mine: [] };
      team.mine.push((v!.mine as { myPoints: number[] }).myPoints[0]);
      byTeam.set(v!.teamLabel, team);
    }
    expect(byTeam.size).toBe(50);
    for (const team of byTeam.values()) expect(team.points).toBe(team.mine.reduce((a, b) => a + b, 0));
    expect([...byTeam.values()].some((team) => team.points > 0)).toBe(true);
  });

  test('a crowd of 150 joining one code at once all get in: no failures, no RATE_LIMITED', async () => {
    const { t, joinCode } = await quiz({ teamSize: 3 });
    const names = ['Danny', 'Kayla', 'Marcus', 'Jess', 'Mike', 'Sarah'];
    const results = await Promise.allSettled(Array.from({ length: 150 }, (_, i) => join(t, joinCode, 'burst-player-' + i, names[i % names.length])));
    expect(results.filter((r) => r.status === 'rejected')).toEqual([]);
    expect((await pulse(t, joinCode, 'burst-player-0')).joined).toBe(150);
  });
});
