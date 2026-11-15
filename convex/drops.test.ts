/// <reference types="vite/client" />
import presenceTest from '@convex-dev/presence/test';
import { convexTest } from 'convex-test';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { api, internal } from './_generated/api';
import { CONCEPT_LABEL } from './bounty';
import { DEMO_DROP_ID, dealPieces, splitSizes } from './drops';
import schema from './schema';
import { WRONG_GUESS_COOLDOWN_MS } from './signal';

const modules = import.meta.glob('./**/*.ts');

const PIECE_TEXT = {
  hacker: 'dock camera shows Theo',
  witness: 'Priya played Go with me',
  detective: 'Ines was locked inside the clean room',
} as const;
const LEAKS = ['Jun took', 'galley oven', 'Nobody could place Jun', 'Second Seed'];

function newTest() {
  const t = convexTest(schema, modules);
  presenceTest.register(t);
  return t;
}
type T = ReturnType<typeof newTest>;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-15T20:00:00Z'));
});
afterEach(() => {
  vi.useRealTimers();
});

async function errorCode(p: Promise<unknown>) {
  try {
    await p;
  } catch (e) {
    return (e as { data?: { code?: string } }).data?.code;
  }
  throw new Error('expected the call to fail');
}

const tokens = (n: number) => Array.from({ length: n }, (_, i) => `p${i + 1}`);

async function dropWith(n: number, opts: { winnerSlots?: number; squadSize?: 2 | 3; totalCents?: number } = {}) {
  const t = newTest();
  await t.mutation(internal.drops.createDrop, {
    dropId: 'd1',
    title: 'Test drop',
    creatorName: 'Creator',
    startsAt: Date.now() + 60_000,
    caseId: 'aurora01',
    squadSize: opts.squadSize ?? 3,
    bounty: { totalCents: opts.totalCents ?? 30_000, currency: 'usd', winnerSlots: opts.winnerSlots ?? 3 },
  });
  for (const token of tokens(n)) {
    await t.mutation(api.drops.enterDrop, { deviceToken: token, dropId: 'd1', name: token.toUpperCase() });
  }
  return t;
}

async function started(n: number, opts?: Parameters<typeof dropWith>[1]) {
  const t = await dropWith(n, opts);
  await t.mutation(internal.drops.startNow, { dropId: 'd1' });
  const squads = new Map<string, string[]>();
  for (const token of tokens(n)) {
    const code = (await t.query(api.drops.drop, { deviceToken: token, dropId: 'd1' }))?.me.squad?.code;
    if (code) squads.set(code, [...(squads.get(code) ?? []), token]);
  }
  return { t, squads: [...squads.entries()].map(([code, members]) => ({ code, members })) };
}

async function toPlaying(t: T, code: string, members: string[]) {
  for (const deviceToken of members) await t.mutation(api.signal.setPresence, { deviceToken, code, presence: 'ready' });
}

async function lockAllBut(t: T, code: string, members: string[], culprit: 'jun' | 'theo' | 'priya' | 'ines') {
  const { revision } = await t.mutation(api.signal.setTheory, { deviceToken: members[0], code, culprit });
  for (const deviceToken of members.slice(0, -1)) await t.mutation(api.signal.lockIn, { deviceToken, code, revision });
  return revision;
}

