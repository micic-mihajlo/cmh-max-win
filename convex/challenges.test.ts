/// <reference types="vite/client" />
import presenceTest from '@convex-dev/presence/test';
import rateLimiterTest from '@convex-dev/rate-limiter/test';
import { convexTest } from 'convex-test';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { api, internal } from './_generated/api';
import { DEFAULT_CONFIG, computePreview, leftoverSizes, validateConfig } from './challenges';
import { dealPieces } from './drops';
import schema from './schema';
import { mixerTemplate } from './templates/engine';
import type { ChallengeConfigPatch } from '../src/lib/contract';

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

async function errorCode(p: Promise<unknown>) {
  try {
    await p;
  } catch (e) {
    return (e as { data?: { code?: string } }).data?.code;
  }
  throw new Error('expected the call to fail');
}

const tokens = (n: number, prefix = 'p') => Array.from({ length: n }, (_, i) => prefix + (i + 1));

async function published(patch: ChallengeConfigPatch = {}, t: T = newTest()) {
  await t.mutation(api.challenges.saveCreatorProfile, { deviceToken: HOST, displayName: 'Nova', handle: '@Nova' });
  const { challengeId } = await t.mutation(api.challenges.createChallenge, { deviceToken: HOST, patch: { title: 'Friday race', poolCents: 10_000, ...patch } });
  const { joinCode } = await t.mutation(api.challenges.publishChallenge, { deviceToken: HOST, challengeId });
  return { t, challengeId, joinCode };
}

