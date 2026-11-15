// The platform side of the template interface: the only code a room, drop or creator console calls. It knows
// nothing about any specific challenge type.
import { ConvexError, v } from 'convex/values';

import { findTemplate } from './registry';
import type { AnyTemplate, CheckResult, Outcome, Player, Team } from './types';

// One team's run of one template, stored as a single document field (state is a plain Convex value).
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
  if (!template.teamSizes.includes(team.length)) {
    fail('BAD_TEAM_SIZE', `${template.name} supports teams of ${template.teamSizes.join(', ')}.`);
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
  for (const size of template.teamSizes) {
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
