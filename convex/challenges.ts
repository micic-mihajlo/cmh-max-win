import { ConvexError, v, type Infer } from 'convex/values';

import { internal } from './_generated/api';
import type { Doc, Id } from './_generated/dataModel';
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from './_generated/server';
import { CONCEPT_LABEL, createSandboxClaimLink } from './bounty';
import { ELIGIBILITY_STUB_NOTE, resolveIdentity } from './creatorIdentity';
import { dealPieces, splitSizes } from './drops';
import { mixerTemplate, verifyMixerTeam } from './templates/engine';
import { listTemplates } from './templates/registry';
import { checkWhopAccess } from './whopAuth';
import { challengeConfig } from './schema';
import { CODE_ALPHABET, generateCode } from './signal';
import { whopEnvironment, whopRequest } from './whop';
import type {
  ChallengeConfig,
  ChallengeDraftView,
  ChallengeRecapView,
  ChallengeResultRow,
  ChallengeStandingsView,
  ChallengeSummaryView,
  ChallengeTemplateId,
  ChallengeTeamView,
  ChallengeTemplateView,
  ConfigIssue,
  CreatorProfileView,
  EligibilityView,
  HostConsoleView,
  MixerColor,
  MixerMeView,
  MixerStandingsView,
  MixerSubmitResult,
  MixerTeamView,
  MyPayoutView,
  PayoutPreviewView,
  PayoutRowView,
  PlayerChallengeView,
  RewardPolicy,
  SignalErrorCode,
  SquadSize,
  TeamSize,
} from '../src/lib/contract';

type Ctx = QueryCtx;
type Challenge = Doc<'challenges'>;

function fail(code: SignalErrorCode, message: string, extra?: Record<string, unknown>): never {
  throw new ConvexError({ code, message, ...extra });
}

const DAY_MS = 24 * 60 * 60 * 1000;

// Templates come from the CAP-32 registry. Dealt teams play in aurora rooms, so dealt mode needs mystery-aurora
// for now; mixer mode needs a template with mixer support.
export const TEMPLATES: ChallengeTemplateView[] = listTemplates().map((t) => ({
  id: t.id as ChallengeTemplateId,
  name: t.name,
  blurb: t.summary,
  teamSizes: t.teamSizes as TeamSize[],
  formations: t.formations,
}));

const whopOAuthConfigured = () => Boolean(process.env.WHOP_OAUTH_CLIENT_ID);

export const DEFAULT_CONFIG: ChallengeConfig = {
  title: '',
  blurb: '',
  templateId: 'mystery-aurora',
  teamFormation: 'dealt',
  teamSize: 3,
  mixerColors: ['red', 'blue', 'green'],
  leftover: 'smaller_teams',
  startMode: 'live',
  startsAt: null,
  endsAt: null,
  eligibility: { kind: 'open' },
  reward: { kind: 'placement', percents: [50, 30, 20] },
  poolCents: 0,
  currency: 'usd',
  payoutAdapter: 'concept',
  requireWhopToJoin: false,
  claimWindowMs: 7 * DAY_MS,
};

const configPatch = v.object(
  Object.fromEntries(Object.entries(challengeConfig.fields).map(([k, val]) => [k, v.optional(val)])) as {
    [K in keyof typeof challengeConfig.fields]: ReturnType<typeof v.optional<(typeof challengeConfig.fields)[K]>>;
  },
);

// ---------- Pure policy math ----------

export function paidPlaceCount(reward: RewardPolicy) {
  if (reward.kind === 'winner_takes_all') return 1;
  if (reward.kind === 'top_x_equal') return reward.places;
  return reward.percents.length;
}

export const MAX_TEAM_SIZE = 4;

export function placeBudgets(poolCents: number, reward: RewardPolicy): number[] {
  if (reward.kind === 'winner_takes_all') return [poolCents];
  if (reward.kind === 'top_x_equal') return Array(reward.places).fill(Math.floor(poolCents / reward.places));
  return reward.percents.map((p) => Math.floor((poolCents * p) / 100));
}

type Finisher = { place: number; teamLabel: string; players: string[] };

// Exact cents: per-player floor within each filled place; every leftover cent to first place's first player;
// budgets of unfilled places return to the creator. paid + returned always equals the pool.
export function computePreview(poolCents: number, reward: RewardPolicy, finishers: Finisher[]): PayoutPreviewView {
  let unfilled = 0;
  const lines: PayoutPreviewView['lines'] = [];
  placeBudgets(poolCents, reward).forEach((budget, i) => {
    const f = finishers.find((x) => x.place === i + 1);
    if (!f || f.players.length === 0) {
      unfilled += budget;
      return;
    }
    const per = Math.floor(budget / f.players.length);
    lines.push({ place: f.place, teamLabel: f.teamLabel, budgetCents: budget, players: f.players.map((name) => ({ name, cents: per, status: null })) });
  });
  const allocated = lines.reduce((s, l) => s + l.players.reduce((a, p) => a + p.cents, 0), 0);
  const leftover = poolCents - unfilled - allocated;
  if (lines[0]?.place === 1) lines[0].players[0].cents += leftover;
  else unfilled += leftover;
  const paidCents = lines.reduce((s, l) => s + l.players.reduce((a, p) => a + p.cents, 0), 0);
  if (paidCents + unfilled !== poolCents) throw new Error('Payout math does not add up to the pool.');
  return {
    poolCents,
    paidCents,
    returnedCents: unfilled,
    returned: { unfilledPlacesCents: unfilled, expiredCents: 0 },
    lines,
  };
}

export function validateConfig(c: ChallengeConfig, serverCreated: boolean, now: number): ConfigIssue[] {
  const issues: ConfigIssue[] = [];
  const add = (field: keyof ChallengeConfig, message: string) => issues.push({ field, message });
  const title = c.title.trim();
  if (title.length < 1 || title.length > 60) add('title', 'Give it a title of 1 to 60 characters.');
  if (c.blurb.length > 280) add('blurb', 'Keep the blurb under 280 characters.');
  const template = TEMPLATES.find((t) => t.id === c.templateId);
  if (!template) add('templateId', 'Unknown template.');
  else if (!template.formations.includes(c.teamFormation)) add('templateId', template.name + ' does not support ' + c.teamFormation + ' teams.');
  else if (c.teamFormation === 'dealt' && c.templateId !== 'mystery-aurora') add('templateId', 'Dealt teams play Aurora for now.');
  if (!Number.isInteger(c.teamSize) || c.teamSize < 1 || c.teamSize > MAX_TEAM_SIZE) add('teamSize', 'Teams are 1 to ' + MAX_TEAM_SIZE + ' players.');
  else if (c.teamFormation === 'dealt' && template && !template.teamSizes.includes(c.teamSize)) {
    add('teamSize', template.name + ' plays in teams of ' + template.teamSizes.join(' or ') + ' for now.');
  }
  if (c.teamFormation === 'mixer' && (c.mixerColors.length < 2 || c.mixerColors.length > 4 || new Set(c.mixerColors).size !== c.mixerColors.length)) {
    add('mixerColors', 'Pick 2 to 4 different colors.');
  }
  if (c.startMode === 'scheduled' && (c.startsAt === null || c.startsAt <= now)) add('startsAt', 'Pick a start time in the future.');
  if (c.startMode === 'window' && c.endsAt === null) add('endsAt', 'A window challenge needs an end time.');
  if (c.endsAt !== null) {
    if (c.endsAt <= now) add('endsAt', 'Pick an end time in the future.');
    else if (c.startMode === 'scheduled' && c.startsAt !== null && c.endsAt <= c.startsAt) add('endsAt', 'End after the start.');
  }
  if (c.reward.kind === 'top_x_equal' && (!Number.isInteger(c.reward.places) || c.reward.places < 1 || c.reward.places > 50)) {
    add('reward', 'Pay between 1 and 50 places.');
  }
  if (c.reward.kind === 'placement') {
    const p = c.reward.percents;
    if (!p.length || p.length > 50 || p.some((x) => !Number.isInteger(x) || x < 1)) add('reward', 'Tiers are whole percentages of at least 1.');
    else if (p.reduce((a, b) => a + b, 0) !== 100) add('reward', 'Tier percentages must add up to 100.');
  }
  if (!Number.isInteger(c.poolCents) || c.poolCents < 0) add('poolCents', 'The pool is a whole number of cents, 0 or more.');
  if (c.eligibility.kind === 'whop_members' && !c.eligibility.productId.trim()) add('eligibility', 'Add the Whop product id.');
  if (c.payoutAdapter === 'whop' && !serverCreated) add('payoutAdapter', 'Whop payouts are limited to server-created challenges for now.');
  if (!Number.isInteger(c.claimWindowMs) || c.claimWindowMs < 60_000 || c.claimWindowMs > 30 * DAY_MS) {
    add('claimWindowMs', 'The claim window is between 1 minute and 30 days.');
  }
  return issues;
}

