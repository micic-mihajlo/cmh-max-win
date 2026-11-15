/// <reference types="vite/client" />
import presenceTest from '@convex-dev/presence/test';
import { convexTest } from 'convex-test';
import { convexToJson, jsonToConvex } from 'convex/values';
import { describe, expect, test } from 'vitest';

import { PIECES } from '../aurora';
import { dealPieces } from '../drops';
import schema from '../schema';
import { auroraTemplate, type AuroraState } from './aurora';
import {
  act,
  actionArgs,
  checkNecessity,
  checkSession,
  checkMixerNecessity,
  colorForJoin,
  compareLive,
  compareOutcomes,
  mixerColors,
  mixerTemplate,
  requireFormation,
  verifyMixerTeam,
  progressOf,
  squadSizes,
  startSession,
  viewsFor,
  type Session,
} from './engine';
import { findTemplate, listTemplates, TEMPLATES } from './registry';
import { splitCodeTemplate, type SplitCodeState } from './splitCode';
import {
  MAX_SQUAD_SIZE,
  MIN_SQUAD_SIZE,
  MIXER_COLORS,
  type AnyTemplate,
  type MixerColor,
  type MixerMember,
  type Outcome,
  type Progress,
  type Team,
} from './types';

const modules = import.meta.glob('../**/*.ts');
// The per-player-secret templates; quick-quiz has its own suite in quickQuiz.test.ts.
const SECRET_TEMPLATES = [auroraTemplate, splitCodeTemplate];
const SEEDS = Array.from({ length: 40 }, (_, i) => `drop-${i}:${i % 5}`);
const team = (n: number): Team => Array.from({ length: n }, (_, i) => ({ playerId: `p${i + 1}`, name: ['Kit', 'Lou', 'Max', 'Ada'][i] }));

async function errorCode(fn: () => unknown) {
  try {
    await fn();
  } catch (e) {
    return (e as { data?: { code?: string } }).data?.code;
  }
  throw new Error('expected the call to fail');
}

// A broken co-op template: identical to split code, except seat 1 is dealt the whole passphrase.
const leakySplitCode: AnyTemplate = {
  ...splitCodeTemplate,
  id: 'leaky-split-code',
  deal(t, seed, config, ctx) {
    const { state } = splitCodeTemplate.deal(t, seed, config, ctx);
    const rigged: SplitCodeState = { ...state, holders: state.holders.map(() => t[0].playerId) };
    return { state: rigged, views: Object.fromEntries(t.map((p) => [p.playerId, splitCodeTemplate.privateView(rigged, p.playerId)])) };
  },
};

function play(session: Session, steps: [string, { type: string; [k: string]: unknown }][]) {
  let s = session;
  const results = [];
  for (const [player, action] of steps) {
    const out = act(s, player, action);
    s = out.session;
    results.push(out.result);
  }
  return { session: s, results };
}

describe('registry', () => {
  test('lists both templates with unique ids', () => {
    expect(listTemplates().map((t) => t.id)).toEqual(['quick-quiz', 'split-passphrase', 'mystery-aurora']);
    expect(new Set(TEMPLATES.map((t) => t.id)).size).toBe(TEMPLATES.length);
    expect(findTemplate('mystery-aurora')).toBe(auroraTemplate);
    expect(findTemplate('nope')).toBeNull();
  });

  test('refuses unknown templates, team sizes and configs', async () => {
    expect(await errorCode(() => startSession('nope', team(2), 's'))).toBe('UNKNOWN_TEMPLATE');
    expect(await errorCode(() => startSession('mystery-aurora', team(5), 's'))).toBe('BAD_TEAM_SIZE');
    expect(await errorCode(() => startSession('split-passphrase', team(3), 's', { wordCount: 9 }))).toBe('BAD_CONFIG');
    expect(await errorCode(() => startSession('split-passphrase', team(4), 's', { wordCount: 3 }))).toBe('BAD_CONFIG');
    expect(actionArgs('mystery-aurora').kind).toBe('union');
  });
});

