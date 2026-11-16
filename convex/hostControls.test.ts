/// <reference types="vite/client" />
import presenceTest from '@convex-dev/presence/test';
import rateLimiterTest from '@convex-dev/rate-limiter/test';
import { convexTest } from 'convex-test';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { api } from './_generated/api';
import schema from './schema';

const modules = import.meta.glob('./**/*.ts');
const HOST = 'host-device';
const PLAYERS = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'];

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('fetch', vi.fn(async () => new Response('not found', { status: 404 })));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function newTest() {
  const t = convexTest(schema, modules);
  presenceTest.register(t);
  rateLimiterTest.register(t);
  return t;
}
type T = ReturnType<typeof newTest>;

async function errorCode(p: Promise<unknown>) {
  try {
    await p;
  } catch (e) {
    return (e as { data?: { code?: string } }).data?.code;
  }
  throw new Error('expected the call to fail');
}

// A hosted drop with six entrants, dealt into two squads of three.
async function liveDrop(t: T, opts: { winnerSlots?: number; totalCents?: number; payoutMode?: 'real' | 'concept' } = {}) {
  const { dropId } = await t.mutation(api.drops.hostDrop, { deviceToken: HOST, creatorName: 'Danny Ortiz', winnerSlots: opts.winnerSlots ?? 1, totalCents: opts.totalCents ?? 300, ...(opts.payoutMode ? { payoutMode: opts.payoutMode } : {}) });
  for (const [i, deviceToken] of PLAYERS.entries()) await t.mutation(api.drops.enterDrop, { deviceToken, dropId, name: 'Player ' + i });
  await t.mutation(api.drops.dealSquads, { deviceToken: HOST, dropId });
  const view = (await t.query(api.drops.hostView, { deviceToken: HOST, dropId }))!;
  return { dropId, squadIds: view.squads.map((s) => s.squadId!) };
}

const dropOf = (t: T, dropId: string) => t.query(api.drops.drop, { deviceToken: 'x', dropId });
const awards = (t: T) => t.run((ctx) => ctx.db.query('bountyAwards').collect());

describe('host backup controls', () => {
  test('only the host can end or award, and only once the race is live', async () => {
    const t = newTest();
    const { dropId: waiting } = await t.mutation(api.drops.hostDrop, { deviceToken: HOST, creatorName: 'Danny Ortiz' });
    expect(await errorCode(t.mutation(api.drops.hostEndDrop, { deviceToken: HOST, dropId: waiting }))).toBe('DROP_NOT_LIVE');
    const { dropId, squadIds } = await liveDrop(t);
    expect(await errorCode(t.mutation(api.drops.hostEndDrop, { deviceToken: 'p1', dropId }))).toBe('NOT_HOST');
    expect(await errorCode(t.mutation(api.drops.hostAwardSquads, { deviceToken: 'p1', dropId, squadIds: [squadIds[0]] }))).toBe('NOT_HOST');
    expect(await errorCode(t.mutation(api.drops.hostAwardSquads, { deviceToken: HOST, dropId, squadIds: ['nope'] }))).toBe('UNKNOWN_SQUAD');
    expect(await errorCode(t.mutation(api.drops.hostAwardSquads, { deviceToken: HOST, dropId, squadIds }))).toBe('TOO_MANY_WINNERS');
    expect((await dropOf(t, dropId))!.status).toBe('live');
  });

  test('ending with no winners leaves every squad unsolved, and a second call is a no-op', async () => {
    const t = newTest();
    const { dropId } = await liveDrop(t);
    for (let i = 0; i < 2; i++) await t.mutation(api.drops.hostEndDrop, { deviceToken: HOST, dropId });
    expect((await dropOf(t, dropId))!.status).toBe('ended');
    expect(await awards(t)).toHaveLength(0);
    const view = (await t.query(api.drops.hostView, { deviceToken: HOST, dropId }))!;
    expect(view.squads.map((s) => s.status)).toEqual(['solving', 'solving']);
  });

  test('awards squads in the given order through the normal award path, then ends; twice is a no-op', async () => {
    const t = newTest();
    const { dropId, squadIds } = await liveDrop(t, { winnerSlots: 2, totalCents: 600 });
    const order = [squadIds[1], squadIds[0]];
    for (let i = 0; i < 2; i++) await t.mutation(api.drops.hostAwardSquads, { deviceToken: HOST, dropId, squadIds: order });
    expect((await dropOf(t, dropId))!.status).toBe('ended');
    const byPlace = (await awards(t)).sort((a, b) => a.place - b.place);
    expect(byPlace.map((a) => [a.roomId, a.place, a.perPlayerCents, a.mode])).toEqual([
      [order[0], 1, 100, 'concept'],
      [order[1], 2, 100, 'concept'],
    ]);
  });

  test('a real-money manual award pays by transfer at $1 a player, and falls back to concept under $1', async () => {
    vi.stubEnv('SIGNAL_REAL_PAYOUTS', 'on');
    vi.stubEnv('SIGNAL_REAL_PAYOUT_BUDGET_CENTS', '10000');
    const t = newTest();
    const real = await liveDrop(t, { totalCents: 300, payoutMode: 'real' });
    await t.mutation(api.drops.hostAwardSquads, { deviceToken: HOST, dropId: real.dropId, squadIds: [real.squadIds[0]] });
    const small = await liveDrop(t, { totalCents: 150 });
    await t.mutation(api.drops.hostAwardSquads, { deviceToken: HOST, dropId: small.dropId, squadIds: [small.squadIds[0]] });
    const modes = Object.fromEntries((await awards(t)).map((a) => [a.dropId, [a.mode, a.perPlayerCents]]));
    expect(modes[real.dropId]).toEqual(['transfer', 100]);
    expect(modes[small.dropId]).toEqual(['concept', 50]);
  });

  test('a squad that solved normally keeps its award when the host ends the drop', async () => {
    const t = newTest();
    const { dropId, squadIds } = await liveDrop(t, { winnerSlots: 2, totalCents: 600 });
    const room = (await t.run((ctx) => ctx.db.get(squadIds[0] as never)))! as { code: string };
    const members = (await t.run((ctx) => ctx.db.query('members').collect())).filter((m) => m.roomId === (squadIds[0] as never));
    for (const m of members) await t.mutation(api.signal.setPresence, { deviceToken: m.deviceToken, code: room.code, presence: 'ready' });
    const { revision } = await t.mutation(api.signal.setTheory, { deviceToken: members[0].deviceToken, code: room.code, culprit: 'jun' });
    for (const m of members) await t.mutation(api.signal.lockIn, { deviceToken: m.deviceToken, code: room.code, revision });
    expect(await errorCode(t.mutation(api.drops.hostAwardSquads, { deviceToken: HOST, dropId, squadIds: [squadIds[0]] }))).toBe('UNKNOWN_SQUAD');
    await t.mutation(api.drops.hostEndDrop, { deviceToken: HOST, dropId });
    expect((await awards(t)).map((a) => [a.roomId, a.place])).toEqual([[squadIds[0], 1]]);
    expect((await dropOf(t, dropId))!.status).toBe('ended');
  });
});