function normalize(c: ChallengeConfig): ChallengeConfig {
  return { ...c, requireWhopToJoin: c.eligibility.kind === 'whop_members' ? true : c.requireWhopToJoin };
}

// ---------- Lookups ----------

function asChallengeId(ctx: Ctx, id: string) {
  return ctx.db.normalizeId('challenges', id);
}

async function getChallenge(ctx: Ctx, id: string) {
  const cid = asChallengeId(ctx, id);
  return cid ? ctx.db.get(cid) : null;
}

async function requireOwned(ctx: Ctx, deviceToken: string, id: string) {
  const c = await getChallenge(ctx, id);
  if (!c) fail('CHALLENGE_NOT_FOUND', 'No such challenge.');
  const me = await resolveIdentity(ctx, deviceToken);
  if (c.creatorToken !== me.deviceToken) fail('NOT_CREATOR', 'Only the creator can do that.');
  return c;
}

async function findByCode(ctx: Ctx, code: string) {
  const matches = await ctx.db
    .query('challenges')
    .withIndex('by_joinCode', (q) => q.eq('joinCode', code.trim().toUpperCase()))
    .collect();
  return matches.find((c) => c.status === 'published' || c.status === 'live') ?? matches.sort((a, b) => b.createdAt - a.createdAt)[0] ?? null;
}

async function generateChallengeCode(ctx: MutationCtx) {
  for (;;) {
    let code = '';
    for (let i = 0; i < 4; i++) code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    const challenge = await findByCode(ctx, code);
    const drops = await ctx.db.query('drops').withIndex('by_joinCode', (q) => q.eq('joinCode', code)).collect();
    if ((!challenge || challenge.status === 'ended' || challenge.status === 'cancelled') && drops.every((d) => d.status === 'ended')) return code;
  }
}

const entriesOf = (ctx: Ctx, challengeId: Id<'challenges'>) =>
  ctx.db.query('challengeEntries').withIndex('by_challenge', (q) => q.eq('challengeId', challengeId)).collect();
const teamsOf = (ctx: Ctx, challengeId: Id<'challenges'>) =>
  ctx.db.query('challengeTeams').withIndex('by_challenge', (q) => q.eq('challengeId', challengeId)).collect();
const payoutsOf = (ctx: Ctx, challengeId: Id<'challenges'>) =>
  ctx.db.query('payouts').withIndex('by_challenge', (q) => q.eq('challengeId', challengeId)).collect();
const findEntry = (ctx: Ctx, challengeId: Id<'challenges'>, deviceToken: string) =>
  ctx.db
    .query('challengeEntries')
    .withIndex('by_challenge_token', (q) => q.eq('challengeId', challengeId).eq('deviceToken', deviceToken))
    .unique();

async function creatorOf(ctx: Ctx, deviceToken: string) {
  const p = await ctx.db.query('creators').withIndex('by_token', (q) => q.eq('deviceToken', deviceToken)).first();
  return { displayName: p?.displayName ?? 'Host', handle: p ? '@' + p.handle : '' };
}

function eligibilityView(c: ChallengeConfig): EligibilityView {
  return c.eligibility.kind === 'open'
    ? { kind: 'open', productId: null, enforced: false, note: null }
    : whopOAuthConfigured()
      ? { kind: 'whop_members', productId: c.eligibility.productId, enforced: true, note: null }
      : { kind: 'whop_members', productId: c.eligibility.productId, enforced: false, note: ELIGIBILITY_STUB_NOTE };
}

async function summaryView(ctx: Ctx, c: Challenge): Promise<ChallengeSummaryView> {
  const [entries, teams, creator] = await Promise.all([entriesOf(ctx, c._id), teamsOf(ctx, c._id), creatorOf(ctx, c.creatorToken)]);
  return {
    challengeId: c._id,
    status: c.status,
    config: c.config,
    joinCode: c.joinCode ?? null,
    creator,
    entrantCount: entries.length,
    teamCount: teams.length,
    createdAt: c.createdAt,
    publishedAt: c.publishedAt ?? null,
    endedAt: c.endedAt ?? null,
  };
}

function timeLeft(c: Challenge, now: number) {
  if (c.config.startMode === 'scheduled' && c.status === 'published' && c.config.startsAt !== null) return Math.max(0, c.config.startsAt - now);
  if ((c.status === 'published' || c.status === 'live') && c.config.endsAt !== null) return Math.max(0, c.config.endsAt - now);
  return null;
}

async function teamViews(ctx: Ctx, c: Challenge, teams: Doc<'challengeTeams'>[], entries: Doc<'challengeEntries'>[]) {
  return teams.map((t): ChallengeTeamView => ({
    teamId: t._id,
    label: t.label,
    memberNames: entries.filter((e) => e.teamId === t._id).map((e) => e.name),
    status: t.place !== undefined ? 'finished' : c.status === 'ended' || c.status === 'cancelled' ? 'unfinished' : 'playing',
    place: t.place ?? null,
    finishedAt: t.finishedAt ?? null,
    finishMs: t.finishedAt !== undefined ? t.finishedAt - t.dealtAt : null,
  }));
}

async function finishersOf(ctx: Ctx, c: Challenge, teams: Doc<'challengeTeams'>[], entries: Doc<'challengeEntries'>[]) {
  if (c.config.teamFormation === 'mixer') {
    const byId = new Map(entries.map((e) => [e._id, e]));
    return (await mixerTeamsOf(ctx, c._id))
      .filter((t) => t.place !== undefined)
      .map((t) => ({ place: t.place!, teamLabel: t.label, entries: t.memberIds.map((id) => byId.get(id)!).filter(Boolean) }));
  }
  return teams
    .filter((t) => t.place !== undefined)
    .map((t) => ({ place: t.place!, teamLabel: t.label, entries: entries.filter((e) => e.teamId === t._id) }));
}

async function previewFor(ctx: Ctx, c: Challenge) {
  const [entries, teams, rows] = await Promise.all([entriesOf(ctx, c._id), teamsOf(ctx, c._id), payoutsOf(ctx, c._id)]);
  const finishers = await finishersOf(ctx, c, teams, entries);
  const preview = computePreview(
    c.config.poolCents,
    c.config.reward,
    finishers.map((f) => ({ place: f.place, teamLabel: f.teamLabel, players: f.entries.map((e) => e.name) })),
  );
  for (const line of preview.lines) {
    line.players.forEach((p, i) => {
      const row = rows.find((r) => r.place === line.place && r.playerIndex === i);
      p.status = row?.status ?? null;
      if (row?.status === 'expired') preview.returned.expiredCents += p.cents;
    });
  }
  const moved = preview.returned.expiredCents;
  preview.paidCents -= moved;
  preview.returnedCents += moved;
  return { preview, finishers, rows };
}

// ---------- Teams ----------

