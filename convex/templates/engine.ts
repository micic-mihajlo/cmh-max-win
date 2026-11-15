// The platform side of the template interface: the only code a room, drop or creator console calls. It knows
// nothing about any specific challenge type.
import { ConvexError, v } from 'convex/values';

import { findTemplate } from './registry';
import {
  MAX_MIXER_COLORS,
  MAX_SQUAD_SIZE,
  MIN_MIXER_COLORS,
  MIN_SQUAD_SIZE,
  MIXER_COLORS,
  type AnyTemplate,
  type CheckResult,
  type ConfigIssue,
  type DealCtx,
  type Formation,
  type MixerColor,
  type MixerMember,
  type MixerSupport,
  type Outcome,
  type Player,
  type Progress,
  type Team,
  type VerifyResult,
} from './types';

export const DEFAULT_FORMATION: Formation = 'dealt';
export const formationValidator = v.union(v.literal('dealt'), v.literal('mixer'));
export const mixerColorValidator = v.union(...MIXER_COLORS.map((c) => v.literal(c)));

export function requireFormation(templateId: string, formation: Formation) {
  const template = requireTemplate(templateId);
  if (!template.formations.includes(formation)) {
    fail('FORMATION_UNSUPPORTED', `${template.name} supports ${template.formations.join(' and ')} teams.`);
  }
  return template;
}

// The one-line swap for CMHM-10's stand-in: mixerTemplate(templateId) returns { fragment, verify }.
export function mixerTemplate(templateId: string): MixerSupport {
  const template = requireFormation(templateId, 'mixer');
  return template.mixer ?? fail('FORMATION_UNSUPPORTED', `${template.name} has no mixer support.`);
}

// Validates the creator's color pick: 2–4 distinct colors.
export function mixerColors(colors: readonly string[]): MixerColor[] {
  const picked = colors.filter((c): c is MixerColor => (MIXER_COLORS as readonly string[]).includes(c));
  if (picked.length !== colors.length || new Set(picked).size !== picked.length || picked.length < MIN_MIXER_COLORS || picked.length > MAX_MIXER_COLORS) {
    fail('BAD_CONFIG', `Pick ${MIN_MIXER_COLORS}–${MAX_MIXER_COLORS} different colors from ${MIXER_COLORS.join(', ')}.`);
  }
  return picked;
}

// Round-robin color for the n-th player to join (0-based), so colors stay balanced.
export function colorForJoin(colors: readonly MixerColor[], joinIndex: number) {
  return colors[joinIndex % colors.length];
}

// Refuses a team that isn't exactly one member per color, then asks the template whether the answer matches those
// members' secrets. Call it with the locked team's stored { color, secret } only.
export function verifyMixerTeam(templateId: string, colors: readonly MixerColor[], answer: string, members: readonly MixerMember[]): VerifyResult {
  const mixer = mixerTemplate(templateId);
  const have = members.map((m) => m.color);
  if (have.length !== colors.length || colors.some((c) => !have.includes(c))) {
    fail('TEAM_INCOMPLETE', `A team needs exactly one player of each color: ${colors.join(', ')}.`);
  }
  return mixer.verify(answer, members);
}

// Mixer necessity: for 2–4 colors and every seed, the team's own answer passes, and replacing any one member with
// another player of the same color makes that answer fail. So nobody can solve without each real member, and a
// fragment borrowed from outside the team is useless.
export function checkMixerNecessity(template: AnyTemplate, answerFor: (members: MixerMember[]) => string, seeds: readonly string[]) {
  const mixer = template.mixer;
  if (!template.formations.includes('mixer') || !mixer) return { ok: false, violations: ['no mixer support'] };
  const violations: string[] = [];
  for (let n = MIN_MIXER_COLORS; n <= MAX_MIXER_COLORS; n++) {
    const colors = MIXER_COLORS.slice(0, n);
    for (const seed of seeds) {
      const team = colors.map((color, i) => ({ color, secret: mixer.fragment(`${seed}:a${i}`, color, i).secret }));
      const answer = answerFor(team);
      if (!mixer.verify(answer, team).correct) violations.push(`${n} colors seed ${seed}: the team's own answer fails`);
      colors.forEach((color, i) => {
        const stranger = { color, secret: mixer.fragment(`${seed}:b${i}`, color, n + i).secret };
        if (stranger.secret === team[i].secret) return;
        if (mixer.verify(answer, team.map((m, j) => (j === i ? stranger : m))).correct) {
          violations.push(`${n} colors seed ${seed}: the answer still works without the ${color} member`);
        }
      });
    }
  }
  return { ok: violations.length === 0, violations };
}

