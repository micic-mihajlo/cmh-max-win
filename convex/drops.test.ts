/// <reference types="vite/client" />
import presenceTest from '@convex-dev/presence/test';
import rateLimiterTest from '@convex-dev/rate-limiter/test';
import { convexTest } from 'convex-test';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { api, internal } from './_generated/api';
import { CONCEPT_LABEL } from './bounty';
import { DEMO_DROP_ID, DROP_CAPACITY, dealPieces, splitSizes } from './drops';
import { parseJoinCode } from '../src/lib/join-code';
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
  rateLimiterTest.register(t);
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
    const seen = await Promise.all(members.map((deviceToken) => t.query(api.signal.room, { deviceToken, code })));
    expect(seen.map((v) => [v!.me!.memberId === camera.memberId, v!.lastNudge!.text]).sort()).toEqual([
      [false, `Not Theo. Ask ${camera.name} to read the Camera Log.`],
      [true, 'Not Theo. Your Camera Log places him at the docking ring.'],
    ]);
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
    const statement = room.members.find((m) => m.roles.includes('witness'))!;
    expect(reveal?.credits.find((c) => c.role === 'witness')?.line).toBe(`${statement.name}'s Statement put Priya at the Go board.`);
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

describe('squad seats are not reclaimable', () => {
  test('a stranger with the code is refused and never sees the evidence or the award; members still rejoin', async () => {
    const { t, squads } = await started(3, { winnerSlots: 1 });
    const [{ code, members }] = squads;
    expect(await errorCode(t.mutation(api.signal.joinRoom, { deviceToken: 'stranger', code, name: 'S' }))).toBe(
      'CASE_STARTED',
    );
    for (const role of ['hacker', 'witness', 'detective'] as const) {
      expect(await errorCode(t.mutation(api.signal.reclaimRole, { deviceToken: 'stranger', code, role }))).toBe(
        'CASE_STARTED',
      );
    }
    expect((await t.query(api.signal.room, { deviceToken: 'stranger', code }))?.reclaimableRoles).toEqual([]);
    await toPlaying(t, code, members);
    const revision = await lockAllBut(t, code, members, 'jun');
    await t.mutation(api.signal.lockIn, { deviceToken: members.at(-1)!, code, revision });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const leaked = JSON.stringify({
      evidence: await t.query(api.signal.myEvidence, { deviceToken: 'stranger', code }),
      dossier: await t.query(api.signal.myDossier, { deviceToken: 'stranger', code }),
      award: await t.query(api.drops.myAward, { deviceToken: 'stranger', code }),
      reveal: await t.query(api.signal.reveal, { deviceToken: 'stranger', code }),
    });
    expect(leaked).toBe(JSON.stringify({ evidence: null, dossier: null, award: null, reveal: null }));
    for (const text of Object.values(PIECE_TEXT)) expect(leaked).not.toContain(text);
    expect(await t.mutation(api.signal.joinRoom, { deviceToken: members[0], code, name: 'again' })).toMatchObject({
      status: 'rejoined',
    });
    expect((await t.query(api.drops.myAward, { deviceToken: members[0], code }))?.status).toBe('ready');
  });
});