async function createTeam(ctx: MutationCtx, c: Challenge, seats: Doc<'challengeEntries'>[], index: number, now: number) {
  const size = seats.length as SquadSize;
  const label = 'Team ' + (index + 1);
  const roomId = await ctx.db.insert('rooms', {
    code: await generateCode(ctx),
    hostToken: '',
    caseId: 'aurora01',
    challengeId: c._id,
    squadSize: size,
    squadIndex: index,
    squadLabel: label,
    status: 'intro',
    theory: { culprit: null, revision: 0, lastEditedBy: null },
    attempts: 0,
    lastNudge: null,
    checkedRevision: null,
    checkSeq: 0,
    lastCheck: null,
  });
  const hands = dealPieces(c._id, index, size);
  const teamId = await ctx.db.insert('challengeTeams', { challengeId: c._id, index, label, roomId, size, dealtAt: now });
  for (const [i, e] of seats.entries()) {
    await ctx.db.insert('members', { roomId, deviceToken: e.deviceToken, name: e.name, role: hands[i][0], roles: hands[i], presence: 'online' });
    await ctx.db.patch(e._id, { teamId });
  }
}

// smaller_teams: trios and duos split exactly as drops do today; solo is all singles; fours take the remainder as one
// smaller team, and a lone leftover turns the last four into a trio and a duo.
export function leftoverSizes(count: number, n: number): number[] {
  if (n === 2 || n === 3) return splitSizes(count, n as SquadSize);
  if (n === 1) return Array(count).fill(1);
  if (count < n) return count ? [count] : [];
  const r = count % n;
  const full = Math.floor(count / n);
  if (r === 1) return [...Array(full - 1).fill(n), n - 1, 2];
  return [...Array(full).fill(n), ...(r ? [r] : [])];
}

// Deals waiting entrants into teams in entry order. final: the leftover policy applies to the remainder.
async function formTeams(ctx: MutationCtx, c: Challenge, final: boolean) {
  const now = Date.now();
  const [entries, teams] = await Promise.all([entriesOf(ctx, c._id), teamsOf(ctx, c._id)]);
  const waiting = entries.filter((e) => !e.teamId && !e.waitingNextRound).sort((a, b) => a.joinedAt - b.joinedAt);
  const n = c.config.teamSize;
  const sizes = final && c.config.leftover === 'smaller_teams' ? leftoverSizes(waiting.length, n) : Array(Math.floor(waiting.length / n)).fill(n);
  let next = 0;
  for (const [i, size] of sizes.entries()) {
    await createTeam(ctx, c, waiting.slice(next, next + size), teams.length + i, now);
    next += size;
  }
  if (final) await Promise.all(waiting.slice(next).map((e) => ctx.db.patch(e._id, { waitingNextRound: true })));
  if (sizes.length && c.status === 'published') await ctx.db.patch(c._id, { status: 'live', firstDealtAt: now });
  return sizes.length;
}

async function endNow(ctx: MutationCtx, c: Challenge) {
  if (c.status !== 'published' && c.status !== 'live') return;
  const entries = await entriesOf(ctx, c._id);
  await Promise.all(entries.filter((e) => !e.teamId && !e.waitingNextRound).map((e) => ctx.db.patch(e._id, { waitingNextRound: true })));
  await ctx.db.patch(c._id, { status: 'ended', endedAt: Date.now() });
}

// Called by lockIn when a challenge team's correct final lock-in commits.
export async function recordChallengeFinish(ctx: MutationCtx, room: Doc<'rooms'>, now: number) {
  const c = room.challengeId ? await ctx.db.get(room.challengeId) : null;
  if (!c || c.status !== 'live') return;
  const team = await ctx.db.query('challengeTeams').withIndex('by_room', (q) => q.eq('roomId', room._id)).unique();
  if (!team || team.place !== undefined) return;
  const place = c.finishedCount + 1;
  await ctx.db.patch(team._id, { place, finishedAt: now });
  await ctx.db.patch(c._id, { finishedCount: place });
  const teams = await teamsOf(ctx, c._id);
  const allDone = teams.every((t) => t._id === team._id || t.place !== undefined);
  if (place >= paidPlaceCount(c.config.reward) || (allDone && c.config.startMode !== 'window')) await endNow(ctx, { ...c, finishedCount: place });
}

// lockIn refuses play in a challenge room unless the challenge is live.
export async function challengeIsPlayable(ctx: QueryCtx, challengeId: Id<'challenges'>) {
  return (await ctx.db.get(challengeId))?.status === 'live';
}

// ---------- Creator profile ----------

function profileView(p: Doc<'creators'>, whop: boolean): CreatorProfileView {
  return { creatorId: p._id, displayName: p.displayName, handle: '@' + p.handle, identity: whop ? 'whop' : 'device' };
}

export const creatorProfile = query({
  args: { deviceToken: v.string() },
  handler: async (ctx, { deviceToken }): Promise<CreatorProfileView | null> => {
    const me = await resolveIdentity(ctx, deviceToken);
    const p = await ctx.db.query('creators').withIndex('by_token', (q) => q.eq('deviceToken', me.deviceToken)).first();
    return p ? profileView(p, !!me.whopUserId) : null;
  },
});

export const saveCreatorProfile = mutation({
  args: { deviceToken: v.string(), displayName: v.string(), handle: v.string() },
  handler: async (ctx, { deviceToken, displayName, handle }): Promise<CreatorProfileView> => {
    const me = await resolveIdentity(ctx, deviceToken);
    const name = displayName.trim().slice(0, 40);
    const h = handle.trim().replace(/^@/, '').toLowerCase();
    if (!name) fail('INVALID_CONFIG', 'Add a display name.');
    if (!/^[a-z0-9_]{2,20}$/.test(h)) fail('INVALID_CONFIG', 'Handles are 2 to 20 letters, numbers or underscores.');
    const taken = await ctx.db.query('creators').withIndex('by_handle', (q) => q.eq('handle', h)).first();
    if (taken && taken.deviceToken !== me.deviceToken) fail('HANDLE_TAKEN', 'That handle is taken.');
    const mine = await ctx.db.query('creators').withIndex('by_token', (q) => q.eq('deviceToken', me.deviceToken)).first();
    if (mine) await ctx.db.patch(mine._id, { displayName: name, handle: h });
    else await ctx.db.insert('creators', { deviceToken: me.deviceToken, displayName: name, handle: h });
    const saved = (await ctx.db.query('creators').withIndex('by_token', (q) => q.eq('deviceToken', me.deviceToken)).first())!;
    return profileView(saved, !!me.whopUserId);
  },
});

// ---------- Drafts ----------

export const templates = query({ args: {}, handler: async (): Promise<ChallengeTemplateView[]> => TEMPLATES });

async function insertDraft(ctx: MutationCtx, creatorToken: string, patch: Partial<ChallengeConfig>, serverCreated: boolean) {
  const config = normalize({ ...DEFAULT_CONFIG, ...patch });
  const challengeId = await ctx.db.insert('challenges', { creatorToken, config, status: 'draft', serverCreated, createdAt: Date.now(), finishedCount: 0 });
  return { challengeId: challengeId as string };
}

export const createChallenge = mutation({
  args: { deviceToken: v.string(), patch: v.optional(configPatch) },
  handler: async (ctx, { deviceToken, patch }) => {
    const me = await resolveIdentity(ctx, deviceToken);
    const profile = await ctx.db.query('creators').withIndex('by_token', (q) => q.eq('deviceToken', me.deviceToken)).first();
    if (!profile) fail('NO_PROFILE', 'Save a creator profile first.');
    return insertDraft(ctx, me.deviceToken, (patch ?? {}) as Partial<ChallengeConfig>, false);
  },
});

// Server-created challenges are the only ones allowed the whop payout adapter for now.
export const createServerChallenge = internalMutation({
  args: { creatorToken: v.string(), patch: v.optional(configPatch) },
  handler: (ctx, { creatorToken, patch }) => insertDraft(ctx, creatorToken, (patch ?? {}) as Partial<ChallengeConfig>, true),
});

export const myChallenges = query({
  args: { deviceToken: v.string() },
  handler: async (ctx, { deviceToken }): Promise<ChallengeSummaryView[]> => {
    const me = await resolveIdentity(ctx, deviceToken);
    const mine = await ctx.db.query('challenges').withIndex('by_creator', (q) => q.eq('creatorToken', me.deviceToken)).collect();
    return Promise.all(mine.sort((a, b) => b.createdAt - a.createdAt).map((c) => summaryView(ctx, c)));
  },
});