export function squadSizes(template: AnyTemplate): number[] {
  return template.teamSizes.filter((n: number) => n >= MIN_SQUAD_SIZE && n <= MAX_SQUAD_SIZE);
}

// One squad's run of one template, stored as a single document field (state is a plain Convex value).
export type Session<State = unknown> = { templateId: string; seed: string; players: Player[]; state: State };

function fail(code: string, message: string): never {
  throw new ConvexError({ code, message });
}

export function requireTemplate(templateId: string): AnyTemplate {
  return findTemplate(templateId) ?? fail('UNKNOWN_TEMPLATE', `No challenge template "${templateId}".`);
}

export function parseConfig(templateId: string, raw: unknown) {
  return requireTemplate(templateId).config.parse(raw);
}

// The publish check for creator content. Empty means publishable. Templates without an issues() list fall back
// to parse, reporting its first error.
export function publishIssues(templateId: string, raw: unknown): ConfigIssue[] {
  const { config } = requireTemplate(templateId);
  if (config.issues) return config.issues(raw);
  try {
    config.parse(raw);
    return [];
  } catch (e) {
    return [{ field: 'config', message: (e as { data?: { message?: string } }).data?.message ?? String(e) }];
  }
}

// Validator for the action arg of a generic "act" mutation: the union of the template's action shapes.
export function actionArgs(templateId: string) {
  const specs = Object.values(requireTemplate(templateId).actions) as { args: Parameters<typeof v.union>[number] }[];
  return specs.length === 1 ? specs[0].args : v.union(...specs.map((s) => s.args));
}

// ctx.now is the race start on the server clock (Date.now() in the dealing mutation).
export function startSession(templateId: string, team: Team, seed: string, rawConfig?: unknown, ctx: Partial<DealCtx> = {}) {
  const template = requireTemplate(templateId);
  if (!squadSizes(template).includes(team.length)) {
    fail('BAD_TEAM_SIZE', `${template.name} supports teams of ${template.teamSizes.join(', ')}.`);
  }
  if (new Set(team.map((p) => p.playerId)).size !== team.length) fail('BAD_TEAM', 'Duplicate player in team.');
  const { state, views } = template.deal(team, seed, template.config.parse(rawConfig), { now: ctx.now ?? 0 });
  const session: Session = { templateId, seed, players: team.map((p) => ({ playerId: p.playerId, name: p.name })), state };
  return { session, views };
}

// Validates and applies one player's action at server time now. Returns the new session and the check on the new
// state; throws a ConvexError { code, message } when the action is refused.
export function act(
  session: Session,
  playerId: string,
  action: { type: string; [key: string]: unknown },
  now = 0,
): { session: Session; result: CheckResult } {
  const template = requireTemplate(session.templateId);
  if (!session.players.some((p) => p.playerId === playerId)) fail('NOT_A_PLAYER', 'You are not on this team.');
  const spec = (template.actions as Record<string, AnyTemplate['actions'][string]>)[action.type];
  if (!spec) fail('UNKNOWN_ACTION', `Unknown action "${action.type}".`);
  const refused = spec.validate(session.state, playerId, action, { now });
  if (refused) fail(refused.code, refused.message);
  const state = template.apply(session.state, playerId, action, { now });
  return { session: { ...session, state }, result: template.check(state) };
}

// Timed templates: the server times at which this session must be ticked, and the tick itself. Schedule
// ctx.scheduler.runAt(t, ...) for each future time, then call tickSession(session, Date.now()) in that job.
export function wakeTimes(session: Session): number[] {
  return requireTemplate(session.templateId).wakeTimes?.(session.state) ?? [];
}

export function tickSession(session: Session, now: number): Session {
  const template = requireTemplate(session.templateId);
  return template.tick ? { ...session, state: template.tick(session.state, now) } : session;
}

