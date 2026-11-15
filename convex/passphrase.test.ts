/// <reference types="vite/client" />
import presenceTest from '@convex-dev/presence/test';
import rateLimiterTest from '@convex-dev/rate-limiter/test';
import { convexTest } from 'convex-test';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { api } from './_generated/api';
import schema from './schema';
import { WRONG_GUESS_COOLDOWN_MS } from './signal';

const modules = import.meta.glob('./**/*.ts');
const HOST = 'host-device';
const NAMES = ['Lou Reed', 'Ana', 'Kit', 'Mara', 'Dev', 'Jo'];

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

async function errorCode(p: Promise<unknown>) {
  try {
    await p;
  } catch (e) {
    return (e as { data?: { code?: string } }).data?.code;
  }
  throw new Error('expected the call to fail');
}

// 6 players, dealt into 2 squads of 3.
async function dealt(t: T, template?: 'split-passphrase') {
  const { dropId } = await t.mutation(api.drops.hostDrop, { deviceToken: HOST, creatorName: 'Nova', ...(template ? { template } : {}) });
  const players = NAMES.map((name, i) => ({ name, token: 'p' + i }));
  for (const p of players) await t.mutation(api.drops.enterDrop, { deviceToken: p.token, dropId, name: p.name });
  await t.mutation(api.drops.dealSquads, { deviceToken: HOST, dropId });
  const squads = new Map<string, string[]>();
  for (const p of players) {
    const code = (await t.query(api.drops.drop, { deviceToken: p.token, dropId }))!.me.squad!.code;
    squads.set(code, [...(squads.get(code) ?? []), p.token]);
  }
  return { dropId, squads: [...squads.entries()].map(([code, tokens]) => ({ code, tokens })) };
}

const pieceOf = (t: T, deviceToken: string, code: string) => t.query(api.passphrase.piece, { deviceToken, code });

async function answerOf(t: T, squad: { code: string; tokens: string[] }) {
  const pieces = await Promise.all(squad.tokens.map((d) => pieceOf(t, d, squad.code)));
  return pieces
    .map((p) => p!)
    .sort((a, b) => a.position - b.position)
    .map((p) => p.word);
}

async function solve(t: T, squad: { code: string; tokens: string[] }) {
  const words = await answerOf(t, squad);
  const [first, ...rest] = squad.tokens;
  const proposed = await t.mutation(api.passphrase.submitPassphrase, { deviceToken: first, code: squad.code, answer: words.join(' ') });
  let last = proposed;
  for (const d of rest) last = await t.mutation(api.passphrase.confirmPassphrase, { deviceToken: d, code: squad.code, revision: proposed.revision });
  return { proposed, last };
}

