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
  type Formation,
  type MixerColor,
  type MixerFragment,
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

function requireMixer(templateId: string): MixerSupport {
  const template = requireFormation(templateId, 'mixer');
  return template.mixer ?? fail('FORMATION_UNSUPPORTED', `${template.name} has no mixer support.`);
}

// Validates the creator's color pick: 2–4 distinct colors, within the template's squad sizes.
export function mixerColors(templateId: string, colors: readonly string[]): MixerColor[] {
  const template = requireFormation(templateId, 'mixer');
  const picked = colors.filter((c): c is MixerColor => (MIXER_COLORS as readonly string[]).includes(c));
  const min = Math.max(MIN_MIXER_COLORS, template.minSquadSize);
  const max = Math.min(MAX_MIXER_COLORS, template.maxSquadSize);
  if (picked.length !== colors.length || new Set(picked).size !== picked.length || picked.length < min || picked.length > max) {
    fail('BAD_CONFIG', `Pick ${min}–${max} different colors from ${MIXER_COLORS.join(', ')}.`);
  }
  return picked;
}

// Round-robin color for the n-th player to join (0-based), so colors stay balanced.
export function colorForJoin(colors: readonly MixerColor[], joinIndex: number) {
  return colors[joinIndex % colors.length];
}

export function mixerClue(templateId: string, colors: readonly MixerColor[]) {
  return requireMixer(templateId).clue(colors);
}

// The joining player's private fragment. Seed it per player (`<dropId>:<playerId>`) so it is unique to them.
export function dealMixerFragment(templateId: string, colors: readonly MixerColor[], color: MixerColor, seed: string): MixerFragment {
  if (!colors.includes(color)) fail('BAD_CONFIG', `${color} is not a color in this challenge.`);
  return requireMixer(templateId).dealFragments(colors, seed)[color];
}

// Called from the link-and-lock flow. Refuses a team that isn't exactly one member per color, then asks the
// template whether the answer matches these members' fragments.
export function verifyMixerTeam(templateId: string, colors: readonly MixerColor[], answer: string, memberFragments: readonly MixerFragment[]): VerifyResult {
  const mixer = requireMixer(templateId);
  const have = memberFragments.map((f) => f.color);
  if (have.length !== colors.length || colors.some((c) => !have.includes(c))) {
    fail('TEAM_INCOMPLETE', `A team needs exactly one player of each color: ${colors.join(', ')}.`);
  }
  return mixer.verify(answer, memberFragments);
}

// Mixer necessity: for every color count and seed, the team's own answer passes, and replacing any one member
// with another player of the same color makes that answer fail. So no subset can solve without each real member,
// and a fragment borrowed from outside the team is useless.
export function checkMixerNecessity(template: AnyTemplate, answerFor: (fragments: MixerFragment[]) => string, seeds: readonly string[]) {
  const violations: string[] = [];
  const mixer = template.mixer;
  if (!template.formations.includes('mixer') || !mixer) return { ok: false, violations: ['no mixer support'] };
  const min = Math.max(MIN_MIXER_COLORS, template.minSquadSize);
  const max = Math.min(MAX_MIXER_COLORS, template.maxSquadSize);
  for (let n = min; n <= max; n++) {
    const colors = MIXER_COLORS.slice(0, n);
    for (const seed of seeds) {
      const team = colors.map((c, i) => mixer.dealFragments(colors, `${seed}:a${i}`)[c]);
      const answer = answerFor(team);
      if (!mixer.verify(answer, team).correct) violations.push(`${n} colors seed ${seed}: the team's own answer fails`);
      colors.forEach((c, i) => {
        const swapped = team.map((f, j) => (j === i ? mixer.dealFragments(colors, `${seed}:b${i}`)[c] : f));
        if (swapped[i].text !== team[i].text && mixer.verify(answer, swapped).correct) {
          violations.push(`${n} colors seed ${seed}: the answer still works without the ${c} member`);
        }
      });
    }
  }
  return { ok: violations.length === 0, violations };
}

export function squadSizes(template: AnyTemplate) {
  const min = Math.max(MIN_SQUAD_SIZE, template.minSquadSize);
  const max = Math.min(MAX_SQUAD_SIZE, template.maxSquadSize);
  return Array.from({ length: Math.max(0, max - min + 1) }, (_, i) => min + i);
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

// Validator for the action arg of a generic "act" mutation: the union of the template's action shapes.
export function actionArgs(templateId: string) {
  const specs = Object.values(requireTemplate(templateId).actions) as { args: Parameters<typeof v.union>[number] }[];
  return specs.length === 1 ? specs[0].args : v.union(...specs.map((s) => s.args));
}

export function startSession(templateId: string, team: Team, seed: string, rawConfig?: unknown) {
  const template = requireTemplate(templateId);
  if (!squadSizes(template).includes(team.length)) {
    fail('BAD_TEAM_SIZE', `${template.name} supports squads of ${template.minSquadSize}–${template.maxSquadSize}.`);
  }
  if (new Set(team.map((p) => p.playerId)).size !== team.length) fail('BAD_TEAM', 'Duplicate player in team.');
  const { state, views } = template.deal(team, seed, template.config.parse(rawConfig));
  const session: Session = { templateId, seed, players: team.map((p) => ({ playerId: p.playerId, name: p.name })), state };
  return { session, views };
}

// Validates and applies one player's action. Returns the new session and the check on the new state; throws a
// ConvexError { code, message } when the action is refused.
export function act(session: Session, playerId: string, action: { type: string; [key: string]: unknown }): { session: Session; result: CheckResult } {
  const template = requireTemplate(session.templateId);
  if (!session.players.some((p) => p.playerId === playerId)) fail('NOT_A_PLAYER', 'You are not on this team.');
  const spec = (template.actions as Record<string, AnyTemplate['actions'][string]>)[action.type];
  if (!spec) fail('UNKNOWN_ACTION', `Unknown action "${action.type}".`);
  const refused = spec.validate(session.state, playerId, action);
  if (refused) fail(refused.code, refused.message);
  const state = template.apply(session.state, playerId, action);
  return { session: { ...session, state }, result: template.check(state) };
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

// Necessity self-check over every supported squad size and the given seeds. Every template must be solvable by
// its whole team. A coop template must also not be solvable by any proper subset of the team.
export function checkNecessity(template: AnyTemplate, seeds: readonly string[], rawConfig?: unknown) {
  const config = template.config.parse(rawConfig);
  const violations: string[] = [];
  for (const size of squadSizes(template)) {
    const team: Team = Array.from({ length: size }, (_, i) => ({ playerId: `p${i + 1}`, name: `P${i + 1}` }));
    for (const seed of seeds) {
      const { state } = template.deal(team, seed, config);
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