async function join(t: T, joinCode: string, players: string[]) {
  for (const deviceToken of players) await t.action(api.challenges.joinChallenge, { deviceToken, code: joinCode, name: deviceToken.toUpperCase() });
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
  t.run((ctx) => ctx.db.insert('identities', { deviceToken, whopUserId, name: whopUserId, environment: 'sandbox', linkedAt: Date.now() }));

describe('payout math', () => {
  const finishers = (sizes: number[]) => sizes.map((n, i) => ({ place: i + 1, teamLabel: 'Team ' + (i + 1), players: tokens(n) }));
  const total = (p: ReturnType<typeof computePreview>) => p.lines.flatMap((l) => l.players).reduce((s, x) => s + x.cents, 0);

  test('winner takes all: per-player floor, leftover cents to the first player', () => {
    const p = computePreview(10_000, { kind: 'winner_takes_all' }, finishers([3, 3]));
    expect(p.lines.map((l) => l.players.map((x) => x.cents))).toEqual([[3334, 3333, 3333]]);
    expect([p.paidCents, p.returnedCents, total(p)]).toEqual([10_000, 0, 10_000]);
  });

  test('top 3 equal: budgets floor(pool / 3), every leftover cent to first place', () => {
    const p = computePreview(10_001, { kind: 'top_x_equal', places: 3 }, finishers([2, 3, 4]));
    expect(p.lines.map((l) => l.budgetCents)).toEqual([3333, 3333, 3333]);
    expect(p.lines.map((l) => l.players.map((x) => x.cents))).toEqual([[1670, 1666], [1111, 1111, 1111], [833, 833, 833, 833]]);
    expect(p.paidCents + p.returnedCents).toBe(10_001);
    expect(total(p)).toBe(10_001);
  });

  test('placement 50/30/20 over trios', () => {
    const p = computePreview(10_000, { kind: 'placement', percents: [50, 30, 20] }, finishers([3, 3, 3]));
    expect(p.lines.map((l) => l.players.map((x) => x.cents))).toEqual([[1670, 1666, 1666], [1000, 1000, 1000], [666, 666, 666]]);
    expect(total(p)).toBe(10_000);
  });

  test('unfilled places return to the creator; nobody finishing returns the whole pool', () => {
    const p = computePreview(10_000, { kind: 'placement', percents: [50, 30, 20] }, finishers([1]));
    expect(p.lines.map((l) => l.players.map((x) => x.cents))).toEqual([[5000]]);
    expect(p.returned).toEqual({ unfilledPlacesCents: 5000, expiredCents: 0 });
    const none = computePreview(999, { kind: 'top_x_equal', places: 2 }, []);
    expect([none.paidCents, none.returnedCents]).toEqual([0, 999]);
  });
});

describe('team sizes 1 to 4', () => {
  test('dealing: 2 and 3 unchanged, solo holds every piece, a four gives everyone a piece', () => {
    expect(dealPieces('x', 0, 3).map((h) => h.length)).toEqual([1, 1, 1]);
    expect(dealPieces('x', 0, 2).map((h) => h.length)).toEqual([2, 1]);
    expect(dealPieces('x', 0, 1)[0].sort()).toEqual(['detective', 'hacker', 'witness']);
    const four = dealPieces('x', 0, 4);
    expect(four).toHaveLength(4);
    expect(new Set(four.flat())).toEqual(new Set(['detective', 'hacker', 'witness']));
  });

  test('leftover split for solo and fours', () => {
    expect(leftoverSizes(3, 1)).toEqual([1, 1, 1]);
    expect(leftoverSizes(9, 4)).toEqual([4, 3, 2]);
    expect(leftoverSizes(10, 4)).toEqual([4, 4, 2]);
    expect(leftoverSizes(11, 4)).toEqual([4, 4, 3]);
    expect(leftoverSizes(3, 4)).toEqual([3]);
    expect(leftoverSizes(7, 3)).toEqual([3, 2, 2]);
  });

  test('team sizes outside 1 to 4 are refused by the validator and by publish checks', async () => {
    const t = newTest();
    await t.mutation(api.challenges.saveCreatorProfile, { deviceToken: HOST, displayName: 'Nova', handle: 'nova' });
    const { challengeId } = await t.mutation(api.challenges.createChallenge, { deviceToken: HOST, patch: { title: 'x' } });
    const patch = { teamSize: 5 } as unknown as ChallengeConfigPatch;
    await expect(t.mutation(api.challenges.updateChallengeDraft, { deviceToken: HOST, challengeId, patch })).rejects.toThrow();
    for (const teamSize of [0, 5, 6]) {
      const issues = validateConfig({ ...DEFAULT_CONFIG, title: 'x', teamSize } as never, false, Date.now());
      expect(issues.map((i) => i.field)).toEqual(['teamSize']);
    }
  });

  test('a solo team and a team of four play to a placement', async () => {
    for (const teamSize of [1, 4] as const) {
      const { t, challengeId, joinCode } = await published({ teamSize, reward: { kind: 'winner_takes_all' } });
      await join(t, joinCode, tokens(teamSize * 2));
      await t.mutation(api.challenges.dealTeams, { deviceToken: HOST, challengeId });
      const teams = await teamsOf(t, challengeId, tokens(teamSize * 2));
      expect(teams.map((x) => x.members.length)).toEqual([teamSize, teamSize]);
      await solve(t, teams[1].code, teams[1].members);
      const view = (await t.query(api.challenges.hostConsole, { deviceToken: HOST, challengeId }))!;
      expect(view.status).toBe('ended');
      expect(view.results.map((r) => r.memberNames.length)).toEqual([teamSize]);
    }
  });
});

describe('drafts, publish and host-only actions', () => {
  test('a profile is required, publish validates, freezes and records concept funding', async () => {
    const t = newTest();
    expect(await errorCode(t.mutation(api.challenges.createChallenge, { deviceToken: HOST }))).toBe('NO_PROFILE');
    await t.mutation(api.challenges.saveCreatorProfile, { deviceToken: HOST, displayName: 'Nova', handle: 'nova' });
    expect(await errorCode(t.mutation(api.challenges.saveCreatorProfile, { deviceToken: 'other', displayName: 'X', handle: 'NOVA' }))).toBe('HANDLE_TAKEN');
    const { challengeId } = await t.mutation(api.challenges.createChallenge, { deviceToken: HOST });
    const draft = (await t.query(api.challenges.challengeDraft, { deviceToken: HOST, challengeId }))!;
    expect(draft.config.reward).toEqual({ kind: 'placement', percents: [50, 30, 20] });
    expect(draft.config.teamFormation).toBe('dealt');
    expect(draft.issues.map((i) => i.field)).toEqual(['title']);
    expect(await errorCode(t.mutation(api.challenges.publishChallenge, { deviceToken: HOST, challengeId }))).toBe('INVALID_CONFIG');
    const { issues } = await t.mutation(api.challenges.updateChallengeDraft, {
      deviceToken: HOST,
      challengeId,
      patch: { title: 'Race', reward: { kind: 'placement', percents: [60, 30] } },
    });
    expect(issues.map((i) => i.field)).toEqual(['reward']);
    await t.mutation(api.challenges.updateChallengeDraft, { deviceToken: HOST, challengeId, patch: { reward: { kind: 'placement', percents: [60, 40] }, poolCents: 5000 } });
    const { joinCode } = await t.mutation(api.challenges.publishChallenge, { deviceToken: HOST, challengeId });
    expect(joinCode).toMatch(/^[A-Z2-9]{4}$/);
    expect(await errorCode(t.mutation(api.challenges.updateChallengeDraft, { deviceToken: HOST, challengeId, patch: { poolCents: 1 } }))).toBe('CHALLENGE_CLOSED');
    const view = (await t.query(api.challenges.hostConsole, { deviceToken: HOST, challengeId }))!;
    expect(view.funding).toMatchObject({ status: 'committed_concept', amountCents: 5000 });
  });

  test('only the creator reads the console or runs host actions', async () => {
    const { t, challengeId, joinCode } = await published();
    await join(t, joinCode, tokens(3));
    expect(await t.query(api.challenges.hostConsole, { deviceToken: 'p1', challengeId })).toBeNull();
    expect(await t.query(api.challenges.challengeDraft, { deviceToken: 'p1', challengeId })).toBeNull();
    for (const call of [
      t.mutation(api.challenges.dealTeams, { deviceToken: 'p1', challengeId }),
      t.mutation(api.challenges.endChallenge, { deviceToken: 'p1', challengeId }),
      t.mutation(api.challenges.cancelChallenge, { deviceToken: 'p1', challengeId, reason: 'x' }),
      t.mutation(api.challenges.approvePayouts, { deviceToken: 'p1', challengeId }),
      t.mutation(api.challenges.cloneChallenge, { deviceToken: 'p1', challengeId }),
    ]) {
      expect(await errorCode(call)).toBe('NOT_CREATOR');
    }
  });

  test('clone makes a fresh draft with the same config', async () => {
    const { t, challengeId } = await published({ poolCents: 777 });
    const copy = await t.mutation(api.challenges.cloneChallenge, { deviceToken: HOST, challengeId });
    const draft = (await t.query(api.challenges.challengeDraft, { deviceToken: HOST, challengeId: copy.challengeId }))!;
    expect(draft).toMatchObject({ status: 'draft', joinCode: null, entrantCount: 0, config: { poolCents: 777, title: 'Friday race' } });
  });
});

describe('start modes', () => {
  test('live: the host deals, refused below one team', async () => {
    const { t, challengeId, joinCode } = await published({ leftover: 'wait_next_round' });
    await join(t, joinCode, tokens(2));
    expect(await errorCode(t.mutation(api.challenges.dealTeams, { deviceToken: HOST, challengeId }))).toBe('NOT_ENOUGH_PLAYERS');
    await join(t, joinCode, ['p3', 'p4']);
    await t.mutation(api.challenges.dealTeams, { deviceToken: HOST, challengeId });
    const view = (await t.query(api.challenges.hostConsole, { deviceToken: HOST, challengeId }))!;
    expect(view.status).toBe('live');
    expect(view.teams.map((x) => x.memberNames)).toEqual([['P1', 'P2', 'P3']]);
    expect(view.entrants.find((e) => e.name === 'P4')?.waitingNextRound).toBe(true);
    expect(await errorCode(t.action(api.challenges.joinChallenge, { deviceToken: 'late', code: joinCode, name: 'Late' }))).toBe('CHALLENGE_CLOSED');
  });

  test('scheduled: teams are dealt at startsAt', async () => {
    const { t, challengeId, joinCode } = await published({ startMode: 'scheduled', startsAt: Date.now() + 5 * MIN });
    await join(t, joinCode, tokens(5));
    expect((await t.query(api.challenges.hostConsole, { deviceToken: HOST, challengeId }))!.timeLeftMs).toBeGreaterThan(5 * MIN - 100);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const view = (await t.query(api.challenges.hostConsole, { deviceToken: HOST, challengeId }))!;
    expect(view.status).toBe('live');
    expect(view.teams.map((x) => x.memberNames.length)).toEqual([3, 2]);
  });

  test('window: a team forms each time a team-size group is waiting, and the window closing ends it', async () => {
    const { t, challengeId, joinCode } = await published({ startMode: 'window', endsAt: Date.now() + 10 * MIN, teamSize: 2 });
    await join(t, joinCode, ['p1']);
    expect((await t.query(api.challenges.hostConsole, { deviceToken: HOST, challengeId }))!.teams).toHaveLength(0);
    await join(t, joinCode, ['p2', 'p3']);
    let view = (await t.query(api.challenges.hostConsole, { deviceToken: HOST, challengeId }))!;
    expect([view.status, view.teams.length]).toEqual(['live', 1]);
    await join(t, joinCode, ['p4']);
    view = (await t.query(api.challenges.hostConsole, { deviceToken: HOST, challengeId }))!;
    expect(view.teams.map((x) => x.memberNames)).toEqual([['P1', 'P2'], ['P3', 'P4']]);
    await join(t, joinCode, ['p5']);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    view = (await t.query(api.challenges.hostConsole, { deviceToken: HOST, challengeId }))!;
    expect(view.status).toBe('ended');
    expect(view.entrants.find((e) => e.name === 'P5')?.waitingNextRound).toBe(true);
  });
});

describe('cancel', () => {
  test('entrants see the reason, nobody can join, and lock-ins stop', async () => {
    const { t, challengeId, joinCode } = await published();
    await join(t, joinCode, tokens(3));
    await t.mutation(api.challenges.dealTeams, { deviceToken: HOST, challengeId });
    const [team] = await teamsOf(t, challengeId, tokens(3));
    expect(await errorCode(t.mutation(api.challenges.cancelChallenge, { deviceToken: HOST, challengeId, reason: ' ' }))).toBe('INVALID_CONFIG');
    await t.mutation(api.challenges.cancelChallenge, { deviceToken: HOST, challengeId, reason: 'Stream went down' });
    expect((await t.query(api.challenges.myChallenge, { deviceToken: 'p1', challengeId }))!.cancelled).toEqual({ reason: 'Stream went down', at: expect.any(Number) });
    expect(await errorCode(t.action(api.challenges.joinChallenge, { deviceToken: 'new', code: joinCode, name: 'N' }))).toBe('CHALLENGE_CANCELLED');
    expect(await errorCode(solve(t, team.code, team.members))).toBe('CHALLENGE_CLOSED');
    expect((await t.query(api.challenges.challengeRecap, { challengeId }))!).toMatchObject({ status: 'cancelled', paidCents: 0, podium: [] });
  });
});

describe('payout ledger and claiming', () => {
  async function ended() {
    const { t, challengeId, joinCode } = await published({ poolCents: 9000, reward: { kind: 'placement', percents: [50, 30, 20] } });
    await join(t, joinCode, tokens(6));
    await t.mutation(api.challenges.dealTeams, { deviceToken: HOST, challengeId });
    const teams = await teamsOf(t, challengeId, tokens(6));
    await solve(t, teams[1].code, teams[1].members);
    await solve(t, teams[0].code, teams[0].members);
    return { t, challengeId, teams };
  }

  test('approval is idempotent; linked winners are paid, others wait for Whop sign-in on their own device', async () => {
    const { t, challengeId, teams } = await ended();
    await linkWhop(t, teams[1].members[0], 'whop_a');
    expect(await errorCode(t.mutation(api.challenges.approvePayouts, { deviceToken: 'p1', challengeId }))).toBe('NOT_CREATOR');
    expect(await t.mutation(api.challenges.approvePayouts, { deviceToken: HOST, challengeId })).toEqual({ approved: 6, alreadyApproved: 0 });
    expect(await t.mutation(api.challenges.approvePayouts, { deviceToken: HOST, challengeId })).toEqual({ approved: 0, alreadyApproved: 6 });
    const view = (await t.query(api.challenges.hostConsole, { deviceToken: HOST, challengeId }))!;
    expect(view.payouts).toHaveLength(6);
    expect(view.payouts.filter((r) => r.status === 'sent_concept')).toHaveLength(1);
    expect(view.payoutPreview!.paidCents + view.payoutPreview!.returnedCents).toBe(9000);

    const winner = teams[1].members[1];
    expect(await t.query(api.challenges.myPayout, { deviceToken: winner, challengeId })).toMatchObject({ status: 'claim_pending_whop', needsWhopSignIn: true, place: 1 });
    expect(await errorCode(t.mutation(api.challenges.claimPayout, { deviceToken: winner, challengeId }))).toBe('WHOP_SIGN_IN_REQUIRED');
    expect(await errorCode(t.mutation(api.challenges.claimPayout, { deviceToken: 'stranger', challengeId }))).toBe('NOT_ENTERED');
    await linkWhop(t, winner, 'whop_a');
    expect(await t.mutation(api.challenges.claimPayout, { deviceToken: winner, challengeId })).toMatchObject({ status: 'sent_concept', method: 'concept' });
    expect(await t.mutation(api.challenges.claimPayout, { deviceToken: winner, challengeId })).toMatchObject({ status: 'sent_concept' });
  });

  test('unclaimed shares expire after the claim window and return to the pool', async () => {
    const { t, challengeId } = await ended();
    await t.mutation(api.challenges.approvePayouts, { deviceToken: HOST, challengeId });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const view = (await t.query(api.challenges.hostConsole, { deviceToken: HOST, challengeId }))!;
    expect(view.payouts.every((r) => r.status === 'expired')).toBe(true);
    expect(view.payoutPreview).toMatchObject({ paidCents: 0, returnedCents: 9000, returned: { expiredCents: 7200, unfilledPlacesCents: 1800 } });
    expect(await errorCode(t.mutation(api.challenges.claimPayout, { deviceToken: 'p1', challengeId }))).toBe('CLAIM_EXPIRED');
  });
});

describe('eligibility', () => {
  test('with Whop OAuth configured, joining asks Whop for access to the product', async () => {
    vi.stubEnv('WHOP_OAUTH_CLIENT_ID', 'client');
    vi.stubEnv('WHOP_API_KEY', 'test-key');
    const fetchMock = vi.fn(async (url: string) => new Response(JSON.stringify({ has_access: url.includes('whop_member'), access_level: 'customer' })));
    vi.stubGlobal('fetch', fetchMock);
    try {
      const { t, joinCode } = await published({ eligibility: { kind: 'whop_members', productId: 'prod_123' } });
      expect((await t.query(api.challenges.challengeByCode, { deviceToken: 'p1', code: joinCode }))!.eligibility).toMatchObject({ enforced: true, note: null });
      await linkWhop(t, 'p1', 'whop_outsider');
      await linkWhop(t, 'p2', 'whop_member');
      expect(await errorCode(t.action(api.challenges.joinChallenge, { deviceToken: 'p3', code: joinCode, name: 'P3' }))).toBe('WHOP_SIGN_IN_REQUIRED');
      expect(await errorCode(t.action(api.challenges.joinChallenge, { deviceToken: 'p1', code: joinCode, name: 'P1' }))).toBe('NOT_ELIGIBLE');
      expect(await t.action(api.challenges.joinChallenge, { deviceToken: 'p2', code: joinCode, name: 'P2' })).toHaveProperty('challengeId');
      expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
        expect.stringContaining('/users/whop_outsider/access/prod_123'),
        expect.stringContaining('/users/whop_member/access/prod_123'),
      ]);
    } finally {
      vi.unstubAllEnvs();
      vi.unstubAllGlobals();
    }
  });

  test('without Whop OAuth, a whop_members challenge cannot be published', async () => {
    const t = newTest();
    await t.mutation(api.challenges.saveCreatorProfile, { deviceToken: HOST, displayName: 'Nova', handle: 'nova' });
    const { challengeId } = await t.mutation(api.challenges.createChallenge, {
      deviceToken: HOST,
      patch: { title: 'Members only', eligibility: { kind: 'whop_members', productId: 'prod_123' } },
    });
    expect((await t.query(api.challenges.challengeDraft, { deviceToken: HOST, challengeId }))!.config.requireWhopToJoin).toBe(true);
    expect(await errorCode(t.mutation(api.challenges.publishChallenge, { deviceToken: HOST, challengeId }))).toBe('WHOP_NOT_CONFIGURED');
  });
});

