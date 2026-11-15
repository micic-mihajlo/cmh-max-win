/// <reference types="vite/client" />
import presenceTest from '@convex-dev/presence/test';
import rateLimiterTest from '@convex-dev/rate-limiter/test';
import { convexTest } from 'convex-test';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { api } from './_generated/api';
import { parseShareRef, slugOf } from './discovery';
import { handleProblem, normalizeHandle } from './handles';
import schema from './schema';
import type { ChallengeConfigPatch } from '../src/lib/contract';

const modules = import.meta.glob('./**/*.ts');
const HOST = 'host-device';
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
afterEach(() => {
  vi.unstubAllEnvs();
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

async function creator(t: T = newTest()) {
  await t.mutation(api.challenges.saveCreatorProfile, { deviceToken: HOST, displayName: 'Nova', handle: '@Nova' });
  return t;
}

async function publish(t: T, patch: ChallengeConfigPatch) {
  const { challengeId } = await t.mutation(api.challenges.createChallenge, { deviceToken: HOST, patch: { poolCents: 10_000, ...patch } });
  const { joinCode } = await t.mutation(api.challenges.publishChallenge, { deviceToken: HOST, challengeId });
  return { challengeId, joinCode };
}

async function join(t: T, joinCode: string, players: string[]) {
  for (const deviceToken of players) await t.action(api.challenges.joinChallenge, { deviceToken, code: joinCode, name: 'Name-' + deviceToken });
}

// A solo live-mode race that ends with p2 in first place.
async function ended(t: T, title: string) {
  const c = await publish(t, { title, teamSize: 1, reward: { kind: 'winner_takes_all' } });
  await join(t, c.joinCode, ['p1', 'p2']);
  await t.mutation(api.challenges.dealTeams, { deviceToken: HOST, challengeId: c.challengeId });
  const code = (await t.query(api.challenges.myChallenge, { deviceToken: 'p2', challengeId: c.challengeId }))!.me.team!.roomCode;
  await t.mutation(api.signal.setPresence, { deviceToken: 'p2', code, presence: 'ready' });
  const { revision } = await t.mutation(api.signal.setTheory, { deviceToken: 'p2', code, culprit: 'jun' });
  await t.mutation(api.signal.lockIn, { deviceToken: 'p2', code, revision });
  return c;
}

describe('handles', () => {
  test('normalization folds case, @ and full-width forms; the rules include reserved words', () => {
    expect(normalizeHandle('  @Ｎｏｖａ_7 ')).toBe('nova_7');
    expect(normalizeHandle('@@NOVA')).toBe('nova');
    expect(handleProblem('nova')).toBeNull();
    expect(handleProblem('n')).toMatch(/2 to 20/);
    expect(handleProblem('no-va')).toMatch(/2 to 20/);
    expect(handleProblem('admin')).toBe('That handle is reserved.');
    expect(handleProblem('s_i_g_n_a_l')).toBe('That handle is reserved.');
  });

  test('one device per handle, whatever the spelling', async () => {
    const t = await creator();
    for (const handle of ['nova', ' @NOVA', 'Ｎｏｖａ']) {
      expect(await errorCode(t.mutation(api.challenges.saveCreatorProfile, { deviceToken: 'other', displayName: 'Copy', handle }))).toBe('HANDLE_TAKEN');
    }
    expect(await t.mutation(api.challenges.saveCreatorProfile, { deviceToken: HOST, displayName: 'Nova', handle: 'NOVA' })).toMatchObject({ handle: '@nova' });
    expect(await errorCode(t.mutation(api.challenges.saveCreatorProfile, { deviceToken: 'other', displayName: 'Admin', handle: '@Admin' }))).toBe('INVALID_CONFIG');
    expect(await t.query(api.handles.checkHandle, { deviceToken: 'other', handle: '@Nova' })).toEqual({ handle: 'nova', available: false, problem: 'That handle is taken.' });
    expect(await t.query(api.handles.checkHandle, { deviceToken: HOST, handle: 'nova' })).toEqual({ handle: 'nova', available: true, problem: null });
    expect(await t.query(api.handles.checkHandle, { handle: 'support' })).toMatchObject({ available: false, problem: 'That handle is reserved.' });
  });
});

describe('creator page', () => {
  test('live and open now, upcoming soonest first, recent results with winners by display name', async () => {
    const t = await creator();
    const past = await ended(t, 'Last week');
    const later = await publish(t, { title: 'Later', startMode: 'scheduled', startsAt: Date.now() + 90 * MIN });
    const onStream = await publish(t, { title: 'On stream' });
    const sooner = await publish(t, { title: 'Sooner', startMode: 'scheduled', startsAt: Date.now() + 30 * MIN });
    const open = await publish(t, { title: 'Open window', startMode: 'window', endsAt: Date.now() + 60 * MIN });
    await t.mutation(api.challenges.createChallenge, { deviceToken: HOST, patch: { title: 'Draft' } });

    const page = (await t.query(api.discovery.creatorPage, { handle: '@NOVA' }))!;
    expect(page).toMatchObject({ displayName: 'Nova', handle: '@nova', followerCount: 0, following: false });
    expect(page.live.map((c) => [c.challengeId, c.phase])).toEqual([[open.challengeId, 'open']]);
    expect(page.upcoming.map((c) => c.challengeId)).toEqual([sooner.challengeId, later.challengeId, onStream.challengeId]);
    expect(page.upcoming[2]).toMatchObject({ startMode: 'live', startsAt: null, phase: 'upcoming' });
    expect(page.recent).toHaveLength(1);
    expect(page.recent[0]).toMatchObject({ challengeId: past.challengeId, phase: 'ended', winners: [{ place: 1, memberNames: ['Name-p2'] }] });
    expect(page.upcoming[0]).toMatchObject({ prizePool: { cents: 10_000, display: '$100', concept: true, label: 'Free to enter · $100 prize pool (concept)' }, slug: 'nova-sooner-' + sooner.joinCode.toLowerCase() });
    expect(JSON.stringify(page)).not.toContain(HOST);
    expect(await t.query(api.discovery.creatorPage, { handle: 'nobody' })).toBeNull();
  });
});

describe('share links', () => {
  test('a code, slug, URL or id all resolve; drafts never do', async () => {
    const t = await creator();
    const { challengeId, joinCode } = await publish(t, { title: 'Friday Night Race!' });
    const slug = slugOf('nova', 'Friday Night Race!', joinCode);
    expect(slug).toBe('nova-friday-night-race-' + joinCode.toLowerCase());
    for (const ref of [joinCode.toLowerCase(), slug, 'nova/' + joinCode, `https://signal.gg/c/${slug}`, `https://signal.gg/join?code=${joinCode}`, `https://signal.gg/@nova/${joinCode}`, challengeId]) {
      expect((await t.query(api.discovery.shareLink, { ref }))?.challengeId).toBe(challengeId);
    }
    expect(await t.query(api.discovery.shareLink, { ref: 'someone-else-' + joinCode })).toBeNull();
    const draft = await t.mutation(api.challenges.createChallenge, { deviceToken: HOST, patch: { title: 'Secret draft' } });
    expect(await t.query(api.discovery.shareLink, { ref: draft.challengeId })).toBeNull();
    expect(parseShareRef('ABCD')).toEqual({ code: 'ABCD', handle: null, id: 'ABCD' });
  });

  test('the preview carries only public fields: no tokens, product ids, entrants or fragments', async () => {
    vi.stubEnv('WHOP_OAUTH_CLIENT_ID', 'client');
    const t = await creator();
    const members = await publish(t, { title: 'Members race', eligibility: { kind: 'whop_members', productId: 'prod_secret_123' }, poolCents: 125_050 });
    const mixer = await publish(t, { title: 'Mixer', teamFormation: 'mixer', templateId: 'split-passphrase', mixerColors: ['red', 'blue'], requireWhopToJoin: false });
    vi.unstubAllEnvs();
    await join(t, mixer.joinCode, ['p1', 'p2']);
    const preview = (await t.query(api.discovery.shareLink, { ref: members.joinCode }))!;
    expect(Object.keys(preview).sort()).toEqual(
      ['challengeId', 'creator', 'endsAt', 'joinCode', 'membersOnly', 'phase', 'prizePool', 'serverNow', 'slug', 'startMode', 'startsAt', 'title'].sort(),
    );
    expect(preview).toMatchObject({ membersOnly: true, phase: 'upcoming', creator: { displayName: 'Nova', handle: '@nova' }, prizePool: { display: '$1,250.50' } });
    const mixerPreview = await t.query(api.discovery.shareLink, { ref: mixer.joinCode });
    const entries = await t.run((ctx) => ctx.db.query('challengeEntries').collect());
    const privates = [HOST, 'prod_secret_123', 'p1', 'p2', 'Name-p1', ...entries.flatMap((e) => [e.fragmentSeed ?? '', e.playerCode ?? '']).filter(Boolean)];
    const raw = JSON.stringify([preview, mixerPreview]);
    for (const secret of privates) expect(raw).not.toContain(secret);
  });

  test("an ended challenge's preview shows no join code", async () => {
    const t = await creator();
    const { challengeId } = await ended(t, 'Done');
    expect(await t.query(api.discovery.shareLink, { ref: challengeId })).toMatchObject({ phase: 'ended', joinCode: null });
  });
});

describe('follow and remind', () => {
  test('follows and reminders are idempotent, and a reminder follows the creator', async () => {
    const t = await creator();
    const { challengeId } = await publish(t, { title: 'Soon', startMode: 'scheduled', startsAt: Date.now() + 30 * MIN });
    expect(await t.mutation(api.discovery.followCreator, { deviceToken: 'fan', handle: '@nova' })).toEqual({ following: true, followerCount: 1 });
    expect(await t.mutation(api.discovery.followCreator, { deviceToken: 'fan', handle: 'NOVA' })).toEqual({ following: true, followerCount: 1 });
    await t.mutation(api.discovery.remindChallenge, { deviceToken: 'fan', challengeId });
    await t.mutation(api.discovery.remindChallenge, { deviceToken: 'fan', challengeId });
    await t.mutation(api.discovery.remindChallenge, { deviceToken: 'fan2', challengeId });
    const counts = await t.run(async (ctx) => [(await ctx.db.query('follows').collect()).length, (await ctx.db.query('challengeReminders').collect()).length]);
    expect(counts).toEqual([2, 2]);
    expect(await t.query(api.discovery.creatorPage, { handle: 'nova', deviceToken: 'fan2' })).toMatchObject({ following: true, followerCount: 2 });
    expect(await t.mutation(api.discovery.unfollowCreator, { deviceToken: 'fan', handle: 'nova' })).toEqual({ following: false, followerCount: 1 });
    expect(await t.mutation(api.discovery.unfollowCreator, { deviceToken: 'fan', handle: 'nova' })).toEqual({ following: false, followerCount: 1 });
  });

  test("following a creator is following their hosted drops in the drops feed", async () => {
    const t = await creator();
    await t.mutation(api.discovery.followCreator, { deviceToken: 'fan', handle: 'nova' });
    const { dropId } = await t.mutation(api.drops.hostDrop, { deviceToken: HOST, creatorName: 'Nova' });
    expect((await t.query(api.feed.followingFeed, { deviceToken: 'fan' })).live.map((l) => l.dropId)).toEqual([dropId]);
  });

  test('upcoming reminders: timed soonest first, then live mode; started, cancelled and window challenges are out', async () => {
    const t = await creator();
    const later = await publish(t, { title: 'Later', startMode: 'scheduled', startsAt: Date.now() + 90 * MIN });
    const onStream = await publish(t, { title: 'On stream' });
    const sooner = await publish(t, { title: 'Sooner', startMode: 'scheduled', startsAt: Date.now() + 30 * MIN });
    const gone = await publish(t, { title: 'Cancelled', startMode: 'scheduled', startsAt: Date.now() + 10 * MIN });
    const window = await publish(t, { title: 'Window', startMode: 'window', endsAt: Date.now() + 60 * MIN });
    for (const c of [later, onStream, sooner, gone]) await t.mutation(api.discovery.remindChallenge, { deviceToken: 'fan', challengeId: c.challengeId });
    expect(await errorCode(t.mutation(api.discovery.remindChallenge, { deviceToken: 'fan', challengeId: window.challengeId }))).toBe('CHALLENGE_CLOSED');
    await t.mutation(api.challenges.cancelChallenge, { deviceToken: HOST, challengeId: gone.challengeId, reason: 'Stream moved' });
    const reminders = await t.query(api.discovery.upcomingReminders, { deviceToken: 'fan' });
    expect(reminders.map((r) => r.title)).toEqual(['Sooner', 'Later', 'On stream']);
    expect(reminders[0]).toMatchObject({ startMode: 'scheduled', startsAt: Date.now() + 30 * MIN, creator: { handle: '@nova' } });
    await t.mutation(api.discovery.cancelChallengeReminder, { deviceToken: 'fan', challengeId: sooner.challengeId });
    expect((await t.query(api.discovery.upcomingReminders, { deviceToken: 'fan' })).map((r) => r.title)).toEqual(['Later', 'On stream']);
  });
});