describe('squad split', () => {
  test('sizes for 2 to 12 entrants at a target of 3 and of 2', () => {
    const expected3: Record<number, number[]> = {
      2: [2], 3: [3], 4: [2, 2], 5: [3, 2], 6: [3, 3], 7: [3, 2, 2], 8: [3, 3, 2],
      9: [3, 3, 3], 10: [3, 3, 2, 2], 11: [3, 3, 3, 2], 12: [3, 3, 3, 3],
    };
    for (let n = 2; n <= 12; n++) {
      expect(splitSizes(n, 3)).toEqual(expected3[n]);
      const two = splitSizes(n, 2);
      expect(two.reduce((a, b) => a + b, 0)).toBe(n);
      expect(two.filter((s) => s === 3)).toHaveLength(n % 2);
      expect(two.every((s) => s === 2 || s === 3)).toBe(true);
    }
    expect(splitSizes(1, 3)).toEqual([]);
    expect(splitSizes(0, 2)).toEqual([]);
  });

  test('a duo always has one 2-piece seat and one 1-piece seat covering all three pieces', () => {
    for (let i = 0; i < 9; i++) {
      const hands = dealPieces('d1', i, 2);
      expect(hands.map((h) => h.length)).toEqual([2, 1]);
      expect(new Set(hands.flat())).toEqual(new Set(['hacker', 'witness', 'detective']));
      expect(dealPieces('d1', i, 2)).toEqual(hands);
    }
  });

  test('the start forms squads in entry order and opens every room at intro', async () => {
    const { t, squads } = await started(7);
    expect(squads.map((s) => s.members)).toEqual([['p1', 'p2', 'p3'], ['p4', 'p5'], ['p6', 'p7']]);
    for (const s of squads) {
      const room = await t.query(api.signal.room, { deviceToken: s.members[0], code: s.code });
      expect(room).toMatchObject({ status: 'intro', squadSize: s.members.length, isHost: false, caseId: 'aurora01' });
    }
    expect((await t.query(api.drops.drop, { deviceToken: 'p1', dropId: 'd1' }))?.status).toBe('live');
  });

  test('the scheduled start fires at startsAt', async () => {
    const t = await dropWith(3);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const view = await t.query(api.drops.drop, { deviceToken: 'p1', dropId: 'd1' });
    expect(view?.status).toBe('live');
    expect(view?.me.squad?.size).toBe(3);
  });

  test('a lone entrant is unmatched and the drop ends', async () => {
    const { t, squads } = await started(1);
    expect(squads).toEqual([]);
    const view = await t.query(api.drops.drop, { deviceToken: 'p1', dropId: 'd1' });
    expect(view).toMatchObject({ status: 'ended', me: { entered: true, unmatched: true, squad: null } });
  });
});

describe('evidence gating per squad size', () => {
  test('each phone receives only its own pieces, in trios and duos, and never the answer', async () => {
    const { t, squads } = await started(5);
    expect(squads.map((s) => s.members.length)).toEqual([3, 2]);
    for (const { code, members } of squads) {
      const seen = new Set<string>();
      for (const deviceToken of members) {
        const evidence = await t.query(api.signal.myEvidence, { deviceToken, code });
        const room = await t.query(api.signal.room, { deviceToken, code });
        const dossier = await t.query(api.signal.myDossier, { deviceToken, code });
        const reveal = await t.query(api.signal.reveal, { deviceToken, code });
        const drop = await t.query(api.drops.drop, { deviceToken, dropId: 'd1' });
        const board = await t.query(api.drops.leaderboard, { deviceToken, dropId: 'd1' });
        const received = JSON.stringify({ evidence, room, dossier, reveal, drop, board });
        const mine = room!.members.find((m) => m.isMe)!.roles;
        expect(evidence!.map((e) => e.role)).toEqual(mine);
        for (const [r, text] of Object.entries(PIECE_TEXT)) {
          expect(received.includes(text)).toBe(mine.includes(r as keyof typeof PIECE_TEXT));
        }
        for (const leak of LEAKS) expect(received).not.toContain(leak);
        for (const token of tokens(5)) expect(received).not.toContain(`"${token}"`);
        mine.forEach((r) => seen.add(r));
      }
      expect(seen).toEqual(new Set(['hacker', 'witness', 'detective']));
    }
    const duo = squads[1];
    const counts = (await t.query(api.signal.room, { deviceToken: duo.members[0], code: duo.code }))!.members.map(
      (m) => m.roles.length,
    );
    expect(counts).toEqual([2, 1]);
  });

  test('a duo needs both lock-ins, nudges toward the holder, and pays the wrong guess in time', async () => {
    const { t, squads } = await started(2);
    const [{ code, members }] = squads;
    await toPlaying(t, code, members);
    const room = (await t.query(api.signal.room, { deviceToken: members[0], code }))!;
    const camera = room.members.find((m) => m.roles.includes('hacker'))!;
    const revision = await lockAllBut(t, code, members, 'theo');
    const result = await t.mutation(api.signal.lockIn, { deviceToken: members[1], code, revision });
    expect(result).toMatchObject({
      outcome: 'wrong',
      nudge: { wrongPick: 'theo', forRole: 'hacker', holder: { memberId: camera.memberId, name: camera.name } },
    });
    expect(result.outcome === 'wrong' && result.nudge.text).toBe(`Not Theo. Ask ${camera.name} to read the Camera Log.`);
    const cooldownUntil = (await t.query(api.signal.room, { deviceToken: members[0], code }))!.cooldownUntil!;
    expect(cooldownUntil - Date.now()).toBeGreaterThanOrEqual(WRONG_GUESS_COOLDOWN_MS - 5);
    expect(cooldownUntil - Date.now()).toBeLessThanOrEqual(WRONG_GUESS_COOLDOWN_MS + 5);
    const next = await lockAllBut(t, code, members, 'jun').catch((e) => e);
    expect((next as { data?: { code?: string } }).data?.code).toBe('COOLDOWN');
    vi.advanceTimersByTime(WRONG_GUESS_COOLDOWN_MS + 10);
    const rev = await lockAllBut(t, code, members, 'jun');
    expect(await t.mutation(api.signal.lockIn, { deviceToken: members[1], code, revision: rev })).toEqual({
      outcome: 'resolved',
    });
    const reveal = await t.query(api.signal.reveal, { deviceToken: members[1], code });
    expect(reveal?.headline).toBe('Jun took the seed.');
    expect(reveal?.credits.map((c) => c.memberName)).toContain(camera.name);
    expect(reveal?.credits.find((c) => c.role === 'hacker')?.line).toBe(
      `${camera.name}'s Camera Log placed Theo at the docking ring.`,
    );
  });
});