describe('demo controls', () => {
  test('both refuse unless SIGNAL_DEMO_CONTROLS is on', async () => {
    const t = newTest();
    for (const value of [undefined, 'off', 'true']) {
      if (value === undefined) vi.unstubAllEnvs();
      else vi.stubEnv('SIGNAL_DEMO_CONTROLS', value);
      expect(await errorCode(t.mutation(api.demo.openDrop, { squadSize: 2 }))).toBe('DEMO_CONTROLS_OFF');
      expect(await errorCode(t.mutation(api.demo.startNow, { dropId: 'd1' }))).toBe('DEMO_CONTROLS_OFF');
    }
    expect(await t.run((ctx) => ctx.db.query('drops').collect())).toEqual([]);
    vi.unstubAllEnvs();
  });

  test('startNow only starts demo drops, never aurora-demo or a real bounty drop', async () => {
    vi.stubEnv('SIGNAL_DEMO_CONTROLS', 'on');
    const t = await dropWith(3);
    await t.mutation(internal.drops.seedDemo, { startsInSeconds: 600 });
    await t.mutation(api.drops.enterDrop, { deviceToken: 'p9', dropId: DEMO_DROP_ID, name: 'P9' });
    await t.mutation(api.drops.enterDrop, { deviceToken: 'p8', dropId: DEMO_DROP_ID, name: 'P8' });
    await t.run(async (ctx) => {
      await ctx.db.insert('drops', {
        dropId: 'demo-forged',
        title: 'Forged',
        creatorName: 'X',
        caseId: 'aurora01',
        squadSize: 3,
        startsAt: Date.now() + 600_000,
        status: 'scheduled',
        bounty: { totalCents: 100, currency: 'usd', winnerSlots: 1 },
        solvedCount: 0,
      });
    });
    for (const dropId of ['d1', DEMO_DROP_ID, 'demo-forged']) {
      expect(await errorCode(t.mutation(api.demo.startNow, { dropId }))).toBe('WRONG_STATUS');
      expect((await t.query(api.drops.drop, { deviceToken: 'p1', dropId }))?.status).toBe('scheduled');
    }
    expect(await errorCode(t.mutation(api.demo.startNow, { dropId: 'missing' }))).toBe('DROP_NOT_FOUND');
    const { dropId } = await t.mutation(api.demo.openDrop, { squadSize: 2 });
    await t.mutation(api.demo.startNow, { dropId });
    expect((await t.query(api.drops.drop, { deviceToken: 'p1', dropId }))?.status).toBe('ended');
    vi.unstubAllEnvs();
  });

  test('when on, a forced squad size makes squads of exactly that size', async () => {
    vi.stubEnv('SIGNAL_DEMO_CONTROLS', 'on');
    const t = newTest();
    for (const size of [2, 3] as const) {
      const { dropId } = await t.mutation(api.demo.openDrop, { squadSize: size, startInSeconds: 300 });
      for (const token of tokens(7)) {
        await t.mutation(api.drops.enterDrop, { deviceToken: `${size}-${token}`, dropId, name: token });
      }
      await t.mutation(api.demo.startNow, { dropId });
      const board = await t.query(api.drops.leaderboard, { deviceToken: 'x', dropId });
      expect(board?.rows.map((r) => r.memberNames.length)).toEqual(size === 2 ? [2, 2, 2] : [3, 3]);
      const last = await t.query(api.drops.drop, { deviceToken: `${size}-p7`, dropId });
      expect(last?.me).toMatchObject({ unmatched: true, squad: null });
    }
    vi.unstubAllEnvs();
  });
});