export const challengeDraft = query({
  args: { deviceToken: v.string(), challengeId: v.string() },
  handler: async (ctx, { deviceToken, challengeId }): Promise<ChallengeDraftView | null> => {
    const c = await getChallenge(ctx, challengeId);
    if (!c || c.creatorToken !== (await resolveIdentity(ctx, deviceToken)).deviceToken) return null;
    return {
      ...(await summaryView(ctx, c)),
      issues: c.status === 'draft' ? validateConfig(c.config, c.serverCreated, Date.now()) : [],
      template: TEMPLATES.find((t) => t.id === c.config.templateId)!,
    };
  },
});

export const updateChallengeDraft = mutation({
  args: { deviceToken: v.string(), challengeId: v.string(), patch: configPatch },
  handler: async (ctx, { deviceToken, challengeId, patch }) => {
    const c = await requireOwned(ctx, deviceToken, challengeId);
    if (c.status !== 'draft') fail('CHALLENGE_CLOSED', 'A published challenge is frozen. Clone it to change the config.');
    const config = normalize({ ...c.config, ...(patch as Partial<ChallengeConfig>) });
    await ctx.db.patch(c._id, { config });
    return { issues: validateConfig(config, c.serverCreated, Date.now()) };
  },
});

export const publishChallenge = mutation({
  args: { deviceToken: v.string(), challengeId: v.string() },
  handler: async (ctx, { deviceToken, challengeId }) => {
    const c = await requireOwned(ctx, deviceToken, challengeId);
    if (c.status !== 'draft') fail('CHALLENGE_CLOSED', 'Already published.');
    const now = Date.now();
    if (c.config.eligibility.kind === 'whop_members' && !whopOAuthConfigured()) {
      fail('WHOP_NOT_CONFIGURED', 'Whop sign-in is not set up on this deployment, so nobody could join a members-only challenge.');
    }
    const issues = validateConfig(c.config, c.serverCreated, now);
    if (issues.length) fail('INVALID_CONFIG', issues[0].message, { issues });
    const joinCode = await generateChallengeCode(ctx);
    await ctx.db.patch(c._id, { status: 'published', joinCode, publishedAt: now, config: { ...c.config, title: c.config.title.trim() } });
    await ctx.db.insert('fundingLedger', { challengeId: c._id, amountCents: c.config.poolCents, status: 'committed_concept', committedAt: now });
    if (c.config.startMode === 'scheduled') await ctx.scheduler.runAt(c.config.startsAt!, internal.challenges.autoStart, { challengeId: c._id });
    if (c.config.endsAt !== null) await ctx.scheduler.runAt(c.config.endsAt, internal.challenges.autoEnd, { challengeId: c._id });
    return { joinCode };
  },
});

export const autoStart = internalMutation({
  args: { challengeId: v.id('challenges') },
  handler: async (ctx, { challengeId }) => {
    const c = await ctx.db.get(challengeId);
    if (!c || c.status !== 'published') return;
    if (c.config.teamFormation === 'mixer') return ctx.db.patch(c._id, { status: 'live', firstDealtAt: Date.now() });
    if (!(await formTeams(ctx, c, true))) await endNow(ctx, c);
  },
});

export const autoEnd = internalMutation({
  args: { challengeId: v.id('challenges') },
  handler: async (ctx, { challengeId }) => {
    const c = await ctx.db.get(challengeId);
    if (c) await endNow(ctx, c);
  },
});

export const cloneChallenge = mutation({
  args: { deviceToken: v.string(), challengeId: v.string() },
  handler: async (ctx, { deviceToken, challengeId }) => {
    const c = await requireOwned(ctx, deviceToken, challengeId);
    return insertDraft(ctx, c.creatorToken, { ...c.config, payoutAdapter: c.serverCreated ? c.config.payoutAdapter : 'concept' }, c.serverCreated);
  },
});

// ---------- Entering ----------

async function playerView(ctx: Ctx, c: Challenge, deviceToken: string): Promise<PlayerChallengeView> {
  const [entries, creator, mine] = await Promise.all([entriesOf(ctx, c._id), creatorOf(ctx, c.creatorToken), findEntry(ctx, c._id, deviceToken)]);
  const team = mine?.teamId ? await ctx.db.get(mine.teamId) : null;
  const room = team ? await ctx.db.get(team.roomId) : null;
  return {
    challengeId: c._id,
    status: c.status,
    title: c.config.title,
    blurb: c.config.blurb,
    templateId: c.config.templateId,
    creator,
    joinCode: c.joinCode ?? null,
    startMode: c.config.startMode,
    teamSize: c.config.teamSize,
    startsAt: c.config.startsAt,
    endsAt: c.config.endsAt,
    serverNow: Date.now(),
    entrantCount: entries.length,
    reward: c.config.reward,
    poolCents: c.config.poolCents,
    payoutAdapter: c.config.payoutAdapter,
    eligibility: eligibilityView(c.config),
    cancelled: c.status === 'cancelled' ? { reason: c.cancelReason ?? '', at: c.endedAt ?? 0 } : null,
    me: {
      entered: !!mine,
      name: mine?.name ?? null,
      team: team && room ? { teamId: team._id, label: team.label, roomCode: room.code, size: team.size as TeamSize } : null,
      waitingNextRound: mine?.waitingNextRound ?? false,
      mixer: mine && c.config.teamFormation === 'mixer' ? await mixerMe(ctx, c, mine) : null,
    },
    requireWhopToJoin: c.config.requireWhopToJoin,
    teamFormation: c.config.teamFormation,
  };
}

export const challengeByCode = query({
  args: { deviceToken: v.string(), code: v.string() },
  handler: async (ctx, { deviceToken, code }): Promise<PlayerChallengeView | null> => {
    const c = await findByCode(ctx, code);
    return c && c.status !== 'draft' ? playerView(ctx, c, deviceToken) : null;
  },
});

export const myChallenge = query({
  args: { deviceToken: v.string(), challengeId: v.string() },
  handler: async (ctx, { deviceToken, challengeId }): Promise<PlayerChallengeView | null> => {
    const c = await getChallenge(ctx, challengeId);
    return c && c.status !== 'draft' ? playerView(ctx, c, deviceToken) : null;
  },
});

// Joining is an action so whop_members eligibility can ask Whop (checkWhopAccess) before the entry is written.
// Until Whop OAuth is configured on the deployment, membership is recorded but not checked.
export const joinChallenge = action({
  args: { deviceToken: v.string(), code: v.string(), name: v.string() },
  handler: async (ctx, args): Promise<{ challengeId: string }> => {
    const gate = await ctx.runQuery(internal.challenges.joinGate, { deviceToken: args.deviceToken, code: args.code });
    if (gate && whopOAuthConfigured()) {
      if (!gate.whopUserId) fail('WHOP_SIGN_IN_REQUIRED', 'Sign in with Whop to join this challenge.');
      const { hasAccess } = await checkWhopAccess(gate.whopUserId, gate.productId);
      if (!hasAccess) fail('NOT_ELIGIBLE', 'This challenge is for members of the creator’s Whop.');
    }
    return ctx.runMutation(internal.challenges.enterChallenge, args);
  },
});

export const joinGate = internalQuery({
  args: { deviceToken: v.string(), code: v.string() },
  handler: async (ctx, { deviceToken, code }) => {
    const c = await findByCode(ctx, code);
    if (!c || c.config.eligibility.kind !== 'whop_members') return null;
    if (await findEntry(ctx, c._id, deviceToken)) return null;
    const me = await resolveIdentity(ctx, deviceToken);
    return { productId: c.config.eligibility.productId, whopUserId: me.whopUserId ?? null };
  },
});