describe('mixer mode', () => {
  test('mixer needs a template with mixer support, and dealt teams play Aurora', () => {
    const issues = (patch: ChallengeConfigPatch) => validateConfig({ ...DEFAULT_CONFIG, title: 'x', ...patch } as never, false, Date.now()).map((i) => i.field);
    expect(issues({ teamFormation: 'mixer' })).toEqual(['templateId']);
    expect(issues({ teamFormation: 'mixer', templateId: 'split-passphrase' })).toEqual([]);
    expect(issues({ templateId: 'split-passphrase' })).toEqual(['templateId']);
  });

  const colorsOf = async (t: T, challengeId: string, players: string[]) =>
    Promise.all(players.map(async (deviceToken) => (await t.query(api.challenges.myChallenge, { deviceToken, challengeId }))!.me.mixer!));
  const keyOf = (text: string) => text.match(/Your word is ([A-Za-z]+-\d+)/)![1];

  async function mixer() {
    const { t, challengeId, joinCode } = await published({ teamFormation: 'mixer', templateId: 'split-passphrase', mixerColors: ['red', 'blue'], reward: { kind: 'placement', percents: [60, 40] } });
    await join(t, joinCode, tokens(6));
    const me = await colorsOf(t, challengeId, tokens(6));
    return { t, challengeId, me };
  }
  const link = (t: T, challengeId: string, deviceToken: string, playerCode: string) =>
    t.mutation(api.challenges.linkPlayer, { deviceToken, challengeId, playerCode });

  test('a fragment secret cannot be recomputed from the challenge id and join index', async () => {
    // Secrets come from a small word-and-number space, so a guessed seed can land on the same secret by chance.
    // What must hold is that the seed itself carries a server nonce no client can derive.
    const { t, challengeId, me } = await mixer();
    const engine = mixerTemplate('split-passphrase');
    const entries = await t.run((ctx) => ctx.db.query('challengeEntries').collect());
    for (const [i, m] of me.entries()) {
      const seed = entries.find((e) => e.deviceToken === 'p' + (i + 1))!.fragmentSeed!;
      expect(seed).toMatch(new RegExp('^' + challengeId + ':' + i + ':\\d+:[0-9a-f]{32}$'));
      expect(engine.fragment(seed, m.color, i).secret).toBe(keyOf(m.fragment.text));
      const guesses = [challengeId + ':' + i, challengeId + ':p' + (i + 1), ...Array.from({ length: 20 }, (_, salt) => challengeId + ':' + i + ':' + salt)];
      expect(guesses).not.toContain(seed);
    }
    expect(new Set(entries.map((e) => e.fragmentSeed!.split(':')[3])).size).toBe(entries.length);
  });

  test('colors are balanced round-robin, fragments and codes are unique', async () => {
    const { me } = await mixer();
    expect(me.map((m) => m.color)).toEqual(['red', 'blue', 'red', 'blue', 'red', 'blue']);
    expect(new Set(me.map((m) => m.playerCode)).size).toBe(6);
    expect(new Set(me.map((m) => keyOf(m.fragment.text))).size).toBe(6);
  });

  test('a duplicate color is refused and a player sits in one team at a time', async () => {
    const { t, challengeId, me } = await mixer();
    expect(await errorCode(link(t, challengeId, 'p1', me[2].playerCode))).toBe('DUPLICATE_COLOR');
    const team = await link(t, challengeId, 'p1', me[1].playerCode);
    expect(team).toMatchObject({ status: 'forming', missingColors: [] });
    await link(t, challengeId, 'p3', me[3].playerCode);
    expect(await errorCode(link(t, challengeId, 'p3', me[1].playerCode))).toBe('ALREADY_IN_TEAM');
    expect(await errorCode(link(t, challengeId, 'p5', me[1].playerCode))).toBe('DUPLICATE_COLOR');
    await t.mutation(api.challenges.leaveMixerTeam, { deviceToken: 'p2', challengeId });
    expect((await colorsOf(t, challengeId, ['p1']))[0].team).toBeNull();
    expect(await link(t, challengeId, 'p5', me[1].playerCode)).toMatchObject({ members: [{ name: 'P5' }, { name: 'P2' }] });
  });

  test('a team locks only on every confirm; nobody leaves after the lock', async () => {
    const { t, challengeId, me } = await mixer();
    await link(t, challengeId, 'p1', me[1].playerCode);
    expect(await t.mutation(api.challenges.confirmMixerTeam, { deviceToken: 'p1', challengeId })).toMatchObject({ status: 'forming' });
    expect(await errorCode(t.mutation(api.challenges.submitMixerAnswer, { deviceToken: 'p1', challengeId, answer: 'x' }))).toBe('TEAM_NOT_LOCKED');
    expect(await t.mutation(api.challenges.confirmMixerTeam, { deviceToken: 'p2', challengeId })).toMatchObject({ status: 'locked' });
    expect(await errorCode(t.mutation(api.challenges.leaveMixerTeam, { deviceToken: 'p1', challengeId }))).toBe('TEAM_LOCKED');
    expect(await errorCode(link(t, challengeId, 'p3', me[1].playerCode))).toBe('TEAM_LOCKED');
  });

  test('a fragment from outside the team fails; the first two correct teams take places 1 and 2', async () => {
    const { t, challengeId, me } = await mixer();
    for (const [a, b] of [[0, 1], [2, 3], [4, 5]]) {
      await link(t, challengeId, 'p' + (a + 1), me[b].playerCode);
      for (const i of [a, b]) await t.mutation(api.challenges.confirmMixerTeam, { deviceToken: 'p' + (i + 1), challengeId });
    }
    const answer = (red: number, blue: number) => keyOf(me[red].fragment.text) + ' ' + keyOf(me[blue].fragment.text);
    const outside = await t.mutation(api.challenges.submitMixerAnswer, { deviceToken: 'p1', challengeId, answer: answer(0, 3) });
    expect(outside).toMatchObject({ outcome: 'wrong', attempts: 1 });
    expect(await errorCode(t.mutation(api.challenges.submitMixerAnswer, { deviceToken: 'p1', challengeId, answer: answer(0, 1) }))).toBe('COOLDOWN');
    expect(await t.mutation(api.challenges.submitMixerAnswer, { deviceToken: 'p3', challengeId, answer: answer(2, 3).toLowerCase() })).toEqual({ outcome: 'correct', place: 1 });
    vi.advanceTimersByTime(21_000);
    expect(await t.mutation(api.challenges.submitMixerAnswer, { deviceToken: 'p2', challengeId, answer: answer(0, 1) })).toEqual({ outcome: 'correct', place: 2 });
    const standings = (await t.query(api.challenges.mixerStandings, { challengeId }))!;
    expect(standings.solved.map((s) => [s.place, s.memberNames])).toEqual([[1, ['P3', 'P4']], [2, ['P1', 'P2']]]);
    expect(standings.status).toBe('ended');
    const view = (await t.query(api.challenges.hostConsole, { deviceToken: HOST, challengeId }))!;
    expect(view.payoutPreview!.lines.map((l) => [l.place, l.players.map((p) => p.cents)])).toEqual([[1, [3000, 3000]], [2, [2000, 2000]]]);
  });

  test('standings count who is still looking by color', async () => {
    const { t, challengeId, me } = await mixer();
    await link(t, challengeId, 'p1', me[1].playerCode);
    const s = (await t.query(api.challenges.mixerStandings, { challengeId }))!;
    expect(s).toMatchObject({ entrantCount: 6, teamsForming: 1, teamsLocked: 0, solved: [] });
    expect(s.lookingByColor).toEqual([{ color: 'red', count: 2 }, { color: 'blue', count: 2 }]);
  });
});

describe('dealt standings', () => {
  test('finished teams rank by place, then the rest by progress', async () => {
    const { t, challengeId, joinCode } = await published({ teamSize: 2, reward: { kind: 'placement', percents: [50, 30, 20] } });
    await join(t, joinCode, tokens(6));
    await t.mutation(api.challenges.dealTeams, { deviceToken: HOST, challengeId });
    const teams = await teamsOf(t, challengeId, tokens(6));
    await solve(t, teams[2].code, teams[2].members);
    for (const d of teams[1].members) await t.mutation(api.signal.setPresence, { deviceToken: d, code: teams[1].code, presence: 'ready' });
    const s = (await t.query(api.challenges.challengeStandings, { deviceToken: 'p1', challengeId }))!;
    expect(s.rows.map((r) => [r.rank, r.label, r.progress.stage, r.place])).toEqual([
      [1, 'Team 3', 'finished', 1],
      [2, 'Team 2', 'investigating', null],
      [3, 'Team 1', 'briefing', null],
    ]);
    expect(s.rows.find((r) => r.isMine)?.label).toBe('Team 1');
  });
});