describe('join codes', () => {
  test('every way of creating a drop sets a 4-char join code, unique among open drops', async () => {
    vi.stubEnv('SIGNAL_DEMO_CONTROLS', 'on');
    const t = await dropWith(0);
    const seeded = await t.mutation(internal.drops.seedDemo, { startsInSeconds: 600 });
    const codes = [seeded.joinCode];
    for (let i = 0; i < 20; i++) codes.push((await t.mutation(api.demo.openDrop, { squadSize: 3 })).joinCode);
    codes.push((await t.query(api.drops.drop, { deviceToken: 'x', dropId: 'd1' }))!.joinCode!);
    for (const code of codes) expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/);
    expect(new Set(codes).size).toBe(codes.length);
    vi.unstubAllEnvs();
  });

  test('a scanned code finds the drop and enters it; the host view updates live', async () => {
    const t = await dropWith(0);
    const code = (await t.query(api.drops.drop, { deviceToken: 'host', dropId: 'd1' }))!.joinCode!;
    expect(await t.query(api.drops.dropByCode, { deviceToken: 'p1', code: code.toLowerCase() })).toMatchObject({
      dropId: 'd1',
      status: 'scheduled',
      me: { entered: false },
    });
    for (const token of tokens(4)) {
      expect(await t.mutation(api.drops.enterDropByCode, { deviceToken: token, code, name: token })).toEqual({
        dropId: 'd1',
      });
    }
    const host = await t.query(api.drops.dropByCode, { deviceToken: 'host', code });
    expect(host).toMatchObject({ entrantCount: 4, entrants: tokens(4).map((name) => ({ name, isMe: false })) });
    await t.mutation(internal.drops.startNow, { dropId: 'd1' });
    expect((await t.query(api.drops.dropByCode, { deviceToken: 'host', code }))?.status).toBe('live');
    expect((await t.query(api.drops.leaderboard, { deviceToken: 'host', dropId: 'd1' }))?.rows.map((r) => r.memberNames)).toEqual([
      ['p1', 'p2'],
      ['p3', 'p4'],
    ]);
    expect(await errorCode(t.mutation(api.drops.enterDropByCode, { deviceToken: 'late', code, name: 'L' }))).toBe(
      'DROP_CLOSED',
    );
    expect(await errorCode(t.mutation(api.drops.enterDropByCode, { deviceToken: 'x', code: 'ZZZZ', name: 'X' }))).toBe(
      'DROP_NOT_FOUND',
    );
    expect(await t.query(api.drops.dropByCode, { deviceToken: 'x', code: 'ZZZZ' })).toBeNull();
  });

  test('an ended drop stops answering to its code, and the backfill codes older open drops', async () => {
    const { t } = await started(1);
    const code = (await t.query(api.drops.drop, { deviceToken: 'p1', dropId: 'd1' }))!.joinCode!;
    expect(await t.query(api.drops.dropByCode, { deviceToken: 'p1', code })).toBeNull();
    await t.run(async (ctx) => {
      await ctx.db.insert('drops', {
        dropId: 'old',
        title: 'Old',
        creatorName: 'X',
        caseId: 'aurora01',
        squadSize: 3,
        startsAt: Date.now() + 60_000,
        status: 'scheduled',
        bounty: { totalCents: 0, currency: 'usd', winnerSlots: 1 },
        solvedCount: 0,
      });
    });
    const filled = await t.mutation(internal.drops.backfillJoinCodes, {});
    expect(filled.map((f) => f.dropId)).toEqual(['old']);
    expect((await t.query(api.drops.dropByCode, { deviceToken: 'p1', code: filled[0].joinCode }))?.dropId).toBe('old');
  });

  test('the QR payload parser accepts a bare code or a URL ending in it', () => {
    expect(parseJoinCode('k7qx')).toBe('K7QX');
    expect(parseJoinCode(' https://signal.example/join/K7QX ')).toBe('K7QX');
    expect(parseJoinCode('exp://192.168.1.2:8081/--/join/K7QX?x=1')).toBe('K7QX');
    expect(parseJoinCode('https://signal.example/join/K7QX/')).toBe('K7QX');
    expect(parseJoinCode('K7Q0')).toBeNull();
    expect(parseJoinCode('hello world')).toBeNull();
  });
});