export const enterChallenge = internalMutation({
  args: { deviceToken: v.string(), code: v.string(), name: v.string() },
  handler: async (ctx, { deviceToken, code, name }) => {
    const c = await findByCode(ctx, code);
    if (!c || c.status === 'draft') fail('CHALLENGE_NOT_FOUND', 'No challenge with that code.');
    if (c.status === 'cancelled') fail('CHALLENGE_CANCELLED', c.cancelReason || 'The host cancelled this challenge.');
    const existing = await findEntry(ctx, c._id, deviceToken);
    if (existing) return { challengeId: c._id as string };
    const open = c.status === 'published' || (c.status === 'live' && (c.config.startMode === 'window' || c.config.teamFormation === 'mixer'));
    if (!open || (c.config.endsAt !== null && Date.now() >= c.config.endsAt)) fail('CHALLENGE_CLOSED', 'Entry is closed.');
    const me = await resolveIdentity(ctx, deviceToken);
    if (c.config.requireWhopToJoin && !me.whopUserId) fail('WHOP_SIGN_IN_REQUIRED', 'Sign in with Whop to join this challenge.');
    const clean = name.trim().slice(0, 24);
    if (!clean) fail('INVALID_CONFIG', 'Add your name.');
    await ctx.db.insert('challengeEntries', {
      challengeId: c._id,
      deviceToken,
      name: clean,
      joinedAt: Date.now(),
      waitingNextRound: false,
      ...(c.config.teamFormation === 'mixer' ? await mixerSeat(ctx, c) : {}),
    });
    if (c.config.teamFormation === 'dealt' && c.config.startMode === 'window') await formTeams(ctx, c, false);
    return { challengeId: c._id as string };
  },
});

export const leaveChallenge = mutation({
  args: { deviceToken: v.string(), challengeId: v.string() },
  handler: async (ctx, { deviceToken, challengeId }) => {
    const c = await getChallenge(ctx, challengeId);
    const mine = c ? await findEntry(ctx, c._id, deviceToken) : null;
    if (!mine) fail('NOT_ENTERED', 'You are not in this challenge.');
    if (mine.teamId) fail('CHALLENGE_CLOSED', 'Your team is already dealt.');
    await ctx.db.delete(mine._id);
  },
});

// ---------- Host console ----------

export const hostConsole = query({
  args: { deviceToken: v.string(), challengeId: v.string() },
  handler: async (ctx, { deviceToken, challengeId }): Promise<HostConsoleView | null> => {
    const c = await getChallenge(ctx, challengeId);
    if (!c || c.creatorToken !== (await resolveIdentity(ctx, deviceToken)).deviceToken) return null;
    const now = Date.now();
    const [summary, entries, teams, funding] = await Promise.all([
      summaryView(ctx, c),
      entriesOf(ctx, c._id),
      teamsOf(ctx, c._id),
      ctx.db.query('fundingLedger').withIndex('by_challenge', (q) => q.eq('challengeId', c._id)).first(),
    ]);
    const tv = c.config.teamFormation === 'mixer' ? await mixerTeamViews(ctx, c, entries) : await teamViews(ctx, c, teams, entries);
    const results: ChallengeResultRow[] = tv
      .filter((t) => t.place !== null)
      .sort((a, b) => a.place! - b.place!)
      .map((t) => ({ place: t.place!, teamLabel: t.label, memberNames: t.memberNames, finishMs: t.finishMs!, inMoney: t.place! <= paidPlaceCount(c.config.reward) }));
    const ended = c.status === 'ended';
    const pay = ended ? await previewFor(ctx, c) : null;
    const labelOf = new Map(teams.map((t) => [t._id, t.label]));
    return {
      ...summary,
      eligibility: eligibilityView(c.config),
      funding: funding
        ? { status: 'committed_concept', amountCents: funding.amountCents, committedAt: funding.committedAt, label: 'Concept funding — no real money is held' }
        : { status: 'none', amountCents: 0, committedAt: null, label: 'Not funded yet' },
      entrants: entries.map((e) => ({ name: e.name, joinedAt: e.joinedAt, teamLabel: e.teamId ? (labelOf.get(e.teamId) ?? null) : null, waitingNextRound: e.waitingNextRound })),
      teams: tv,
      results,
      serverNow: now,
      timeLeftMs: timeLeft(c, now),
      cancelReason: c.cancelReason ?? null,
      can: {
        deal: c.status === 'published' && c.config.startMode === 'live' && c.config.teamFormation === 'dealt',
        end: c.status === 'published' || c.status === 'live',
        cancel: c.status === 'published' || c.status === 'live',
        approvePayouts: ended && (pay?.rows.length ?? 0) === 0,
        clone: true,
      },
      payoutPreview: pay?.preview ?? null,
      payouts: (pay?.rows ?? []).map(rowView),
    };
  },
});

function rowView(r: Doc<'payouts'>): PayoutRowView {
  return {
    name: r.name,
    place: r.place,
    teamLabel: r.teamLabel,
    cents: r.cents,
    status: r.status,
    adapter: r.adapter,
    method: r.method ?? null,
    claimExpiresAt: r.status === 'claim_pending_whop' ? (r.claimExpiresAt ?? null) : null,
    error: r.error ?? null,
  };
}

export const dealTeams = mutation({
  args: { deviceToken: v.string(), challengeId: v.string() },
  handler: async (ctx, { deviceToken, challengeId }) => {
    const c = await requireOwned(ctx, deviceToken, challengeId);
    if (c.status !== 'published' || c.config.startMode !== 'live' || c.config.teamFormation !== 'dealt') {
      fail('CHALLENGE_CLOSED', 'Only an open live-mode challenge with dealt teams can be dealt.');
    }
    const waiting = (await entriesOf(ctx, c._id)).filter((e) => !e.teamId && !e.waitingNextRound).length;
    const minimum = c.config.leftover === 'smaller_teams' ? Math.min(2, c.config.teamSize) : c.config.teamSize;
    if (waiting < minimum) fail('NOT_ENOUGH_PLAYERS', 'Not enough players for a team yet.');
    await formTeams(ctx, c, true);
  },
});

export const endChallenge = mutation({
  args: { deviceToken: v.string(), challengeId: v.string() },
  handler: async (ctx, { deviceToken, challengeId }) => {
    const c = await requireOwned(ctx, deviceToken, challengeId);
    if (c.status !== 'published' && c.status !== 'live') fail('CHALLENGE_CLOSED', 'This challenge is not running.');
    await endNow(ctx, c);
  },
});

export const cancelChallenge = mutation({
  args: { deviceToken: v.string(), challengeId: v.string(), reason: v.string() },
  handler: async (ctx, { deviceToken, challengeId, reason }) => {
    const c = await requireOwned(ctx, deviceToken, challengeId);
    if (c.status !== 'published' && c.status !== 'live') fail('CHALLENGE_CLOSED', 'Only an open or running challenge can be cancelled.');
    const why = reason.trim().slice(0, 200);
    if (!why) fail('INVALID_CONFIG', 'Say why you are cancelling; entrants will see it.');
    await ctx.db.patch(c._id, { status: 'cancelled', cancelReason: why, endedAt: Date.now() });
  },
});

// ---------- Payout ledger ----------

const PAYOUT_LABELS = { concept: CONCEPT_LABEL, whop: 'Paid through Whop' } as const;

// A winning row whose device has a linked Whop account: pay it through the adapter.
async function settle(ctx: MutationCtx, row: Doc<'payouts'>, whopUserId: string) {
  const now = Date.now();
  if (row.adapter === 'concept') {
    await ctx.db.patch(row._id, { status: 'sent_concept', method: 'concept', whopUserId, updatedAt: now });
    return;
  }
  await ctx.db.patch(row._id, { status: 'approved', whopUserId, updatedAt: now });
  await ctx.scheduler.runAfter(0, internal.challenges.sendWhopPayout, { payoutId: row._id });
}