describe('squad sizes', () => {
  test('every template declares sizes within 1–4', () => {
    for (const t of TEMPLATES) {
      expect(t.teamSizes.length).toBeGreaterThan(0);
      for (const n of t.teamSizes) expect(n >= MIN_SQUAD_SIZE && n <= MAX_SQUAD_SIZE).toBe(true);
    }
    expect(squadSizes(auroraTemplate)).toEqual([1, 2, 3, 4]);
    expect(squadSizes(splitCodeTemplate)).toEqual([1, 2, 3, 4]);
  });

  test('split code: a solo player holds every word, bigger squads split them with nobody empty-handed', async () => {
    for (const size of [1, 2, 3, 4]) {
      for (const seed of SEEDS) {
        const { session, views } = startSession('split-passphrase', team(size), seed);
        const counts = session.players.map((p) => (views[p.playerId] as { fragments: unknown[] }).fragments.length);
        expect(counts.reduce((a, b) => a + b, 0)).toBe(4);
        expect(Math.min(...counts)).toBeGreaterThan(0);
      }
    }
    expect(await errorCode(() => startSession('split-passphrase', team(5), 'x'))).toBe('BAD_TEAM_SIZE');
  });
});

describe('necessity', () => {
  test('aurora: no single player or subset can solve it alone at 2 and 3; at 4 only the copied seat is redundant', () => {
    const { violations } = checkNecessity(auroraTemplate, SEEDS);
    expect(violations.filter((v) => !v.startsWith('size 4 '))).toEqual([]);
    // The fourth seat copies the first piece, so dropping either of those two still leaves all three pieces.
    expect(violations.filter((v) => v.startsWith('size 4 seed drop-0:0')).sort()).toEqual([
      'size 4 seed drop-0:0: {p1, p2, p3} can solve it alone',
      'size 4 seed drop-0:0: {p2, p3, p4} can solve it alone',
    ]);
  });

  test('aurora: solo holds all three pieces, and a fourth player holds a copy of the first', () => {
    const solo = startSession('mystery-aurora', team(1), 'd1:0').session.state as AuroraState;
    expect([...solo.seats[0].roles].sort()).toEqual(['detective', 'hacker', 'witness']);
    const four = startSession('mystery-aurora', team(4), 'd1:0').session.state as AuroraState;
    expect(four.seats[3].roles).toEqual(four.seats[0].roles);
    expect(four.seats.slice(0, 3).map((s) => s.roles)).toEqual(dealPieces('d1', 0, 3));
  });

  test('split code: holds for every word count', () => {
    for (const wordCount of [4, 5, 8]) expect(checkNecessity(splitCodeTemplate, SEEDS, { wordCount })).toEqual({ ok: true, violations: [] });
  });

  test('fails for a broken template that deals one player everything', () => {
    const { ok, violations } = checkNecessity(leakySplitCode, SEEDS.slice(0, 3));
    expect(ok).toBe(false);
    expect(violations).toContain('size 2 seed drop-0:0: {p1} can solve it alone');
  });

  test('fails for a template whose full team cannot solve it', () => {
    const hopeless: AnyTemplate = { ...auroraTemplate, id: 'hopeless', necessity: { solvableBy: () => false } };
    expect(checkNecessity(hopeless, ['x']).violations).toEqual([1, 2, 3, 4].map((n) => `size ${n} seed x: the full team cannot solve it`));
  });
});

// Every private string a player holds, keyed by playerId. Views are matched against them as whole JSON strings.
function secrets(templateId: string, session: Session): Record<string, string[]> {
  if (templateId === 'mystery-aurora') {
    const state = session.state as AuroraState;
    return Object.fromEntries(state.seats.map((s) => [s.playerId, s.roles.flatMap((r) => PIECES[r].lines.map((l) => l.text))]));
  }
  const state = session.state as SplitCodeState;
  return Object.fromEntries(session.players.map((p) => [p.playerId, state.words.filter((_, i) => state.holders[i] === p.playerId)]));
}