describe('split passphrase in the live room', () => {
  test('Case 01 is unchanged without a template', async () => {
    const t = newTest();
    const { dropId, squads } = await dealt(t);
    expect((await t.query(api.drops.drop, { deviceToken: 'p0', dropId }))!.template).toBeUndefined();
    const rooms = await t.run((ctx) => ctx.db.query('rooms').collect());
    expect(rooms.map((r) => [r.status, r.caseId, r.passphrase])).toEqual([
      ['intro', 'aurora01', undefined],
      ['intro', 'aurora01', undefined],
    ]);
    const members = await t.run((ctx) => ctx.db.query('members').collect());
    expect(members.every((m) => m.role !== null && m.roles?.length)).toBe(true);
    expect(await pieceOf(t, squads[0].tokens[0], squads[0].code)).toBeNull();
    expect(await errorCode(t.mutation(api.passphrase.submitPassphrase, { deviceToken: squads[0].tokens[0], code: squads[0].code, answer: 'a b c' }))).toBe('WRONG_STATUS');
  });

  test('each member sees only their own word, and the clue names no other word', async () => {
    const t = newTest();
    const { dropId, squads } = await dealt(t, 'split-passphrase');
    expect((await t.query(api.drops.drop, { deviceToken: 'p0', dropId }))!.template).toBe('split-passphrase');
    for (const squad of squads) {
      const words = await answerOf(t, squad);
      expect(new Set(words).size).toBe(3);
      for (const d of squad.tokens) {
        const p = (await pieceOf(t, d, squad.code))!;
        expect(p).toMatchObject({ slotCount: 3, squadSize: 3, squad: { status: 'solving', proposal: null, lastNudge: null } });
        expect(p.teammates.map((m) => m.position)).toEqual([0, 1, 2]);
        expect(p.teammates.filter((m) => m.isMe).map((m) => m.position)).toEqual([p.position]);
        for (const other of words.filter((w) => w !== p.word)) {
          expect(JSON.stringify(p)).not.toMatch(new RegExp('\\b' + other + '\\b'));
          expect(p.clue).not.toMatch(new RegExp('\\b' + other + '\\b'));
        }
        expect(p.clue).toContain('slot ' + (p.position + 1));
      }
    }
    expect(squads[0].tokens.map((d) => NAMES[Number(d.slice(1))].split(' ')[0]).sort()).toEqual(
      (await pieceOf(t, squads[0].tokens[0], squads[0].code))!.teammates.map((m) => m.name).sort(),
    );
  });

  test('non-members get nothing', async () => {
    const t = newTest();
    const { squads } = await dealt(t, 'split-passphrase');
    const [a, b] = squads;
    expect(await pieceOf(t, 'stranger', a.code)).toBeNull();
    expect(await pieceOf(t, b.tokens[0], a.code)).toBeNull();
    expect(await pieceOf(t, HOST, a.code)).toBeNull();
    expect(await errorCode(t.mutation(api.passphrase.submitPassphrase, { deviceToken: b.tokens[0], code: a.code, answer: 'a b c' }))).toBe('NOT_A_MEMBER');
    expect(await errorCode(t.mutation(api.passphrase.confirmPassphrase, { deviceToken: 'stranger', code: a.code, revision: 0 }))).toBe('NOT_A_MEMBER');
  });

  test('a correct passphrase needs everyone, then solves on the server clock and ranks', async () => {
    const t = newTest();
    const { dropId, squads } = await dealt(t, 'split-passphrase');
    vi.advanceTimersByTime(30_000);
    const { proposed, last } = await solve(t, squads[1]);
    expect(proposed).toMatchObject({ outcome: 'pending', confirmed: 1, needed: 3 });
    expect(last).toMatchObject({ outcome: 'correct', place: 1 });
    const p = (await pieceOf(t, squads[1].tokens[0], squads[1].code))!;
    expect(p.squad).toMatchObject({ status: 'solved', proposal: null, result: { place: 1, winner: true } });
    expect(p.squad.result!.solveMs).toBeGreaterThan(25_000);
    expect(await errorCode(t.mutation(api.passphrase.submitPassphrase, { deviceToken: squads[1].tokens[0], code: squads[1].code, answer: 'a b c' }))).toBe('WRONG_STATUS');
    expect((await solve(t, squads[0])).last).toMatchObject({ outcome: 'correct', place: 2 });
    const board = (await t.query(api.drops.leaderboard, { deviceToken: 'p0', dropId }))!;
    expect(board.rows.map((r) => r.rank)).toEqual([1, 2]);
    expect(board.status).toBe('ended');
    const host = (await t.query(api.drops.hostView, { deviceToken: HOST, dropId }))!;
    expect(host.squads.map((s) => s.status).sort()).toEqual(['winner', 'winner']);
  });

  test('a wrong answer costs the 20 s cooldown and nudges toward the holder, never the word', async () => {
    const t = newTest();
    const { squads } = await dealt(t, 'split-passphrase');
    const squad = squads[0];
    const words = await answerOf(t, squad);
    const wrong = [words[1], words[0], words[2]].join(' ');
    const proposed = await t.mutation(api.passphrase.submitPassphrase, { deviceToken: squad.tokens[0], code: squad.code, answer: wrong });
    await t.mutation(api.passphrase.confirmPassphrase, { deviceToken: squad.tokens[1], code: squad.code, revision: proposed.revision });
    const out = await t.mutation(api.passphrase.confirmPassphrase, { deviceToken: squad.tokens[2], code: squad.code, revision: proposed.revision });
    expect(out.outcome).toBe('wrong');
    expect(out.cooldownUntil! - Date.now()).toBeGreaterThanOrEqual(WRONG_GUESS_COOLDOWN_MS - 5);
    expect(out.cooldownUntil! - Date.now()).toBeLessThanOrEqual(WRONG_GUESS_COOLDOWN_MS + 5);
    expect(out.nudge!.text).toContain('Slot 1');
    expect(out.nudge!.holderName).toBeTruthy();
    for (const w of words) expect(out.nudge!.text).not.toMatch(new RegExp('\\b' + w + '\\b'));
    const p = (await pieceOf(t, squad.tokens[1], squad.code))!;
    expect(p.squad).toMatchObject({ status: 'cooldown', proposal: null, attempts: 1, lastNudge: out.nudge });
    expect(await errorCode(t.mutation(api.passphrase.submitPassphrase, { deviceToken: squad.tokens[1], code: squad.code, answer: words.join(' ') }))).toBe('COOLDOWN');
    vi.advanceTimersByTime(WRONG_GUESS_COOLDOWN_MS + 10);
    expect((await pieceOf(t, squad.tokens[1], squad.code))!.squad.status).toBe('solving');
    expect(await errorCode(t.mutation(api.passphrase.submitPassphrase, { deviceToken: squad.tokens[1], code: squad.code, answer: 'too few' }))).toBe('BAD_ANSWER');
    expect((await solve(t, squad)).last).toMatchObject({ outcome: 'correct', place: 1 });
    const room = await t.run((ctx) => ctx.db.query('rooms').withIndex('by_code', (q) => q.eq('code', squad.code)).unique());
    expect(room!.attempts).toBe(1);
  });

  test('proposals are stored and shown exactly as typed, never corrected from the answer', async () => {
    const t = newTest();
    const { squads } = await dealt(t, 'split-passphrase');
    const squad = squads[0];
    const words = await answerOf(t, squad);
    const typed = [words[0].toUpperCase(), 'Wrongword', words[2][0].toUpperCase() + words[2].slice(1)];
    const proposed = await t.mutation(api.passphrase.submitPassphrase, { deviceToken: squad.tokens[0], code: squad.code, answer: typed.join(', ') });
    expect(proposed.outcome).toBe('pending');
    const shown = (await pieceOf(t, squad.tokens[1], squad.code))!.squad;
    expect(shown).toMatchObject({ status: 'confirming', proposal: { revision: proposed.revision, words: typed, confirmedByMe: false } });
    expect(shown.proposal!.proposedBy).toBe((await pieceOf(t, squad.tokens[0], squad.code))!.teammates.find((m) => m.isMe)!.name);
    const stored = await t.run((ctx) => ctx.db.query('rooms').withIndex('by_code', (q) => q.eq('code', squad.code)).unique());
    expect(stored!.passphrase!.typed).toEqual(typed);
    expect(await errorCode(t.mutation(api.passphrase.confirmPassphrase, { deviceToken: squad.tokens[1], code: squad.code, revision: proposed.revision - 1 }))).toBe('STALE_REVISION');
  });

  test('the Case 01 theory and lock-in route is refused: no solve, no award', async () => {
    const t = newTest();
    const { dropId, squads } = await dealt(t, 'split-passphrase');
    const squad = squads[0];
    for (const d of squad.tokens) await t.mutation(api.signal.setPresence, { deviceToken: d, code: squad.code, presence: 'ready' });
    expect(await errorCode(t.mutation(api.signal.setTheory, { deviceToken: squad.tokens[0], code: squad.code, culprit: 'jun' }))).toBe('NOT_CASE_ROOM');
    for (const d of squad.tokens) expect(await errorCode(t.mutation(api.signal.lockIn, { deviceToken: d, code: squad.code, revision: 0 }))).toBe('NOT_CASE_ROOM');
    expect(await errorCode(t.mutation(api.signal.restart, { deviceToken: squad.tokens[0], code: squad.code, confirm: true }))).toBe('NOT_CASE_ROOM');
    expect(await errorCode(t.mutation(api.signal.claimRole, { deviceToken: squad.tokens[0], code: squad.code, role: 'detective' }))).toBe('NOT_CASE_ROOM');
    expect(await errorCode(t.mutation(api.signal.startCase, { deviceToken: squad.tokens[0], code: squad.code }))).toBe('NOT_CASE_ROOM');
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const [solves, awards, room] = await t.run(async (ctx) => [
      await ctx.db.query('solves').collect(),
      await ctx.db.query('bountyAwards').collect(),
      await ctx.db.query('rooms').withIndex('by_code', (q) => q.eq('code', squad.code)).unique(),
    ]);
    expect(solves).toEqual([]);
    expect(awards).toEqual([]);
    expect(room).toMatchObject({ status: 'playing', theory: { culprit: null, revision: 0 } });
    expect((await t.query(api.drops.leaderboard, { deviceToken: 'p0', dropId }))!.rows.every((r) => r.rank === null)).toBe(true);
    expect(await t.query(api.drops.myAward, { deviceToken: squad.tokens[0], code: squad.code })).toBeNull();
  });

  test('a winning squad gets its award', async () => {
    const t = newTest();
    const { squads } = await dealt(t, 'split-passphrase');
    await solve(t, squads[0]);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const award = await t.query(api.drops.myAward, { deviceToken: squads[0].tokens[1], code: squads[0].code });
    expect(award).toMatchObject({ place: 1 });
    expect(await t.query(api.drops.myAward, { deviceToken: squads[1].tokens[0], code: squads[1].code })).toBeNull();
  });
});
