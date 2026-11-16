import { v } from 'convex/values';

import type { Doc } from './_generated/dataModel';
import { query, type QueryCtx } from './_generated/server';
import { entriesOf, isChallengeOwner, paidPlaceCount } from './challenges';
import { resolveIdentity } from './creatorIdentity';
import { distinctFirstNames } from './feed';
import type { ChallengeGrowthView, CreatorStatsView } from '../src/lib/contract';

// Creator growth (CAP-43): read-only counts over #58's challenge records. Every read goes through an index on
// one challenge or one creator, and the views carry counts only: no device tokens, Whop ids, names or answers.

const HISTORY_LIMIT = 50;
const MAX_PLAYER_NAMES = 50;

async function growthOf(ctx: QueryCtx, c: Doc<'challenges'>) {
  const [entries, teams, mixerTeams, payouts] = await Promise.all([
    entriesOf(ctx, c._id),
    ctx.db.query('challengeTeams').withIndex('by_challenge', (q) => q.eq('challengeId', c._id)).collect(),
    ctx.db.query('mixerTeams').withIndex('by_challenge', (q) => q.eq('challengeId', c._id)).collect(),
    ctx.db.query('payouts').withIndex('by_challenge', (q) => q.eq('challengeId', c._id)).collect(),
  ]);
  const finished = [
    ...teams.filter((t) => t.place !== undefined).map((t) => ({ place: t.place!, size: t.size })),
    ...mixerTeams.filter((t) => t.place !== undefined).map((t) => ({ place: t.place!, size: t.memberIds.length })),
  ];
  const paidPlaces = paidPlaceCount(c.config.reward);
  const whopUsers = new Set(payouts.flatMap((r) => (r.whopUserId ? [r.whopUserId] : [])));
  const membersOnly = c.config.eligibility.kind === 'whop_members';
  if (membersOnly) {
    for (const me of await Promise.all(entries.map((e) => resolveIdentity(ctx, e.deviceToken)))) if (me.whopUserId) whopUsers.add(me.whopUserId);
  }
  const view: ChallengeGrowthView = {
    challengeId: c._id,
    title: c.config.title,
    templateId: c.config.templateId,
    status: c.status,
    createdAt: c.createdAt,
    endedAt: c.endedAt ?? null,
    players: entries.length,
    completions: finished.reduce((s, t) => s + t.size, 0),
    winners: c.status === 'cancelled' ? 0 : finished.filter((t) => t.place <= paidPlaces).reduce((s, t) => s + t.size, 0),
    paidCents: payouts.filter((r) => r.status === 'sent' || r.status === 'sent_concept').reduce((s, r) => s + r.cents, 0),
    payoutAdapter: c.config.payoutAdapter,
    newWhopMembers: membersOnly ? whopUsers.size : null,
  };
  return { view, whopUsers, entries };
}

export const challengeGrowth = query({
  args: { deviceToken: v.string(), challengeId: v.string() },
  handler: async (ctx, { deviceToken, challengeId }): Promise<ChallengeGrowthView | null> => {
    const id = ctx.db.normalizeId('challenges', challengeId);
    const c = id ? await ctx.db.get(id) : null;
    if (!c || c.status === 'draft') return null;
    if (!(await isChallengeOwner(ctx, c, deviceToken))) return null;
    const { view, entries } = await growthOf(ctx, c);
    const inOrder = [...entries].sort((a, b) => a.joinedAt - b.joinedAt);
    const playerNames = distinctFirstNames(inOrder.map((e) => e.name)).filter(Boolean).slice(0, MAX_PLAYER_NAMES);
    return { ...view, playerNames };
  },
});

export const creatorStats = query({
  args: { deviceToken: v.string() },
  handler: async (ctx, { deviceToken }): Promise<CreatorStatsView | null> => {
    const me = await resolveIdentity(ctx, deviceToken);
    const profile = await ctx.db.query('creators').withIndex('by_token', (q) => q.eq('deviceToken', me.deviceToken)).first();
    if (!profile) return null;
    const mine = await ctx.db
      .query('challenges')
      .withIndex('by_creator', (q) => q.eq('creatorToken', me.deviceToken))
      .order('desc')
      .take(HISTORY_LIMIT);
    const rows = await Promise.all(mine.filter((c) => c.status !== 'draft').map((c) => growthOf(ctx, c)));
    const challenges = rows.map((r) => r.view).sort((a, b) => b.createdAt - a.createdAt);
    const sum = (k: 'players' | 'completions' | 'winners' | 'paidCents') => challenges.reduce((s, c) => s + c[k], 0);
    return {
      challenges,
      totals: {
        challenges: challenges.length,
        players: sum('players'),
        completions: sum('completions'),
        winners: sum('winners'),
        paidCents: sum('paidCents'),
        newWhopMembers: new Set(rows.flatMap((r) => [...r.whopUsers])).size,
      },
    };
  },
});