describe('private views never leak', () => {
  for (const template of SECRET_TEMPLATES) {
    test(`${template.id}: no player's view or the shared view carries another player's pieces`, () => {
      for (const size of squadSizes(template)) {
        for (const seed of SEEDS) {
          const { session, views } = startSession(template.id, team(size), seed);
          const held = secrets(template.id, session);
          const shared = JSON.stringify(viewsFor(session, 'p1').shared);
          for (const [owner, texts] of Object.entries(held)) {
            expect(texts.length).toBeGreaterThan(0);
            for (const secret of texts) {
              const text = JSON.stringify(secret);
              expect(shared).not.toContain(text);
              const others = session.players.map((p) => p.playerId).filter((id) => id !== owner && !held[id].includes(secret));
              for (const viewer of others) {
                expect(JSON.stringify(views[viewer])).not.toContain(text);
                expect(JSON.stringify(viewsFor(session, viewer).mine)).not.toContain(text);
              }
              expect(JSON.stringify(views[owner])).toContain(text);
            }
          }
          expect(viewsFor(session, 'stranger').mine).toBeNull();
        }
      }
    });
  }

  test('aurora: a wrong lock-in nudges by name without revealing pieces or the answer', () => {
    for (const seed of SEEDS) {
      const { session } = startSession('mystery-aurora', team(2), seed);
      const { session: after, results } = play(session, [
        ['p1', { type: 'setTheory', culprit: 'theo' }],
        ['p1', { type: 'lockIn', revision: 1 }],
        ['p2', { type: 'lockIn', revision: 1 }],
      ]);
      const shared = JSON.stringify(viewsFor(after, 'p1').shared) + JSON.stringify(results);
      for (const texts of Object.values(secrets('mystery-aurora', after))) for (const text of texts) expect(shared).not.toContain(JSON.stringify(text));
      for (const leak of ['Jun took', 'galley oven', 'Nobody could place Jun']) expect(shared).not.toContain(leak);
    }
  });
});

describe('determinism', () => {
  for (const template of SECRET_TEMPLATES) {
    test(`${template.id}: same seed, same deal; check() is pure and repeatable`, () => {
      for (const seed of SEEDS) {
        const a = startSession(template.id, team(2), seed);
        const b = startSession(template.id, team(2), seed);
        expect(a).toEqual(b);
        const frozen = structuredClone(a.session.state);
        const first = checkSession(a.session);
        for (let i = 0; i < 5; i++) expect(checkSession({ ...a.session, state: structuredClone(frozen) })).toEqual(first);
        expect(jsonToConvex(convexToJson(a.session.state as never))).toEqual(a.session.state);
      }
    });
  }

  test('seeds actually vary the deal', () => {
    const aurora = new Set(SEEDS.map((s) => JSON.stringify((startSession('mystery-aurora', team(2), s).session.state as AuroraState).seats.map((x) => x.roles))));
    const split = new Set(SEEDS.map((s) => (startSession('split-passphrase', team(2), s).session.state as SplitCodeState).words.join(' ')));
    expect(aurora.size).toBe(3);
    expect(split.size).toBeGreaterThan(30);
  });

  test('apply never mutates its input', () => {
    const { session } = startSession('split-passphrase', team(2), 'x');
    const before = structuredClone(session);
    act(session, 'p1', { type: 'enter', position: 0, word: 'amber' });
    expect(session).toEqual(before);
  });

  test('aurora adapter deals the same hands as drops.dealPieces', () => {
    for (let i = 0; i < 12; i++) {
      for (const size of [2, 3] as const) {
        const state = startSession('mystery-aurora', team(size), `d1:${i}`).session.state as AuroraState;
        expect(state.seats.map((s) => s.roles)).toEqual(dealPieces('d1', i, size));
      }
    }
  });

  test('a full playthrough inside a Convex mutation gives the same result every run', async () => {
    const t = convexTest(schema, modules);
    presenceTest.register(t);
    const run = () =>
      t.run(async () => {
        const { session } = startSession('split-passphrase', team(3), 'drop-7:2');
        const state = session.state as SplitCodeState;
        const steps: [string, { type: string; [k: string]: unknown }][] = state.words.map((w, i) => ['p1', { type: 'enter', position: i, word: i === 0 ? 'wrong' : w }]);
        let { session: s, results } = play(session, steps);
        ({ session: s, results } = play(s, session.players.map((p) => [p.playerId, { type: 'confirm', revision: state.words.length }])));
        const wrong = results.at(-1)!;
        ({ session: s, results } = play(s, [['p2', { type: 'enter', position: 0, word: state.words[0] }]]));
        const revision = (s.state as SplitCodeState).revision;
        ({ session: s, results } = play(s, session.players.map((p) => [p.playerId, { type: 'confirm', revision }])));
        return { wrong, final: results.at(-1)!, attempts: (s.state as SplitCodeState).attempts };
      });
    const first = await run();
    expect(first.wrong.solved).toBe(true);
    expect(first.wrong.correct).toBe(false);
    expect(first.final).toEqual({ solved: true, correct: true });
    expect(first.attempts).toBe(2);
    expect(await run()).toEqual(first);
  });
});