describe('ranking and awards', () => {
  async function raceFive() {
    const { t, squads } = await started(15, { winnerSlots: 3, totalCents: 30_000 });
    expect(squads).toHaveLength(5);
    const revisions: number[] = [];
    for (const s of squads) {
      await toPlaying(t, s.code, s.members);
      revisions.push(await lockAllBut(t, s.code, s.members, 'jun'));
    }
    const order = [3, 0, 4, 1, 2];
    await Promise.all(
      order.map((i) =>
        t.mutation(api.signal.lockIn, { deviceToken: squads[i].members.at(-1)!, code: squads[i].code, revision: revisions[i] }),
      ),
    );
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    return { t, squads };
  }

  test('simultaneous final lock-ins produce exactly X winners with stable, unique places', async () => {
    const { t, squads } = await raceFive();
    const board = await t.query(api.drops.leaderboard, { deviceToken: 'outsider', dropId: 'd1' });
    expect(board?.rows.map((r) => r.rank)).toEqual([1, 2, 3, 4, 5]);
    expect(board?.rows.map((r) => r.status)).toEqual(['winner', 'winner', 'winner', 'solved', 'solved']);
    expect(await t.query(api.drops.leaderboard, { deviceToken: 'outsider', dropId: 'd1' })).toEqual(board);
    const awards = await t.run((ctx) => ctx.db.query('bountyAwards').collect());
    expect(awards.map((a) => a.place).sort()).toEqual([1, 2, 3]);
    const winnerCodes = new Set(
      (await t.run((ctx) => ctx.db.query('solves').collect())).filter((s) => s.place <= 3).map((s) => s.roomId),
    );
    expect(winnerCodes.size).toBe(3);
    const drop = await t.query(api.drops.drop, { deviceToken: 'p1', dropId: 'd1' });
    expect(drop).toMatchObject({ status: 'ended', winnersSoFar: 3 });
    for (const s of squads) {
      const room = await t.query(api.signal.room, { deviceToken: s.members[0], code: s.code });
      expect(room?.drop?.isWinner).toBe((room?.drop?.rank ?? 99) <= 3);
    }
  });

  test('winners get a labeled concept award, non-winners get nothing, and a claim stays inside its squad', async () => {
    const { t, squads } = await raceFive();
    const placeOf = async (s: { code: string; members: string[] }) =>
      (await t.query(api.signal.room, { deviceToken: s.members[0], code: s.code }))!.drop!.rank!;
    const ranked = await Promise.all(squads.map(async (s) => ({ ...s, place: await placeOf(s) })));
    const winner = ranked.find((s) => s.place === 1)!;
    const loser = ranked.find((s) => s.place === 4)!;
    for (const deviceToken of winner.members) {
      expect(await t.query(api.drops.myAward, { deviceToken, code: winner.code })).toEqual({
        place: 1,
        amountCents: 9_999,
        perPlayerCents: 3_333,
        currency: 'usd',
        mode: 'concept',
        status: 'ready',
        claimUrl: null,
        redeemableCount: 3,
        label: CONCEPT_LABEL,
        expiresAt: null,
      });
    }
    for (const deviceToken of loser.members) {
      expect(await t.query(api.drops.myAward, { deviceToken, code: loser.code })).toBeNull();
      expect(await t.query(api.drops.myAward, { deviceToken, code: winner.code })).toBeNull();
    }
    expect(await t.query(api.drops.myAward, { deviceToken: 'outsider', code: winner.code })).toBeNull();
  });
});