export const approvePayouts = mutation({
  args: { deviceToken: v.string(), challengeId: v.string() },
  handler: async (ctx, { deviceToken, challengeId }) => {
    const c = await requireOwned(ctx, deviceToken, challengeId);
    if (c.status !== 'ended') fail('CHALLENGE_CLOSED', 'Payouts are approved once the challenge has ended.');
    const { preview, finishers, rows } = await previewFor(ctx, c);
    if (rows.length) return { approved: 0, alreadyApproved: rows.length };
    const now = Date.now();
    const claimExpiresAt = now + c.config.claimWindowMs;
    let approved = 0;
    for (const line of preview.lines) {
      const team = finishers.find((f) => f.place === line.place)!;
      for (const [i, p] of line.players.entries()) {
        const entry = team.entries[i];
        const payoutId = await ctx.db.insert('payouts', {
          challengeId: c._id,
          place: line.place,
          teamLabel: line.teamLabel,
          playerIndex: i,
          deviceToken: entry.deviceToken,
          name: p.name,
          cents: p.cents,
          status: 'pending',
          adapter: c.config.payoutAdapter,
          idempotencyKey: c._id + ':' + line.place + ':' + i,
          updatedAt: now,
        });
        const me = await resolveIdentity(ctx, entry.deviceToken);
        if (me.whopUserId) await settle(ctx, (await ctx.db.get(payoutId))!, me.whopUserId);
        else await ctx.db.patch(payoutId, { status: 'claim_pending_whop', claimExpiresAt, updatedAt: now });
        approved++;
      }
    }
    await ctx.scheduler.runAt(claimExpiresAt, internal.challenges.expireClaims, { challengeId: c._id });
    return { approved, alreadyApproved: 0 };
  },
});

export const expireClaims = internalMutation({
  args: { challengeId: v.id('challenges') },
  handler: async (ctx, { challengeId }) => {
    const now = Date.now();
    for (const r of await payoutsOf(ctx, challengeId)) {
      if (r.status === 'claim_pending_whop' && (r.claimExpiresAt ?? 0) <= now) await ctx.db.patch(r._id, { status: 'expired', updatedAt: now });
    }
  },
});

async function payoutView(ctx: Ctx, row: Doc<'payouts'>): Promise<MyPayoutView> {
  const me = await resolveIdentity(ctx, row.deviceToken);
  return {
    place: row.place,
    teamLabel: row.teamLabel,
    cents: row.cents,
    status: row.status,
    adapter: row.adapter,
    method: row.method ?? null,
    claimUrl: row.claimUrl ?? null,
    claimExpiresAt: row.status === 'claim_pending_whop' ? (row.claimExpiresAt ?? null) : null,
    needsWhopSignIn: row.status === 'claim_pending_whop' && !me.whopUserId,
    label: row.status === 'expired' ? 'Unclaimed in time; the share went back to the pool.' : PAYOUT_LABELS[row.adapter],
  };
}

async function myRow(ctx: Ctx, challengeId: string, deviceToken: string) {
  const cid = asChallengeId(ctx, challengeId);
  return cid
    ? ctx.db.query('payouts').withIndex('by_challenge_token', (q) => q.eq('challengeId', cid).eq('deviceToken', deviceToken)).first()
    : null;
}

export const myPayout = query({
  args: { deviceToken: v.string(), challengeId: v.string() },
  handler: async (ctx, { deviceToken, challengeId }): Promise<MyPayoutView | null> => {
    const row = await myRow(ctx, challengeId, deviceToken);
    return row ? payoutView(ctx, row) : null;
  },
});

// The seat is tied to the device token that played it: only that device can claim, after signing in with Whop.
export const claimPayout = mutation({
  args: { deviceToken: v.string(), challengeId: v.string() },
  handler: async (ctx, { deviceToken, challengeId }): Promise<MyPayoutView> => {
    const row = await myRow(ctx, challengeId, deviceToken);
    if (!row) fail('NOT_ENTERED', 'You have no share in this challenge.');
    if (row.status === 'claim_pending_whop') {
      if ((row.claimExpiresAt ?? 0) <= Date.now()) {
        await ctx.db.patch(row._id, { status: 'expired', updatedAt: Date.now() });
        fail('CLAIM_EXPIRED', 'The claim window has closed.');
      }
      const me = await resolveIdentity(ctx, deviceToken);
      if (!me.whopUserId) fail('WHOP_SIGN_IN_REQUIRED', 'Sign in with Whop to claim your share.');
      await settle(ctx, row, me.whopUserId);
    } else if (row.status === 'expired') {
      fail('CLAIM_EXPIRED', 'The claim window has closed.');
    }
    return payoutView(ctx, (await ctx.db.get(row._id))!);
  },
});

export const payoutForSend = internalQuery({
  args: { payoutId: v.id('payouts') },
  handler: (ctx, { payoutId }) => ctx.db.get(payoutId),
});

export const recordSend = internalMutation({
  args: {
    payoutId: v.id('payouts'),
    status: v.union(v.literal('sent'), v.literal('failed')),
    method: v.optional(v.union(v.literal('transfer'), v.literal('claim_link'))),
    claimUrl: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, { payoutId, ...result }) => {
    const row = await ctx.db.get(payoutId);
    if (row?.status === 'approved') await ctx.db.patch(payoutId, { ...result, updatedAt: Date.now() });
  },
});

// whop adapter: a transfer from the platform account to the winner's Whop user, falling back to a one-claim claim
// link. Sandbox only; the row's idempotency key goes to Whop so a retry never pays twice.
export const sendWhopPayout = internalAction({
  args: { payoutId: v.id('payouts') },
  handler: async (ctx, { payoutId }) => {
    const row = await ctx.runQuery(internal.challenges.payoutForSend, { payoutId });
    if (!row || row.status !== 'approved' || !row.whopUserId) return;
    const message = (e: unknown) => (e instanceof ConvexError ? (e.data as { message?: string }).message : e instanceof Error ? e.message : 'unknown error');
    try {
      if (whopEnvironment() !== 'sandbox') throw new Error('Whop payouts only run against the sandbox.');
      await whopRequest('/transfers', {
        method: 'POST',
        headers: { 'Idempotency-Key': row.idempotencyKey },
        body: {
          amount: row.cents / 100,
          currency: 'usd',
          origin_id: process.env.WHOP_ACCOUNT_ID,
          destination_id: row.whopUserId,
          idempotence_key: row.idempotencyKey,
        },
      });
      await ctx.runMutation(internal.challenges.recordSend, { payoutId, status: 'sent', method: 'transfer' });
    } catch (transferError) {
      try {
        const link = await createSandboxClaimLink({ amountCents: row.cents, redeemableCount: 1, idempotencyKey: row.idempotencyKey + ':link' });
        await ctx.runMutation(internal.challenges.recordSend, { payoutId, status: 'sent', method: 'claim_link', claimUrl: link.claimUrl });
      } catch (linkError) {
        await ctx.runMutation(internal.challenges.recordSend, {
          payoutId,
          status: 'failed',
          error: 'transfer: ' + message(transferError) + '; claim link: ' + message(linkError),
        });
      }
    }
  },
});

// ---------- Standings ----------

const STAGES = ['briefing', 'investigating', 'locking_in', 'finished'] as const;

export const challengeStandings = query({
  args: { deviceToken: v.string(), challengeId: v.string() },
  handler: async (ctx, { deviceToken, challengeId }): Promise<ChallengeStandingsView | null> => {
    const c = await getChallenge(ctx, challengeId);
    if (!c || c.status === 'draft') return null;
    const [entries, teams] = await Promise.all([entriesOf(ctx, c._id), teamsOf(ctx, c._id)]);
    const mine = entries.find((e) => e.deviceToken === deviceToken)?.teamId;
    const rows = await Promise.all(
      teams.map(async (t) => {
        const room = await ctx.db.get(t.roomId);
        const locks = room
          ? (await ctx.db.query('lockIns').withIndex('by_room', (q) => q.eq('roomId', room._id)).collect()).filter((l) => l.revision === room.theory.revision)
          : [];
        const step = t.place !== undefined || room?.status === 'resolved' ? 3 : room?.status === 'playing' ? (locks.length ? 2 : 1) : 0;
        return {
          teamId: t._id as string,
          label: t.label,
          index: t.index,
          memberNames: entries.filter((e) => e.teamId === t._id).map((e) => e.name),
          rank: 0,
          place: t.place ?? null,
          progress: { stage: STAGES[step], step, steps: 3, lockedIn: locks.length, attempts: room?.attempts ?? 0 },
          finishedAt: t.finishedAt ?? null,
          finishMs: t.finishedAt !== undefined ? t.finishedAt - t.dealtAt : null,
          isMine: mine === t._id,
        };
      }),
    );
    rows.sort((a, b) => {
      if (a.place !== null || b.place !== null) return (a.place ?? Infinity) - (b.place ?? Infinity);
      return b.progress.step - a.progress.step || a.progress.attempts - b.progress.attempts || a.index - b.index;
    });
    return {
      challengeId: c._id,
      status: c.status,
      serverNow: Date.now(),
      endsAt: c.config.endsAt,
      paidPlaces: paidPlaceCount(c.config.reward),
      rows: rows.map(({ index: _index, ...r }, i) => ({ ...r, rank: i + 1 })),
    };
  },
});