describe('aurora rules', () => {
  test('wrong pick nudges the piece holder, the right pick reveals with credits', () => {
    const { session } = startSession('mystery-aurora', team(3), 'd1:0');
    const seats = (session.state as AuroraState).seats;
    const theoHolder = seats.find((s) => s.roles.includes('hacker'))!;
    let { session: s, results } = play(session, [
      ['p1', { type: 'setTheory', culprit: 'theo' }],
      ['p1', { type: 'lockIn', revision: 1 }],
      ['p2', { type: 'lockIn', revision: 1 }],
    ]);
    expect(results.at(-1)).toEqual({ solved: false, correct: false });
    ({ session: s, results } = play(s, [['p3', { type: 'lockIn', revision: 1 }]]));
    expect(results[0]).toEqual({
      solved: true,
      correct: false,
      nudge: { text: `Not Theo. Ask ${theoHolder.name} to read the Camera Log.`, holderId: theoHolder.playerId },
    });
    expect(viewsFor(s, theoHolder.playerId).mine).toMatchObject({ ownNudge: 'Not Theo. Your Camera Log places him at the docking ring.' });
    expect(viewsFor(s, seats.find((x) => x !== theoHolder)!.playerId).mine).toMatchObject({ ownNudge: null });
    ({ session: s, results } = play(s, [
      ['p2', { type: 'setTheory', culprit: 'jun' }],
      ['p1', { type: 'lockIn', revision: 2 }],
      ['p2', { type: 'lockIn', revision: 2 }],
      ['p3', { type: 'lockIn', revision: 2 }],
    ]));
    expect(results.at(-1)).toEqual({ solved: true, correct: true });
    const shared = viewsFor(s, 'p1').shared as ReturnType<typeof auroraTemplate.sharedView>;
    expect(shared.reveal?.headline).toBe('Jun took the seed.');
    expect(shared.reveal?.credits[0]).toBe(`${theoHolder.name}'s Camera Log placed Theo at the docking ring.`);
    expect(shared.attempts).toBe(2);
  });

  test('refusals', async () => {
    const { session } = startSession('mystery-aurora', team(2), 'x');
    expect(await errorCode(() => act(session, 'p1', { type: 'lockIn', revision: 0 }))).toBe('NO_THEORY');
    const { session: s } = play(session, [['p1', { type: 'setTheory', culprit: 'ines' }]]);
    expect(await errorCode(() => act(s, 'p1', { type: 'lockIn', revision: 0 }))).toBe('STALE_REVISION');
    expect(await errorCode(() => act(s, 'p9', { type: 'lockIn', revision: 1 }))).toBe('NOT_A_PLAYER');
    expect(await errorCode(() => act(s, 'p1', { type: 'dance' }))).toBe('UNKNOWN_ACTION');
    const { session: checked } = play(s, [
      ['p1', { type: 'lockIn', revision: 1 }],
      ['p2', { type: 'lockIn', revision: 1 }],
    ]);
    expect(await errorCode(() => act(checked, 'p1', { type: 'lockIn', revision: 1 }))).toBe('ALREADY_CHECKED');
  });
});