describe('entry', () => {
  test('entry is free and idempotent, with no entitlement anywhere', async () => {
    const t = await dropWith(2);
    await t.mutation(api.drops.enterDrop, { deviceToken: 'p1', dropId: 'd1', name: 'Renamed' });
    const view = await t.query(api.drops.drop, { deviceToken: 'p1', dropId: 'd1' });
    expect(view?.entrantCount).toBe(2);
    expect(view?.entrants).toEqual([
      { name: 'Renamed', isMe: true },
      { name: 'P2', isMe: false },
    ]);
    expect(await t.run((ctx) => ctx.db.query('entitlements').collect())).toEqual([]);
    expect(await errorCode(t.mutation(api.drops.enterDrop, { deviceToken: 'x', dropId: 'nope', name: 'X' }))).toBe(
      'DROP_NOT_FOUND',
    );
  });

  test('a late joiner after the start is turned away but can watch the leaderboard', async () => {
    const { t } = await started(3);
    expect(await errorCode(t.mutation(api.drops.enterDrop, { deviceToken: 'late', dropId: 'd1', name: 'Late' }))).toBe(
      'DROP_CLOSED',
    );
    expect((await t.query(api.drops.drop, { deviceToken: 'late', dropId: 'd1' }))?.me.entered).toBe(false);
    const board = await t.query(api.drops.leaderboard, { deviceToken: 'late', dropId: 'd1' });
    expect(board?.rows).toHaveLength(1);
    expect(board?.rows[0]).toMatchObject({ status: 'solving', isMine: false });
  });

  test('leaving the waiting room removes the entry, and only before the start', async () => {
    const t = await dropWith(4);
    await t.mutation(api.drops.leaveDrop, { deviceToken: 'p2', dropId: 'd1' });
    expect((await t.query(api.drops.drop, { deviceToken: 'p1', dropId: 'd1' }))?.entrants.map((e) => e.name)).toEqual([
      'P1',
      'P3',
      'P4',
    ]);
    expect(await errorCode(t.mutation(api.drops.leaveDrop, { deviceToken: 'p2', dropId: 'd1' }))).toBe('NOT_ENTERED');
    await t.mutation(internal.drops.startNow, { dropId: 'd1' });
    expect((await t.query(api.drops.drop, { deviceToken: 'p2', dropId: 'd1' }))?.me.squad).toBeNull();
    expect(await errorCode(t.mutation(api.drops.leaveDrop, { deviceToken: 'p1', dropId: 'd1' }))).toBe('DROP_CLOSED');
  });

  test('the demo seed recreates a fresh demo drop and squads have no host to restart them', async () => {
    const t = newTest();
    await t.mutation(internal.drops.seedDemo, { startsInSeconds: 60 });
    await t.mutation(api.drops.enterDrop, { deviceToken: 'p1', dropId: DEMO_DROP_ID, name: 'P1' });
    await t.mutation(api.drops.enterDrop, { deviceToken: 'p2', dropId: DEMO_DROP_ID, name: 'P2' });
    await t.mutation(internal.drops.startNow, { dropId: DEMO_DROP_ID });
    const code = (await t.query(api.drops.drop, { deviceToken: 'p1', dropId: DEMO_DROP_ID }))!.me.squad!.code;
    expect(await errorCode(t.mutation(api.signal.restart, { deviceToken: 'p1', code, confirm: true }))).toBe('NOT_HOST');
    await t.mutation(internal.drops.seedDemo, { startsInSeconds: 60 });
    const fresh = await t.query(api.drops.drop, { deviceToken: 'p1', dropId: DEMO_DROP_ID });
    expect(fresh).toMatchObject({ status: 'scheduled', entrantCount: 0, me: { entered: false } });
    expect(await t.query(api.signal.room, { deviceToken: 'p1', code })).toBeNull();
    expect(await t.query(api.drops.listDrops, {})).toHaveLength(1);
  });
});
