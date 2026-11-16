// Engine-session play for dealt templates that run on the template engine (convex/templates/engine.ts) instead
// of an Aurora room: today that's quick-quiz. One session per dealt team, started at the deal; placements come from
// the template's own ranking when play ends. No Convex functions live here, so challenges.ts and live.ts share it.
import type { Doc, Id } from './_generated/dataModel';
import type { MutationCtx, QueryCtx } from './_generated/server';
import { writePulse } from './roomPulse';
import { checkSession, compareOutcomes, pointsOf, startSession, type Session } from './templates/engine';
import { openQuestion, withAnswers, type QuizState } from './templates/quickQuiz';
import { findTemplate } from './templates/registry';

// Host-paced templates (host.advance) run on engine sessions; everything else dealt plays an Aurora room.
export const isSessionTemplate = (templateId: string) => !!findTemplate(templateId)?.host;

export const teamSessionsOf = (ctx: QueryCtx, challengeId: Id<'challenges'>) =>
  ctx.db.query('teamSessions').withIndex('by_challenge', (q) => q.eq('challengeId', challengeId)).collect();

// Per-player quiz play keeps each answer to the open question in its player's pulseLocks row, so teammates locking at
// once never write the same doc. This merges those rows into the sessions; the close (host advance or tick) saves them.
// Pass playerId to merge only that player's answer: a lock must not read its teammates' rows, or teammates locking
// at once would conflict on each other's inserts.
export async function withOpenAnswers(ctx: QueryCtx, c: Doc<'challenges'>, rows: Doc<'teamSessions'>[], playerId?: string): Promise<Session[]> {
  const sessions = rows.map((r) => r.session as Session<QuizState>);
  const i = c.config.templateId === 'quick-quiz' && sessions.length ? openQuestion(sessions[0].state) : null;
  if (i === null) return sessions;
  const locks = await ctx.db
    .query('pulseLocks')
    .withIndex('by_question', (q) => {
      const open = q.eq('challengeId', c._id).eq('questionIndex', i);
      if (rows.length !== 1) return open;
      return playerId === undefined ? open.eq('teamId', rows[0].teamId) : open.eq('teamId', rows[0].teamId).eq('playerId', playerId);
    })
    .collect();
  return rows.map((r, k) => {
    const answers = locks
      .filter((l) => l.teamId === r.teamId && l.choice !== undefined)
      .map((l) => ({ playerId: l.playerId, questionIndex: i, choice: l.choice!, at: l.lockedAt, points: l.points ?? 0 }));
    return { ...sessions[k], state: withAnswers(sessions[k].state, answers) };
  });
}

const challengeTeams = (ctx: QueryCtx, challengeId: Id<'challenges'>) =>
  ctx.db.query('challengeTeams').withIndex('by_challenge', (q) => q.eq('challengeId', challengeId)).collect();

// After a deal: an engine session for every team that has none yet. Players are entry ids, never device tokens.
export async function startTeamSessions(ctx: MutationCtx, c: Doc<'challenges'>, now: number) {
  const [teams, existing, entries] = await Promise.all([
    challengeTeams(ctx, c._id),
    teamSessionsOf(ctx, c._id),
    ctx.db.query('challengeEntries').withIndex('by_challenge', (q) => q.eq('challengeId', c._id)).collect(),
  ]);
  const started = new Set(existing.map((s) => s.teamId));
  for (const t of teams) {
    if (started.has(t._id)) continue;
    const players = entries
      .filter((e) => e.teamId === t._id)
      .sort((a, b) => a.joinedAt - b.joinedAt)
      .map((e) => ({ playerId: e._id as string, name: e.name }));
    const { session } = startSession(c.config.templateId, players, c._id + ':' + t.index, c.config.templateConfig, { now });
    await ctx.db.insert('teamSessions', { challengeId: c._id, teamId: t._id, label: t.label, session });
  }
  await writePulse(ctx, c);
}

// When play ends: place every team that scored, by the template's ranking (quick-quiz: most points, then the faster
// finish, then deal order). Places feed the placement payout like Aurora finishes do.
export async function placeTeamSessions(ctx: MutationCtx, c: Doc<'challenges'>, now: number) {
  const [rows, teams] = await Promise.all([teamSessionsOf(ctx, c._id), challengeTeams(ctx, c._id)]);
  const byId = new Map(teams.map((t) => [t._id, t]));
  const ranked = rows
    .map((r) => {
      const t = byId.get(r.teamId)!;
      const finishedAt = r.finishedAt ?? now;
      return { t, finishedAt, outcome: { correct: checkSession(r.session).correct, attempts: 0, solveMs: finishedAt - t.dealtAt, commitSeq: t.index, points: pointsOf(r.session) } };
    })
    .filter((x) => x.outcome.correct)
    .sort((a, b) => compareOutcomes(c.config.templateId, a.outcome, b.outcome));
  for (const [i, x] of ranked.entries()) await ctx.db.patch(x.t._id, { place: i + 1, finishedAt: x.finishedAt });
  await ctx.db.patch(c._id, { finishedCount: ranked.length });
}