describe('split code rules', () => {
  test('refusals', async () => {
    const { session } = startSession('split-passphrase', team(2), 'x', { wordCount: 2 });
    expect(await errorCode(() => act(session, 'p1', { type: 'confirm', revision: 0 }))).toBe('INCOMPLETE');
    expect(await errorCode(() => act(session, 'p1', { type: 'enter', position: 2, word: 'a' }))).toBe('BAD_POSITION');
    expect(await errorCode(() => act(session, 'p1', { type: 'confirm', revision: 3 }))).toBe('STALE_REVISION');
  });

  test('entering normalizes case and whitespace', () => {
    const { session } = startSession('split-passphrase', team(2), 'x', { wordCount: 2 });
    const words = (session.state as SplitCodeState).words;
    const { session: s, results } = play(session, [
      ['p1', { type: 'enter', position: 0, word: `  ${words[0].toUpperCase()} ` }],
      ['p2', { type: 'enter', position: 1, word: words[1] }],
      ['p1', { type: 'confirm', revision: 2 }],
      ['p2', { type: 'confirm', revision: 2 }],
    ]);
    expect(results.at(-1)).toEqual({ solved: true, correct: true });
    expect(viewsFor(s, 'p1').shared).toMatchObject({ attempts: 1, slots: words });
  });
});

describe('progress for live standings', () => {
  const values = (ps: Progress[]) => ps.map((p) => p.value);

  test('split code: climbs as slots fill and confirm, hits 1 only when solved, and never tells right from wrong', () => {
    const { session } = startSession('split-passphrase', team(2), 'race', { wordCount: 2 });
    const words = (session.state as SplitCodeState).words;
    const trail: Progress[] = [progressOf(session)];
    let s = session;
    for (const step of [
      ['p1', { type: 'enter', position: 0, word: words[0] }],
      ['p2', { type: 'enter', position: 1, word: 'wrong' }],
      ['p1', { type: 'confirm', revision: 2 }],
    ] as const) {
      s = act(s, step[0], step[1]).session;
      trail.push(progressOf(s));
    }
    expect(values(trail)).toEqual([0, 0.4, 0.8, 0.875]);
    expect(trail.map((p) => p.stage)).toEqual(['filling', 'filling', 'filling', 'confirming']);
    const rightWords = play(session, [
      ['p1', { type: 'enter', position: 0, word: words[0] }],
      ['p2', { type: 'enter', position: 1, word: words[1] }],
    ]).session;
    expect(progressOf(rightWords)).toEqual(progressOf(act(act(session, 'p1', { type: 'enter', position: 0, word: words[0] }).session, 'p2', { type: 'enter', position: 1, word: 'wrong' }).session));
    const wrongCommit = act(s, 'p2', { type: 'confirm', revision: 2 }).session;
    expect(progressOf(wrongCommit)).toMatchObject({ value: 0.8, solved: false });
    const solved = play(rightWords, [
      ['p1', { type: 'confirm', revision: 2 }],
      ['p2', { type: 'confirm', revision: 2 }],
    ]).session;
    expect(progressOf(solved)).toEqual({ value: 1, stage: 'solved', stageIndex: 2, stageCount: 3, solved: true });
  });

  test('aurora: a right and a wrong theory look the same to rivals until the right one commits', () => {
    const { session } = startSession('mystery-aurora', team(2), 'd1:0');
    const theo = act(session, 'p1', { type: 'setTheory', culprit: 'theo' }).session;
    const jun = act(session, 'p1', { type: 'setTheory', culprit: 'jun' }).session;
    expect(progressOf(session).value).toBe(0);
    expect(progressOf(theo)).toEqual(progressOf(jun));
    expect(progressOf(act(theo, 'p1', { type: 'lockIn', revision: 1 }).session)).toEqual(progressOf(act(jun, 'p1', { type: 'lockIn', revision: 1 }).session));
    const wrong = play(theo, [['p1', { type: 'lockIn', revision: 1 }], ['p2', { type: 'lockIn', revision: 1 }]]).session;
    expect(progressOf(wrong)).toEqual(progressOf(theo));
    const right = play(jun, [['p1', { type: 'lockIn', revision: 1 }], ['p2', { type: 'lockIn', revision: 1 }]]).session;
    expect(progressOf(right)).toMatchObject({ value: 1, stage: 'solved', solved: true });
  });

  test('compareLive: solved squads by rank key first, then unsolved by progress', () => {
    const p = (value: number, solved = false): Progress => ({ value, stage: '', stageIndex: 0, stageCount: 3, solved });
    const o = (x: Partial<Outcome> = {}): Outcome => ({ correct: true, attempts: 1, solveMs: 1000, commitSeq: 1, ...x });
    const rows = [
      { id: 'slow-solve', progress: p(1, true), outcome: o({ solveMs: 9000, commitSeq: 2 }) },
      { id: 'almost', progress: p(0.8), outcome: o({ correct: false }) },
      { id: 'fast-solve', progress: p(1, true), outcome: o({ solveMs: 3000, commitSeq: 1 }) },
      { id: 'started', progress: p(0.2), outcome: o({ correct: false }) },
    ];
    expect([...rows].sort((a, b) => compareLive('split-passphrase', a, b)).map((r) => r.id)).toEqual(['fast-solve', 'slow-solve', 'almost', 'started']);
  });
});