describe('host screen', () => {
  async function hosted(n: number) {
    const t = newTest();
    const { dropId, joinCode } = await t.mutation(api.drops.hostDrop, { deviceToken: 'host', winnerSlots: 1, totalCents: 30_000 });
    for (const token of tokens(n)) await t.mutation(api.drops.enterDropByCode, { deviceToken: token, code: joinCode, name: token });
    return { t, dropId, joinCode };
  }

  test('an all-demo squad is labelled Demo Squad A/B/C; real squads keep their numbers', async () => {
    const { t, dropId, joinCode } = await hosted(3);
    for (const n of ['Rio', 'Kai', 'Ash', 'Lux', 'Bo', 'Ivy']) {
      await t.mutation(api.drops.enterDropByCode, { deviceToken: 'demo-' + n, code: joinCode, name: 'Demo · ' + n });
    }
    await t.mutation(api.drops.enterDropByCode, { deviceToken: 'p4', code: joinCode, name: 'p4' });
    await t.mutation(api.drops.enterDropByCode, { deviceToken: 'p5', code: joinCode, name: 'Demo · Mix' });
    await t.mutation(api.drops.enterDropByCode, { deviceToken: 'p6', code: joinCode, name: 'p6' });
    await t.mutation(api.drops.dealSquads, { deviceToken: 'host', dropId });
    const board = await t.query(api.drops.leaderboard, { deviceToken: 'p1', dropId });
    expect(board?.rows.map((r) => [r.squadLabel, r.memberNames])).toEqual([
      ['Squad 1', ['p1', 'p2', 'p3']],
      ['Demo Squad A', ['Demo · Rio', 'Demo · Kai', 'Demo · Ash']],
      ['Demo Squad B', ['Demo · Lux', 'Demo · Bo', 'Demo · Ivy']],
      ['Squad 2', ['p4', 'Demo · Mix', 'p6']],
    ]);
  });

  test('hostDrop names the drop after creatorName, else the newest name the host token used, else Host', async () => {
    const t = newTest();
    const creator = async (args: { deviceToken: string; creatorName?: string }) => {
      const { joinCode } = await t.mutation(api.drops.hostDrop, args);
      return (await t.query(api.drops.dropByCode, { deviceToken: 'x', code: joinCode }))!.creatorName;
    };
    expect(await creator({ deviceToken: 'h1', creatorName: '  Nova ' })).toBe('Nova');
    expect(await creator({ deviceToken: 'h2' })).toBe('Host');
    await t.mutation(api.signal.createRoom, { deviceToken: 'h2', name: 'Orion' });
    expect(await creator({ deviceToken: 'h2' })).toBe('Orion');
    const { joinCode } = await t.mutation(api.drops.hostDrop, { deviceToken: 'other' });
    await t.mutation(api.drops.enterDropByCode, { deviceToken: 'h2', code: joinCode, name: 'Nova' });
    expect(await creator({ deviceToken: 'h2' })).toBe('Nova');
  });

  test('hosted drops stay out of listDrops but answer to their code', async () => {
    const { t, joinCode } = await hosted(1);
    await t.mutation(internal.drops.seedDemo, { startsInSeconds: 60 });
    expect((await t.query(api.drops.listDrops, {})).map((d) => d.dropId)).toEqual([DEMO_DROP_ID]);
    expect(await t.query(api.drops.dropByCode, { deviceToken: 'p1', code: joinCode })).toMatchObject({ hosted: true });
  });

  test('only the host reads hostView and deals; dealing needs 4 players', async () => {
    const { t, dropId, joinCode } = await hosted(3);
    expect(await t.query(api.drops.hostView, { deviceToken: 'p1', dropId })).toBeNull();
    expect(await t.query(api.drops.hostView, { deviceToken: 'stranger', dropId })).toBeNull();
    const view = await t.query(api.drops.hostView, { deviceToken: 'host', dropId });
    expect(view).toMatchObject({
      joinCode,
      status: 'scheduled',
      entrantCount: 3,
      bounty: { totalCents: 30_000, winnerSlots: 1, mode: 'concept' },
      squads: [],
      solves: [],
    });
    expect(view?.entrants.map((e) => e.name)).toEqual(['p1', 'p2', 'p3']);
    expect(await errorCode(t.mutation(api.drops.dealSquads, { deviceToken: 'host', dropId }))).toBe('NOT_ENOUGH_PLAYERS');
    await t.mutation(api.drops.enterDropByCode, { deviceToken: 'p4', code: joinCode, name: 'p4' });
    for (const deviceToken of ['p1', 'stranger']) {
      expect(await errorCode(t.mutation(api.drops.dealSquads, { deviceToken, dropId }))).toBe('NOT_HOST');
    }
    await t.mutation(api.drops.dealSquads, { deviceToken: 'host', dropId });
    const dealt = await t.query(api.drops.hostView, { deviceToken: 'host', dropId });
    expect(dealt?.status).toBe('live');
    expect(dealt?.squads.map((s) => s.memberNames)).toEqual([
      ['p1', 'p2'],
      ['p3', 'p4'],
    ]);
    expect(await errorCode(t.mutation(api.drops.dealSquads, { deviceToken: 'host', dropId }))).toBe('WRONG_STATUS');
  });

  test('a hosted drop never takes the sandbox payout path, even with BOUNTY_MODE=sandbox', async () => {
    vi.stubEnv('BOUNTY_MODE', 'sandbox');
    vi.stubEnv('WHOP_API_KEY', 'test-key');
    vi.stubEnv('WHOP_ACCOUNT_ID', 'biz_test');
    const fetchSpy = vi.fn(() => Promise.reject(new Error('Whop must not be called')));
    vi.stubGlobal('fetch', fetchSpy);
    const { t, dropId } = await hosted(4);
    expect((await t.query(api.drops.drop, { deviceToken: 'p1', dropId }))?.bounty.mode).toBe('concept');
    await t.mutation(api.drops.dealSquads, { deviceToken: 'host', dropId });
    const code = (await t.query(api.drops.drop, { deviceToken: 'p1', dropId }))!.me.squad!.code;
    await toPlaying(t, code, ['p1', 'p2']);
    const revision = await lockAllBut(t, code, ['p1', 'p2'], 'jun');
    await t.mutation(api.signal.lockIn, { deviceToken: 'p2', code, revision });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(await t.query(api.drops.myAward, { deviceToken: 'p1', code })).toMatchObject({
      mode: 'concept',
      status: 'ready',
      claimUrl: null,
      label: CONCEPT_LABEL,
    });
    const view = await t.query(api.drops.hostView, { deviceToken: 'host', dropId });
    expect(view?.solves).toEqual([
      expect.objectContaining({ place: 1, squadLabel: 'Squad 1', isWinner: true, solvedAt: expect.any(Number) }),
    ]);
    expect(view?.squads[0]).toMatchObject({ status: 'winner', rank: 1 });
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });
});

