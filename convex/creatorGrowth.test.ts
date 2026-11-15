/// <reference types="vite/client" />
import presenceTest from '@convex-dev/presence/test';
import rateLimiterTest from '@convex-dev/rate-limiter/test';
import { convexTest } from 'convex-test';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { api } from './_generated/api';
import schema from './schema';
import type { ChallengeConfigPatch } from '../src/lib/contract';

const modules = import.meta.glob('./**/*.ts');
const HOST = 'host-device-secret';

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
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const tokens = (n: number, prefix: string) => Array.from({ length: n }, (_, i) => prefix + '-device-secret-' + (i + 1));

async function published(t: T, patch: ChallengeConfigPatch) {
  await t.mutation(api.challenges.saveCreatorProfile, { deviceToken: HOST, displayName: 'Nova', handle: 'nova' });
  const { challengeId } = await t.mutation(api.challenges.createChallenge, { deviceToken: HOST, patch: { title: 'Friday race', poolCents: 10_000, ...patch } });
  const { joinCode } = await t.mutation(api.challenges.publishChallenge, { deviceToken: HOST, challengeId });
  return { challengeId, joinCode };
}

async function join(t: T, joinCode: string, players: string[]) {
  for (const [i, deviceToken] of players.entries()) await t.action(api.challenges.joinChallenge, { deviceToken, code: joinCode, name: 'Player ' + (i + 1) });
}

async function teamsOf(t: T, challengeId: string, players: string[]) {
  const teams = new Map<string, string[]>();
  for (const deviceToken of players) {
    const code = (await t.query(api.challenges.myChallenge, { deviceToken, challengeId }))?.me.team?.roomCode;
    if (code) teams.set(code, [...(teams.get(code) ?? []), deviceToken]);
  }
  return [...teams.entries()].map(([code, members]) => ({ code, members }));
}

async function solve(t: T, code: string, members: string[]) {
  for (const deviceToken of members) await t.mutation(api.signal.setPresence, { deviceToken, code, presence: 'ready' });
  const { revision } = await t.mutation(api.signal.setTheory, { deviceToken: members[0], code, culprit: 'jun' });
  for (const deviceToken of members) await t.mutation(api.signal.lockIn, { deviceToken, code, revision });
}

const linkWhop = (t: T, deviceToken: string, whopUserId: string) =>
  t.run((ctx) => ctx.db.insert('identities', { deviceToken, whopUserId, name: 'Whop', environment: 'sandbox', linkedAt: Date.now() }));

// A dealt challenge: 7 players deal into 3 + 2 + 2; teams 1 and 2 finish, team 3 is mid-theory when the host ends.
// Placement 50/30/20 on $100: place 1 gets 1668 + 1665 + 1665, place 2 gets 1500 + 1500, place 3 returns.
// Player 1 has Whop linked before approval (paid at once), player 4 signs in and claims, the rest never claim.
async function seeded() {
  const t = newTest();
  const players = tokens(7, 'race');
  const { challengeId, joinCode } = await published(t, {});
  await join(t, joinCode, players);
  await t.mutation(api.challenges.dealTeams, { deviceToken: HOST, challengeId });
  const teams = await teamsOf(t, challengeId, players);
  await solve(t, teams[0].code, teams[0].members);
  await solve(t, teams[1].code, teams[1].members);
  for (const deviceToken of teams[2].members) await t.mutation(api.signal.setPresence, { deviceToken, code: teams[2].code, presence: 'ready' });
  await t.mutation(api.signal.setTheory, { deviceToken: teams[2].members[0], code: teams[2].code, culprit: 'theo' });
  await t.mutation(api.challenges.endChallenge, { deviceToken: HOST, challengeId });
  await linkWhop(t, players[0], 'whop-user-alpha');
  await t.mutation(api.challenges.approvePayouts, { deviceToken: HOST, challengeId });
  await linkWhop(t, players[3], 'whop-user-bravo');
  await t.mutation(api.challenges.claimPayout, { deviceToken: players[3], challengeId });
  return { t, challengeId, players, teams };
}

