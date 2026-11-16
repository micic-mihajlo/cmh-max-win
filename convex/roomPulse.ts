// Room pulse (CAP-82): one denormalized doc per engine-session challenge (roomPulses), rewritten only at the deal,
// each question advance and each reveal, plus one small pulseLocks row per player lock. A lock never writes a shared
// doc, so 50 teams locking in the same second don't conflict, and the live:roomPulse query is a few point reads
// and one range read of at most one row per player. A team is locked once every member has locked. Lobby head count
// is sharded by device token for the same reason joins hash their seats (hardening.ts). No Convex functions live here.
import type { Doc, Id } from './_generated/dataModel';
import type { MutationCtx, QueryCtx } from './_generated/server';
import { hash } from './hardening';
import { questionCorrect, type QuizState } from './templates/quickQuiz';
import type { RoomPulsePhase } from '../src/lib/contract-pulse';

const JOIN_SHARDS = 16;

type Challenge = Doc<'challenges'>;
export type PulseSnapshot = Omit<Doc<'roomPulses'>, '_id' | '_creationTime' | 'challengeId'>;

export const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? '';

export const pulseOf = (ctx: QueryCtx, challengeId: Id<'challenges'>) =>
  ctx.db.query('roomPulses').withIndex('by_challenge', (q) => q.eq('challengeId', challengeId)).unique();

// Per team: how many members have locked this question and when the latest did.
export async function locksOf(ctx: QueryCtx, challengeId: Id<'challenges'>, questionIndex: number) {
  const rows = await ctx.db.query('pulseLocks').withIndex('by_question', (q) => q.eq('challengeId', challengeId).eq('questionIndex', questionIndex)).collect();
  const byTeam = new Map<string, { count: number; last: number }>();
  for (const r of rows) {
    const t = byTeam.get(r.teamId) ?? { count: 0, last: 0 };
    byTeam.set(r.teamId, { count: t.count + 1, last: Math.max(t.last, r.lockedAt) });
  }
  return byTeam;
}

export async function joinedOf(ctx: QueryCtx, challengeId: Id<'challenges'>) {
  const shards = await ctx.db.query('pulseJoinShards').withIndex('by_challenge', (q) => q.eq('challengeId', challengeId)).collect();
  return shards.reduce((sum, s) => sum + s.joined, 0);
}

// Call after an entry is inserted (+1) or deleted (-1).
export async function countJoin(ctx: MutationCtx, challengeId: Id<'challenges'>, deviceToken: string, delta: 1 | -1) {
  const shard = hash(deviceToken) % JOIN_SHARDS;
  const row = await ctx.db.query('pulseJoinShards').withIndex('by_challenge', (q) => q.eq('challengeId', challengeId).eq('shard', shard)).unique();
  if (row) await ctx.db.patch(row._id, { joined: Math.max(0, row.joined + delta) });
  else if (delta > 0) await ctx.db.insert('pulseJoinShards', { challengeId, shard, joined: 1 });
}

// The round from any team's quiz state; correctness only for a closed question.
function quizRound(state: QuizState): { phase: RoomPulsePhase; questionIndex: number | null; deadline: number | null } {
  if (state.opened === 0) return { phase: 'lobby', questionIndex: null, deadline: null };
  const questionIndex = state.opened - 1;
  const phase = state.closed === state.questions.length ? 'finished' : state.opened > state.closed ? 'question' : 'reveal';
  return { phase, questionIndex, deadline: state.questions[questionIndex].closesAt };
}

// The pulse from the base tables: every team, its members and (quick-quiz) its session.
export async function snapshotOf(ctx: QueryCtx, c: Challenge): Promise<PulseSnapshot> {
  const [teams, entries, sessions] = await Promise.all([
    ctx.db.query('challengeTeams').withIndex('by_challenge', (q) => q.eq('challengeId', c._id)).collect(),
    ctx.db.query('challengeEntries').withIndex('by_challenge', (q) => q.eq('challengeId', c._id)).collect(),
    ctx.db.query('teamSessions').withIndex('by_challenge', (q) => q.eq('challengeId', c._id)).collect(),
  ]);
  const stateOf = new Map(sessions.map((s) => [s.teamId as string, (s.session as { state: QuizState }).state]));
  const quiz = c.config.templateId === 'quick-quiz' ? (sessions[0]?.session as { state: QuizState } | undefined)?.state : undefined;
  const round = quiz
    ? quizRound(quiz)
    : c.status === 'published'
      ? { phase: 'lobby' as const, questionIndex: null, deadline: null }
      : { phase: 'question' as const, questionIndex: 0, deadline: c.config.endsAt };
  const questionCount = quiz ? quiz.questions.length : ((c.config.templateConfig as { questions?: unknown[] } | undefined)?.questions?.length ?? 1);
  return {
    joined: entries.length,
    ...round,
    questionCount,
    teams: teams.map((t) => {
      const state = stateOf.get(t._id);
      const members = entries.filter((e) => e.teamId === t._id).sort((a, b) => a.joinedAt - b.joinedAt);
      return {
        id: t._id,
        label: t.label,
        memberFirstNames: members.map((e) => firstName(e.name)),
        // Locks a team needs: every member in per-player play, one for sessions dealt before it.
        memberCount: state && !state.byPlayer ? 1 : members.length,
        correct: state && round.questionIndex !== null ? questionCorrect(state, round.questionIndex) : null,
      };
    }),
  };
}

// Rewrites the challenge's pulse doc; a no-op when nothing changed, so a duplicate tick wakes no subscriber.
export async function writePulse(ctx: MutationCtx, c: Challenge) {
  const [next, existing] = await Promise.all([snapshotOf(ctx, c), pulseOf(ctx, c._id)]);
  if (!existing) return void (await ctx.db.insert('roomPulses', { challengeId: c._id, ...next }));
  const { _id, _creationTime, challengeId, ...current } = existing;
  if (JSON.stringify(current) !== JSON.stringify(next)) await ctx.db.replace(_id, { challengeId, ...next });
}