// The host's Next button for host-paced templates. Call it on every team's session in one mutation with one now.
export function hostAdvance(session: Session, now: number): Session {
  const template = requireTemplate(session.templateId);
  if (!template.host) fail('NOT_HOST_PACED', `${template.name} has no host controls.`);
  return { ...session, state: template.host.advance(session.state, now) };
}

// The public board for an overlay, by challenge code: the round (from any team) and every team's row ranked by
// points. It takes team labels, never device tokens, and carries no open question's answers.
export function publicBoard(templateId: string, teams: readonly { label: string; session: Session }[]) {
  const template = requireTemplate(templateId);
  if (!template.board) fail('NO_BOARD', `${template.name} has no public board.`);
  const { board } = template;
  const rows = teams
    .map((t) => ({ label: t.label, ...board.team(t.session.state) }))
    .sort((a, b) => b.points - a.points || a.label.localeCompare(b.label))
    .map((row, i, all) => ({ ...row, rank: i > 0 && all[i - 1].points === row.points ? 0 : i + 1 }));
  for (let i = 1; i < rows.length; i++) if (rows[i].rank === 0) rows[i].rank = rows[i - 1].rank;
  return { round: teams.length ? board.round(teams[0].session.state) : null, rows };
}

export function pointsOf(session: Session): number {
  return requireTemplate(session.templateId).points?.(session.state) ?? 0;
}

export function checkSession(session: Session): CheckResult {
  return requireTemplate(session.templateId).check(session.state);
}

// Shared view for anyone on the team; mine is null for non-members so a query can return it as-is.
export function viewsFor(session: Session, playerId: string) {
  const template = requireTemplate(session.templateId);
  const member = session.players.some((p) => p.playerId === playerId);
  return { shared: template.sharedView(session.state), mine: member ? template.privateView(session.state, playerId) : null };
}

export function progressOf(session: Session): Progress {
  return requireTemplate(session.templateId).progress(session.state);
}

// Live standings for squads racing the same template: solved squads by rankKey, then unsolved by progress
// (highest first). CMHM-10's standings query can sort its rows with this and use the index as the live rank.
export function compareLive(templateId: string, a: { progress: Progress; outcome: Outcome }, b: { progress: Progress; outcome: Outcome }) {
  if (a.progress.solved !== b.progress.solved) return a.progress.solved ? -1 : 1;
  if (a.progress.solved) return compareOutcomes(templateId, a.outcome, b.outcome);
  return b.progress.value - a.progress.value;
}

export function score(templateId: string, outcome: Outcome) {
  return requireTemplate(templateId).scoring.score(outcome);
}

// Sort comparator for one template's leaderboard rows.
export function compareOutcomes(templateId: string, a: Outcome, b: Outcome) {
  const { rankKey } = requireTemplate(templateId).scoring;
  const ka = rankKey(a);
  const kb = rankKey(b);
  for (let i = 0; i < Math.max(ka.length, kb.length); i++) {
    const d = (ka[i] ?? 0) - (kb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

// Necessity self-check over every supported team size and the given seeds. Every template must be solvable by
// its whole team. A coop template must also not be solvable by any proper subset of the team.
export function checkNecessity(template: AnyTemplate, seeds: readonly string[], rawConfig?: unknown) {
  const config = template.config.parse(rawConfig);
  const violations: string[] = [];
  for (const size of squadSizes(template)) {
    const team: Team = Array.from({ length: size }, (_, i) => ({ playerId: `p${i + 1}`, name: `P${i + 1}` }));
    for (const seed of seeds) {
      const { state } = template.deal(team, seed, config, { now: 0 });
      const ids = team.map((p) => p.playerId);
      if (!template.necessity.solvableBy(state, ids)) violations.push(`size ${size} seed ${seed}: the full team cannot solve it`);
      if (template.mode !== 'coop') continue;
      for (let mask = 1; mask < (1 << size) - 1; mask++) {
        const subset = ids.filter((_, i) => mask & (1 << i));
        if (template.necessity.solvableBy(state, subset)) violations.push(`size ${size} seed ${seed}: {${subset.join(', ')}} can solve it alone`);
      }
    }
  }
  return { ok: violations.length === 0, violations };
}