describe('event guards', () => {
  async function fill(t: T, count: number) {
    await t.run(async (ctx) => {
      for (let i = 0; i < count; i++) {
        await ctx.db.insert('dropEntries', { dropId: 'd1', deviceToken: `seat-${i}`, name: `S${i}`, unmatched: false });
        await ctx.db.insert('dropSeats', { dropId: 'd1', seat: i, deviceToken: `seat-${i}` });
      }
    });
  }

  test(`a drop seats at most ${DROP_CAPACITY}; the next new device gets DROP_FULL`, async () => {
    const t = await dropWith(0);
    await fill(t, DROP_CAPACITY - 1);
    await t.mutation(api.drops.enterDrop, { deviceToken: 'last', dropId: 'd1', name: 'Last' });
    expect(await errorCode(t.mutation(api.drops.enterDrop, { deviceToken: 'extra', dropId: 'd1', name: 'Extra' }))).toBe(
      'DROP_FULL',
    );
    const code = (await t.query(api.drops.drop, { deviceToken: 'x', dropId: 'd1' }))!.joinCode!;
    expect(await errorCode(t.mutation(api.drops.enterDropByCode, { deviceToken: 'extra', code, name: 'Extra' }))).toBe(
      'DROP_FULL',
    );
    expect((await t.query(api.drops.drop, { deviceToken: 'extra', dropId: 'd1' }))?.entrantCount).toBe(DROP_CAPACITY);
    await t.mutation(api.drops.leaveDrop, { deviceToken: 'last', dropId: 'd1' });
    await t.mutation(api.drops.enterDrop, { deviceToken: 'extra', dropId: 'd1', name: 'Extra' });
    const seats = await t.run((ctx) => ctx.db.query('dropSeats').collect());
    expect(new Set(seats.map((s) => s.seat)).size).toBe(DROP_CAPACITY);
  });

  test('a seated device re-entering a full drop keeps its seat and adds no entrant', async () => {
    const t = await dropWith(0);
    await fill(t, DROP_CAPACITY);
    const code = (await t.query(api.drops.drop, { deviceToken: 'x', dropId: 'd1' }))!.joinCode!;
    expect(await t.mutation(api.drops.enterDropByCode, { deviceToken: 'seat-7', code, name: 'Seven' })).toEqual({ dropId: 'd1' });
    const view = await t.query(api.drops.drop, { deviceToken: 'seat-7', dropId: 'd1' });
    expect(view).toMatchObject({ entrantCount: DROP_CAPACITY, me: { entered: true, name: 'Seven' } });
  });

  test('entering is idempotent per device token, before and after the start', async () => {
    const t = await dropWith(3);
    for (let i = 0; i < 3; i++) await t.mutation(api.drops.enterDrop, { deviceToken: 'p1', dropId: 'd1', name: 'P1' });
    const code = (await t.query(api.drops.drop, { deviceToken: 'x', dropId: 'd1' }))!.joinCode!;
    await t.mutation(api.drops.enterDropByCode, { deviceToken: 'p1', code, name: 'P1' });
    const entries = async () => t.run((ctx) => ctx.db.query('dropEntries').withIndex('by_drop', (q) => q.eq('dropId', 'd1')).collect());
    expect((await entries()).filter((e) => e.deviceToken === 'p1')).toHaveLength(1);
    await t.mutation(internal.drops.startNow, { dropId: 'd1' });
    const seat = (await t.query(api.drops.drop, { deviceToken: 'p1', dropId: 'd1' }))!.me;
    expect(seat.squad).not.toBeNull();
    expect(await t.mutation(api.drops.enterDropByCode, { deviceToken: 'p1', code, name: 'Other name' })).toEqual({ dropId: 'd1' });
    await t.mutation(api.drops.enterDrop, { deviceToken: 'p1', dropId: 'd1', name: 'Other name' });
    expect((await t.query(api.drops.drop, { deviceToken: 'p1', dropId: 'd1' }))!.me).toEqual(seat);
    expect(await entries()).toHaveLength(3);
  });

  test('reseeding the demo drop frees all of its seats', async () => {
    const t = newTest();
    await t.mutation(internal.drops.seedDemo, { startsInSeconds: 60 });
    for (let i = 0; i < DROP_CAPACITY; i++) {
      await t.mutation(api.drops.enterDrop, { deviceToken: `seat-${i}`, dropId: DEMO_DROP_ID, name: `S${i}` });
    }
    expect(await errorCode(t.mutation(api.drops.enterDrop, { deviceToken: 'extra', dropId: DEMO_DROP_ID, name: 'Extra' }))).toBe(
      'DROP_FULL',
    );
    await t.mutation(internal.drops.seedDemo, { startsInSeconds: 60 });
    expect(await t.run((ctx) => ctx.db.query('dropSeats').collect())).toEqual([]);
    for (let i = 0; i < DROP_CAPACITY; i++) {
      await t.mutation(api.drops.enterDrop, { deviceToken: `again-${i}`, dropId: DEMO_DROP_ID, name: `A${i}` });
    }
    expect((await t.query(api.drops.drop, { deviceToken: 'x', dropId: DEMO_DROP_ID }))?.entrantCount).toBe(DROP_CAPACITY);
  });

  test('hostDrop allows 5 drops per device token per 10 minutes', async () => {
    const t = newTest();
    for (let i = 0; i < 5; i++) await t.mutation(api.drops.hostDrop, { deviceToken: 'h1' });
    let err: unknown;
    try {
      await t.mutation(api.drops.hostDrop, { deviceToken: 'h1' });
    } catch (e) {
      err = e;
    }
    const data = (err as { data: { code: string; retryAfterMs: number } }).data;
    expect(data.code).toBe('RATE_LIMITED');
    expect(data.retryAfterMs).toBeGreaterThan(0);
    expect(data.retryAfterMs).toBeLessThanOrEqual(10 * 60_000);
    await t.mutation(api.drops.hostDrop, { deviceToken: 'h2' });
    vi.setSystemTime(Date.now() + 10 * 60_000);
    await t.mutation(api.drops.hostDrop, { deviceToken: 'h1' });
    expect(await t.run((ctx) => ctx.db.query('drops').collect())).toHaveLength(7);
  });
});