describe('challenge growth recap', () => {
  test('counts match the seeded challenge exactly', async () => {
    const { t, challengeId, teams } = await seeded();
    expect(teams.map((x) => x.members.length)).toEqual([3, 2, 2]);
    const recap = await t.query(api.creatorGrowth.challengeGrowth, { deviceToken: HOST, challengeId });
    expect(recap).toMatchObject({
      challengeId,
      title: 'Friday race',
      status: 'ended',
      players: 7,
      completions: 5,
      winners: 5,
      paidCents: 1668 + 1500,
      payoutAdapter: 'concept',
      newWhopMembers: 2,
    });
  });

  test('only the creator reads it, and drafts have none', async () => {
    const { t, challengeId, players } = await seeded();
    expect(await t.query(api.creatorGrowth.challengeGrowth, { deviceToken: players[0], challengeId })).toBeNull();
    expect(await t.query(api.creatorGrowth.challengeGrowth, { deviceToken: HOST, challengeId: 'not-an-id' })).toBeNull();
    const draft = await t.mutation(api.challenges.createChallenge, { deviceToken: HOST, patch: { title: 'Draft' } });
    expect(await t.query(api.creatorGrowth.challengeGrowth, { deviceToken: HOST, challengeId: draft.challengeId })).toBeNull();
  });

  test('nothing private leaks: no device tokens, Whop ids, names, room codes or unresolved answers', async () => {
    const { t, challengeId, players, teams } = await seeded();
    const recap = (await t.query(api.creatorGrowth.challengeGrowth, { deviceToken: HOST, challengeId }))!;
    expect(Object.keys(recap).sort()).toEqual(
      ['challengeId', 'completions', 'createdAt', 'endedAt', 'newWhopMembers', 'paidCents', 'payoutAdapter', 'players', 'status', 'templateId', 'title', 'winners'].sort(),
    );
    const stats = (await t.query(api.creatorGrowth.creatorStats, { deviceToken: HOST }))!;
    for (const json of [JSON.stringify(recap), JSON.stringify(stats)]) {
      for (const secret of [HOST, ...players, ...teams.map((x) => x.code), 'whop-user-alpha', 'whop-user-bravo', 'Player 1', 'device-secret', 'theo', 'jun']) {
        expect(json).not.toContain(secret);
      }
    }
  });
});

describe('creator history', () => {
  test('lists published challenges newest first with totals; Whop members are distinct across challenges', async () => {
    const { t, challengeId } = await seeded();
    vi.advanceTimersByTime(60_000);
    const members = tokens(2, 'club');
    vi.stubEnv('WHOP_OAUTH_CLIENT_ID', 'client');
    vi.stubEnv('WHOP_API_KEY', 'test-key');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ has_access: true, access_level: 'customer' }))));
    const second = await published(t, { title: 'Members night', eligibility: { kind: 'whop_members', productId: 'prod_1' } });
    await linkWhop(t, members[0], 'whop-user-alpha');
    await linkWhop(t, members[1], 'whop-user-charlie');
    await join(t, second.joinCode, members);
    await t.mutation(api.challenges.endChallenge, { deviceToken: HOST, challengeId: second.challengeId });
    await t.mutation(api.challenges.createChallenge, { deviceToken: HOST, patch: { title: 'Still a draft' } });

    const stats = (await t.query(api.creatorGrowth.creatorStats, { deviceToken: HOST }))!;
    expect(stats.challenges.map((c) => [c.title, c.players, c.completions, c.winners, c.paidCents, c.newWhopMembers])).toEqual([
      ['Members night', 2, 0, 0, 0, 2],
      ['Friday race', 7, 5, 5, 3168, 2],
    ]);
    expect(stats.challenges[1].challengeId).toBe(challengeId);
    expect(stats.totals).toEqual({ challenges: 2, players: 9, completions: 5, winners: 5, paidCents: 3168, newWhopMembers: 3 });
  });

  test('a cancelled challenge counts players but no winners', async () => {
    const t = newTest();
    const players = tokens(3, 'late');
    const { challengeId, joinCode } = await published(t, {});
    await join(t, joinCode, players);
    await t.mutation(api.challenges.cancelChallenge, { deviceToken: HOST, challengeId, reason: 'Stream dropped' });
    const recap = await t.query(api.creatorGrowth.challengeGrowth, { deviceToken: HOST, challengeId });
    expect(recap).toMatchObject({ status: 'cancelled', players: 3, completions: 0, winners: 0, paidCents: 0, newWhopMembers: 0 });
  });

  test('no profile, no stats', async () => {
    const t = newTest();
    expect(await t.query(api.creatorGrowth.creatorStats, { deviceToken: 'stranger' })).toBeNull();
  });
});