// ---------- Mixer mode ----------

const MIXER_COOLDOWN_MS = 20_000;

const mixerTeamsOf = (ctx: Ctx, challengeId: Id<'challenges'>) =>
  ctx.db.query('mixerTeams').withIndex('by_challenge', (q) => q.eq('challengeId', challengeId)).collect();

// A new entrant's color (the least-held color, ties in the creator's order), player code and fragment seed.
async function mixerSeat(ctx: MutationCtx, c: Challenge) {
  const entries = await entriesOf(ctx, c._id);
  const held = (color: MixerColor) => entries.filter((e) => e.color === color).length;
  const color = [...c.config.mixerColors].sort((a, b) => held(a) - held(b) || c.config.mixerColors.indexOf(a) - c.config.mixerColors.indexOf(b))[0];
  const codes = new Set(entries.map((e) => e.playerCode));
  let playerCode = '';
  do {
    playerCode = '';
    for (let i = 0; i < 4; i++) playerCode += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  } while (codes.has(playerCode));
  const template = mixerTemplate(c.config.templateId);
  const secrets = new Set(entries.map((e) => fragmentOf(c, e)?.secret));
  let fragmentSeed = '';
  for (let salt = 0; !fragmentSeed || secrets.has(template.fragment(fragmentSeed, color, entries.length).secret); salt++) {
    const nonce = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
    fragmentSeed = c._id + ':' + entries.length + ':' + salt + ':' + nonce;
  }
  return { color, playerCode, fragmentSeed, confirmed: false };
}

function fragmentOf(c: Challenge, e: Doc<'challengeEntries'>) {
  if (!e.color || !e.fragmentSeed) return null;
  const index = Number(e.fragmentSeed.split(':')[1]);
  return mixerTemplate(c.config.templateId).fragment(e.fragmentSeed, e.color, index);
}

async function mixerTeamView(ctx: Ctx, team: Doc<'mixerTeams'>, colors: MixerColor[], meId: Id<'challengeEntries'> | null): Promise<MixerTeamView> {
  const members = (await Promise.all(team.memberIds.map((id) => ctx.db.get(id)))).filter((m) => m !== null);
  return {
    teamId: team._id,
    label: team.label,
    status: team.status,
    members: members.map((m) => ({ name: m.name, color: m.color!, playerCode: m.playerCode!, confirmed: !!m.confirmed, isMe: m._id === meId })),
    missingColors: colors.filter((col) => !members.some((m) => m.color === col)),
    attempts: team.attempts,
    cooldownUntil: team.cooldownUntil ?? null,
    place: team.place ?? null,
  };
}

async function mixerMe(ctx: Ctx, c: Challenge, me: Doc<'challengeEntries'>): Promise<MixerMeView | null> {
  const fragment = fragmentOf(c, me);
  if (!fragment) return null;
  const team = me.mixerTeamId ? await ctx.db.get(me.mixerTeamId) : null;
  return {
    color: me.color!,
    playerCode: me.playerCode!,
    fragment: { title: fragment.title, text: fragment.text },
    team: team ? await mixerTeamView(ctx, team, c.config.mixerColors, me._id) : null,
  };
}

async function mixerTeamViews(ctx: Ctx, c: Challenge, entries: Doc<'challengeEntries'>[]): Promise<ChallengeTeamView[]> {
  const byId = new Map(entries.map((e) => [e._id, e]));
  return (await mixerTeamsOf(ctx, c._id))
    .filter((t) => t.status !== 'forming')
    .map((t) => ({
      teamId: t._id,
      label: t.label,
      memberNames: t.memberIds.map((id) => byId.get(id)?.name ?? ''),
      status: t.place !== undefined ? 'finished' : c.status === 'ended' || c.status === 'cancelled' ? 'unfinished' : 'playing',
      place: t.place ?? null,
      finishedAt: t.solvedAt ?? null,
      finishMs: t.solvedAt !== undefined && t.lockedAt !== undefined ? t.solvedAt - t.lockedAt : null,
    }));
}

async function requireMixerEntry(ctx: MutationCtx, deviceToken: string, challengeId: string) {
  const c = await getChallenge(ctx, challengeId);
  if (!c) fail('CHALLENGE_NOT_FOUND', 'No such challenge.');
  if (c.config.teamFormation !== 'mixer') fail('WRONG_STATUS', 'This challenge deals its teams.');
  if (c.status === 'cancelled') fail('CHALLENGE_CANCELLED', c.cancelReason || 'The host cancelled this challenge.');
  if (c.status !== 'published' && c.status !== 'live') fail('CHALLENGE_CLOSED', 'This challenge is over.');
  const me = await findEntry(ctx, c._id, deviceToken);
  if (!me) fail('NOT_ENTERED', 'Join the challenge first.');
  return { c, me };
}

async function resetConfirmations(ctx: MutationCtx, memberIds: Id<'challengeEntries'>[]) {
  await Promise.all(memberIds.map((id) => ctx.db.patch(id, { confirmed: false })));
}

export const linkPlayer = mutation({
  args: { deviceToken: v.string(), challengeId: v.string(), playerCode: v.string() },
  handler: async (ctx, { deviceToken, challengeId, playerCode }): Promise<MixerTeamView> => {
    const { c, me } = await requireMixerEntry(ctx, deviceToken, challengeId);
    const code = playerCode.trim().toUpperCase();
    const other = (await entriesOf(ctx, c._id)).find((e) => e.playerCode === code);
    if (!other || other._id === me._id) fail('PLAYER_NOT_FOUND', other ? 'That is your own code.' : 'No player with that code here.');
    const [mine, theirs] = await Promise.all([me.mixerTeamId ? ctx.db.get(me.mixerTeamId) : null, other.mixerTeamId ? ctx.db.get(other.mixerTeamId) : null]);
    if (mine && theirs) {
      if (mine._id === theirs._id) return mixerTeamView(ctx, mine, c.config.mixerColors, me._id);
      fail('ALREADY_IN_TEAM', 'You are both already in teams. One of you has to leave first.');
    }
    const team = mine ?? theirs;
    const newcomer = mine ? other : me;
    if (team) {
      if (team.status !== 'forming') fail('TEAM_LOCKED', 'That team is locked.');
      const colors = await Promise.all(team.memberIds.map(async (id) => (await ctx.db.get(id))?.color));
      if (colors.includes(newcomer.color)) fail('DUPLICATE_COLOR', 'That team already has ' + newcomer.color + '.');
      const memberIds = [...team.memberIds, newcomer._id];
      await ctx.db.patch(team._id, { memberIds });
      await ctx.db.patch(newcomer._id, { mixerTeamId: team._id });
      await resetConfirmations(ctx, memberIds);
      return mixerTeamView(ctx, (await ctx.db.get(team._id))!, c.config.mixerColors, me._id);
    }
    if (me.color === other.color) fail('DUPLICATE_COLOR', 'You are both ' + me.color + '. A team needs one of each color.');
    const label = 'Team ' + ((await mixerTeamsOf(ctx, c._id)).length + 1);
    const teamId = await ctx.db.insert('mixerTeams', { challengeId: c._id, label, status: 'forming', memberIds: [me._id, other._id], attempts: 0 });
    await ctx.db.patch(me._id, { mixerTeamId: teamId, confirmed: false });
    await ctx.db.patch(other._id, { mixerTeamId: teamId, confirmed: false });
    return mixerTeamView(ctx, (await ctx.db.get(teamId))!, c.config.mixerColors, me._id);
  },
});