describe('mixer formation', () => {
  const RGB: MixerColor[] = ['red', 'blue', 'green'];
  const mixer = mixerTemplate('split-passphrase');
  // What an honest team does after reading their fragments: say its words in red, blue, green, yellow order.
  const honest = (members: readonly MixerMember[]) =>
    MIXER_COLORS.flatMap((c) => members.filter((m) => m.color === c).map((m) => m.secret)).join(' ');
  let joins = 0;
  const player = (color: MixerColor, id: string): MixerMember => ({ color, secret: mixer.fragment(`drop-1:${id}`, color, joins++).secret });

  test('templates declare their formations; mystery-aurora is dealt-only', async () => {
    expect(listTemplates().map((t) => [t.id, t.formations])).toEqual([
      ['quick-quiz', ['dealt']],
      ['split-passphrase', ['dealt', 'mixer']],
      ['mystery-aurora', ['dealt']],
    ]);
    expect(await errorCode(() => requireFormation('mystery-aurora', 'mixer'))).toBe('FORMATION_UNSUPPORTED');
    expect(await errorCode(() => mixerTemplate('mystery-aurora'))).toBe('FORMATION_UNSUPPORTED');
    expect(requireFormation('mystery-aurora', 'dealt')).toBe(auroraTemplate);
  });

  test('creators pick 2–4 distinct colors, and joins are balanced round-robin', async () => {
    expect(mixerColors(['blue', 'red'])).toEqual(['blue', 'red']);
    for (const bad of [['red'], ['red', 'red'], ['red', 'pink'], []]) expect(await errorCode(() => mixerColors(bad))).toBe('BAD_CONFIG');
    const order = Array.from({ length: 10 }, (_, i) => colorForJoin(RGB, i));
    expect(order.slice(0, 6)).toEqual(['red', 'blue', 'green', 'red', 'blue', 'green']);
    expect(RGB.map((c) => order.filter((j) => j === c).length)).toEqual([4, 3, 3]);
  });

  test('fragment(seed, color, index) is { title, text, secret }, deterministic, and unique per player', () => {
    const f = mixer.fragment('drop-1:p1', 'blue', 1);
    expect(Object.keys(f).sort()).toEqual(['secret', 'text', 'title']);
    expect(f.title).toBe('PASSPHRASE · BLUE');
    expect(f.secret).toMatch(/^[a-z]+-\d{2}$/);
    expect(f.text).toContain(f.secret);
    expect(f.text).toContain('red, blue, green, yellow');
    expect(mixer.fragment('drop-1:p1', 'blue', 1)).toEqual(f);
    const secrets = new Set(Array.from({ length: 40 }, (_, i) => mixer.fragment(`drop-1:p${i}`, RGB[i % 3], i).secret));
    expect(secrets.size).toBe(40);
    const teamA = RGB.map((c) => player(c, `a-${c}`));
    const teamB = RGB.map((c) => player(c, `b-${c}`));
    expect(honest(teamA)).not.toBe(honest(teamB));
  });

  test('verify checks the answer against exactly these members, in any member order', async () => {
    const team = RGB.map((c) => player(c, `a-${c}`));
    const answer = honest(team);
    expect(verifyMixerTeam('split-passphrase', RGB, answer, [...team].reverse())).toEqual({ correct: true });
    expect(mixer.verify(`  ${answer.toUpperCase().replaceAll('-', ' ')}! `, team)).toEqual({ correct: true });
    const backwards = mixer.verify(team.map((m) => m.secret).reverse().join(' '), team);
    expect(backwards.correct).toBe(false);
    for (const m of team) expect(backwards.nudge).not.toContain(m.secret);
    expect(await errorCode(() => verifyMixerTeam('split-passphrase', RGB, answer, team.slice(0, 2)))).toBe('TEAM_INCOMPLETE');
    expect(await errorCode(() => verifyMixerTeam('split-passphrase', RGB, answer, [team[0], team[0], team[2]]))).toBe('TEAM_INCOMPLETE');
  });

  test('a passphrase posted in chat is useless to a team without those exact members', () => {
    for (let i = 0; i < 40; i++) {
      const team = RGB.map((c) => player(c, `t${i}-${c}`));
      const leaked = honest(team);
      const rivals = RGB.map((c) => player(c, `r${i}-${c}`));
      expect(mixer.verify(leaked, rivals).correct).toBe(false);
      const halfMatch = [team[0], team[1], rivals[2]];
      if (halfMatch[2].secret !== team[2].secret) expect(mixer.verify(leaked, halfMatch).correct).toBe(false);
    }
  });

  test('mixer necessity holds at 2, 3 and 4 colors and fails for a verifier that ignores a member', () => {
    expect(checkMixerNecessity(splitCodeTemplate, honest, SEEDS)).toEqual({ ok: true, violations: [] });
    const lazy: AnyTemplate = {
      ...splitCodeTemplate,
      id: 'lazy-mixer',
      mixer: { ...mixer, verify: (answer: string, members: readonly MixerMember[]) => ({ correct: answer.split(' ')[0] === members.find((m) => m.color === 'red')?.secret }) },
    };
    const { ok, violations } = checkMixerNecessity(lazy, honest, SEEDS.slice(0, 2));
    expect(ok).toBe(false);
    expect(violations).toContain('2 colors seed drop-0:0: the answer still works without the blue member');
    expect(checkMixerNecessity(auroraTemplate, honest, SEEDS)).toEqual({ ok: false, violations: ['no mixer support'] });
  });
});

describe('ranking', () => {
  const o = (x: Partial<Outcome>): Outcome => ({ correct: true, attempts: 1, solveMs: 1000, commitSeq: 1, ...x });

  test('aurora ranks by commit order, split code by time then attempts', () => {
    const a = o({ commitSeq: 2, solveMs: 500 });
    const b = o({ commitSeq: 1, solveMs: 900 });
    expect(compareOutcomes('mystery-aurora', a, b)).toBeGreaterThan(0);
    expect(compareOutcomes('split-passphrase', a, b)).toBeLessThan(0);
    expect(compareOutcomes('split-passphrase', o({ attempts: 3 }), o({ attempts: 1, commitSeq: 2 }))).toBeGreaterThan(0);
    expect(compareOutcomes('mystery-aurora', o({ correct: false, commitSeq: 0 }), o({ commitSeq: 9 }))).toBeGreaterThan(0);
    expect(auroraTemplate.scoring.score(o({ attempts: 3 }))).toBe(700);
  });
});