export const leaveMixerTeam = mutation({
  args: { deviceToken: v.string(), challengeId: v.string() },
  handler: async (ctx, { deviceToken, challengeId }) => {
    const { me } = await requireMixerEntry(ctx, deviceToken, challengeId);
    const team = me.mixerTeamId ? await ctx.db.get(me.mixerTeamId) : null;
    if (!team) fail('NOT_A_MEMBER', 'You are not in a team.');
    if (team.status !== 'forming') fail('TEAM_LOCKED', 'Your team is locked.');
    const memberIds = team.memberIds.filter((id) => id !== me._id);
    await ctx.db.patch(me._id, { mixerTeamId: undefined, confirmed: false });
    if (memberIds.length < 2) {
      await Promise.all(memberIds.map((id) => ctx.db.patch(id, { mixerTeamId: undefined, confirmed: false })));
      await ctx.db.delete(team._id);
      return;
    }
    await ctx.db.patch(team._id, { memberIds });
    await resetConfirmations(ctx, memberIds);
  },
});

export const confirmMixerTeam = mutation({
  args: { deviceToken: v.string(), challengeId: v.string() },
  handler: async (ctx, { deviceToken, challengeId }): Promise<MixerTeamView> => {
    const { c, me } = await requireMixerEntry(ctx, deviceToken, challengeId);
    const team = me.mixerTeamId ? await ctx.db.get(me.mixerTeamId) : null;
    if (!team) fail('NOT_A_MEMBER', 'You are not in a team.');
    if (team.status === 'forming') {
      const members = (await Promise.all(team.memberIds.map((id) => ctx.db.get(id)))).filter((m) => m !== null);
      if (!c.config.mixerColors.every((col) => members.some((m) => m.color === col))) fail('TEAM_NOT_FULL', 'Find one player of every color first.');
      await ctx.db.patch(me._id, { confirmed: true });
      if (members.every((m) => m._id === me._id || m.confirmed)) {
        const now = Date.now();
        await ctx.db.patch(team._id, { status: 'locked', lockedAt: now });
        if (c.status === 'published') await ctx.db.patch(c._id, { status: 'live', firstDealtAt: now });
      }
    }
    return mixerTeamView(ctx, (await ctx.db.get(team._id))!, c.config.mixerColors, me._id);
  },
});

// The answer is checked against the fragments of this team's own members, so a fragment from outside fails.
export const submitMixerAnswer = mutation({
  args: { deviceToken: v.string(), challengeId: v.string(), answer: v.string() },
  handler: async (ctx, { deviceToken, challengeId, answer }): Promise<MixerSubmitResult> => {
    const { c, me } = await requireMixerEntry(ctx, deviceToken, challengeId);
    const team = me.mixerTeamId ? await ctx.db.get(me.mixerTeamId) : null;
    if (!team || team.status === 'forming') fail('TEAM_NOT_LOCKED', 'Lock your team first.');
    if (team.status === 'solved') return { outcome: 'correct', place: team.place! };
    if (c.status !== 'live') fail('CHALLENGE_CLOSED', 'This challenge is not running.');
    const now = Date.now();
    if (team.cooldownUntil && now < team.cooldownUntil) fail('COOLDOWN', 'Wrong answers cost time. Talk it through.');
    const members = (await Promise.all(team.memberIds.map((id) => ctx.db.get(id)))).filter((m) => m !== null);
    const result = verifyMixerTeam(
      c.config.templateId,
      c.config.mixerColors,
      answer,
      members.map((m) => ({ color: m.color!, secret: fragmentOf(c, m)!.secret })),
    );
    if (!result.correct) {
      const attempts = team.attempts + 1;
      await ctx.db.patch(team._id, { attempts, cooldownUntil: now + MIXER_COOLDOWN_MS });
      return { outcome: 'wrong', attempts, cooldownUntil: now + MIXER_COOLDOWN_MS, nudge: result.nudge ?? null };
    }
    const place = c.finishedCount + 1;
    await ctx.db.patch(team._id, { status: 'solved', place, solvedAt: now });
    await ctx.db.patch(c._id, { finishedCount: place });
    if (place >= paidPlaceCount(c.config.reward)) await endNow(ctx, { ...c, finishedCount: place });
    return { outcome: 'correct', place };
  },
});

export const mixerStandings = query({
  args: { challengeId: v.string() },
  handler: async (ctx, { challengeId }): Promise<MixerStandingsView | null> => {
    const c = await getChallenge(ctx, challengeId);
    if (!c || c.status === 'draft' || c.config.teamFormation !== 'mixer') return null;
    const [entries, teams] = await Promise.all([entriesOf(ctx, c._id), mixerTeamsOf(ctx, c._id)]);
    const byId = new Map(entries.map((e) => [e._id, e]));
    return {
      challengeId: c._id,
      status: c.status,
      serverNow: Date.now(),
      endsAt: c.config.endsAt,
      colors: c.config.mixerColors,
      paidPlaces: paidPlaceCount(c.config.reward),
      entrantCount: entries.length,
      teamsForming: teams.filter((t) => t.status === 'forming').length,
      teamsLocked: teams.filter((t) => t.status === 'locked').length,
      solved: teams
        .filter((t) => t.status === 'solved')
        .sort((a, b) => a.place! - b.place!)
        .map((t) => ({
          place: t.place!,
          teamLabel: t.label,
          memberNames: t.memberIds.map((id) => byId.get(id)?.name ?? ''),
          solvedAt: t.solvedAt!,
          finishMs: t.solvedAt! - (t.lockedAt ?? t.solvedAt!),
        })),
      lookingByColor: c.config.mixerColors.map((color) => ({ color, count: entries.filter((e) => e.color === color && !e.mixerTeamId).length })),
    };
  },
});

// ---------- Recap ----------

export const challengeRecap = query({
  args: { challengeId: v.string() },
  handler: async (ctx, { challengeId }): Promise<ChallengeRecapView | null> => {
    const c = await getChallenge(ctx, challengeId);
    if (!c || (c.status !== 'ended' && c.status !== 'cancelled')) return null;
    const [creator, entries, teams] = await Promise.all([creatorOf(ctx, c.creatorToken), entriesOf(ctx, c._id), teamsOf(ctx, c._id)]);
    const { preview } = await previewFor(ctx, c);
    const tv = c.config.teamFormation === 'mixer' ? await mixerTeamViews(ctx, c, entries) : await teamViews(ctx, c, teams, entries);
    const finishMs = tv.map((t) => t.finishMs).filter((x): x is number => x !== null);
    return {
      challengeId: c._id,
      title: c.config.title,
      creator,
      templateId: c.config.templateId,
      status: c.status,
      endedAt: c.endedAt ?? c.createdAt,
      entrantCount: entries.length,
      teamCount: c.config.teamFormation === 'mixer' ? tv.length : teams.length,
      poolCents: c.config.poolCents,
      paidCents: c.status === 'cancelled' ? 0 : preview.paidCents,
      payoutAdapter: c.config.payoutAdapter,
      podium:
        c.status === 'cancelled'
          ? []
          : preview.lines.map((l) => {
              const t = tv.find((x) => x.label === l.teamLabel)!;
              const cents = l.players.filter((p) => p.status !== 'expired').reduce((s, p) => s + p.cents, 0);
              return { place: l.place, teamLabel: l.teamLabel, memberNames: t.memberNames, finishMs: t.finishMs ?? 0, inMoney: true, cents };
            }),
      fastestFinishMs: finishMs.length ? Math.min(...finishMs) : null,
    };
  },
});

export type ChallengeConfigValue = Infer<typeof challengeConfig>;
