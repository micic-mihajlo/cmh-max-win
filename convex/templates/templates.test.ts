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
  compareLive,
  compareOutcomes,
  progressOf,
  squadSizes,
  startSession,
  viewsFor,
  type Session,
} from './engine';
import { findTemplate, listTemplates, TEMPLATES } from './registry';
import { splitCodeTemplate, type SplitCodeState } from './splitCode';
import { MAX_SQUAD_SIZE, MIN_SQUAD_SIZE, type AnyTemplate, type Outcome, type Progress, type Team } from './types';

const modules = import.meta.glob('../**/*.ts');
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
  deal(t, seed, config) {
    const { state } = splitCodeTemplate.deal(t, seed, config);
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
    expect(listTemplates().map((t) => t.id)).toEqual(['aurora', 'split-code']);
    expect(new Set(TEMPLATES.map((t) => t.id)).size).toBe(TEMPLATES.length);
    expect(findTemplate('aurora')).toBe(auroraTemplate);
    expect(findTemplate('nope')).toBeNull();
  });

  test('refuses unknown templates, team sizes and configs', async () => {
    expect(await errorCode(() => startSession('nope', team(2), 's'))).toBe('UNKNOWN_TEMPLATE');
    expect(await errorCode(() => startSession('aurora', team(4), 's'))).toBe('BAD_TEAM_SIZE');
    expect(await errorCode(() => startSession('aurora', team(1), 's'))).toBe('BAD_TEAM_SIZE');
    expect(await errorCode(() => startSession('split-code', team(3), 's', { wordCount: 9 }))).toBe('BAD_CONFIG');
    expect(await errorCode(() => startSession('split-code', team(4), 's', { wordCount: 3 }))).toBe('BAD_CONFIG');
    expect(actionArgs('aurora').kind).toBe('union');
  });
});

describe('squad sizes', () => {
  test('every template declares sizes within 1–4', () => {
    for (const t of TEMPLATES) {
      expect(t.minSquadSize).toBeGreaterThanOrEqual(MIN_SQUAD_SIZE);
      expect(t.maxSquadSize).toBeLessThanOrEqual(MAX_SQUAD_SIZE);
      expect(t.minSquadSize).toBeLessThanOrEqual(t.maxSquadSize);
    }
    expect(squadSizes(auroraTemplate)).toEqual([2, 3]);
    expect(squadSizes(splitCodeTemplate)).toEqual([1, 2, 3, 4]);
  });

  test('split code: a solo player holds every word, bigger squads split them with nobody empty-handed', async () => {
    for (const size of [1, 2, 3, 4]) {
      for (const seed of SEEDS) {
        const { session, views } = startSession('split-code', team(size), seed);
        const counts = session.players.map((p) => (views[p.playerId] as { fragments: unknown[] }).fragments.length);
        expect(counts.reduce((a, b) => a + b, 0)).toBe(4);
        expect(Math.min(...counts)).toBeGreaterThan(0);
      }
    }
    expect(await errorCode(() => startSession('split-code', team(5), 'x'))).toBe('BAD_TEAM_SIZE');
  });
});

describe('necessity', () => {
  test('aurora: no single player or subset can solve it alone', () => {
    expect(checkNecessity(auroraTemplate, SEEDS)).toEqual({ ok: true, violations: [] });
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
    expect(checkNecessity(hopeless, ['x']).violations).toEqual([
      'size 2 seed x: the full team cannot solve it',
      'size 3 seed x: the full team cannot solve it',
    ]);
  });
});

// Every private string a player holds, keyed by playerId. Views are matched against them as whole JSON strings.
function secrets(templateId: string, session: Session): Record<string, string[]> {
  if (templateId === 'aurora') {
    const state = session.state as AuroraState;
    return Object.fromEntries(state.seats.map((s) => [s.playerId, s.roles.flatMap((r) => PIECES[r].lines.map((l) => l.text))]));
  }
  const state = session.state as SplitCodeState;
  return Object.fromEntries(session.players.map((p) => [p.playerId, state.words.filter((_, i) => state.holders[i] === p.playerId)]));
}

describe('private views never leak', () => {
  for (const template of TEMPLATES) {
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
              for (const viewer of session.players.map((p) => p.playerId).filter((id) => id !== owner)) {
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
      const { session } = startSession('aurora', team(2), seed);
      const { session: after, results } = play(session, [
        ['p1', { type: 'setTheory', culprit: 'theo' }],
        ['p1', { type: 'lockIn', revision: 1 }],
        ['p2', { type: 'lockIn', revision: 1 }],
      ]);
      const shared = JSON.stringify(viewsFor(after, 'p1').shared) + JSON.stringify(results);
      for (const texts of Object.values(secrets('aurora', after))) for (const text of texts) expect(shared).not.toContain(JSON.stringify(text));
      for (const leak of ['Jun took', 'galley oven', 'Nobody could place Jun']) expect(shared).not.toContain(leak);
    }
  });
});

describe('determinism', () => {
  for (const template of TEMPLATES) {
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
    const aurora = new Set(SEEDS.map((s) => JSON.stringify((startSession('aurora', team(2), s).session.state as AuroraState).seats.map((x) => x.roles))));
    const split = new Set(SEEDS.map((s) => (startSession('split-code', team(2), s).session.state as SplitCodeState).words.join(' ')));
    expect(aurora.size).toBe(3);
    expect(split.size).toBeGreaterThan(30);
  });

  test('apply never mutates its input', () => {
    const { session } = startSession('split-code', team(2), 'x');
    const before = structuredClone(session);
    act(session, 'p1', { type: 'enter', position: 0, word: 'amber' });
    expect(session).toEqual(before);
  });

  test('aurora adapter deals the same hands as drops.dealPieces', () => {
    for (let i = 0; i < 12; i++) {
      for (const size of [2, 3] as const) {
        const state = startSession('aurora', team(size), `d1:${i}`).session.state as AuroraState;
        expect(state.seats.map((s) => s.roles)).toEqual(dealPieces('d1', i, size));
      }
    }
  });

  test('a full playthrough inside a Convex mutation gives the same result every run', async () => {
    const t = convexTest(schema, modules);
    presenceTest.register(t);
    const run = () =>
      t.run(async () => {
        const { session } = startSession('split-code', team(3), 'drop-7:2');
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
    const { session } = startSession('aurora', team(3), 'd1:0');
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
    const { session } = startSession('aurora', team(2), 'x');
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
    const { session } = startSession('split-code', team(2), 'x', { wordCount: 2 });
    expect(await errorCode(() => act(session, 'p1', { type: 'confirm', revision: 0 }))).toBe('INCOMPLETE');
    expect(await errorCode(() => act(session, 'p1', { type: 'enter', position: 2, word: 'a' }))).toBe('BAD_POSITION');
    expect(await errorCode(() => act(session, 'p1', { type: 'confirm', revision: 3 }))).toBe('STALE_REVISION');
  });

  test('entering normalizes case and whitespace', () => {
    const { session } = startSession('split-code', team(2), 'x', { wordCount: 2 });
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
    const { session } = startSession('split-code', team(2), 'race', { wordCount: 2 });
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
    const { session } = startSession('aurora', team(2), 'd1:0');
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
    expect([...rows].sort((a, b) => compareLive('split-code', a, b)).map((r) => r.id)).toEqual(['fast-solve', 'slow-solve', 'almost', 'started']);
  });
});

describe('ranking', () => {
  const o = (x: Partial<Outcome>): Outcome => ({ correct: true, attempts: 1, solveMs: 1000, commitSeq: 1, ...x });

  test('aurora ranks by commit order, split code by time then attempts', () => {
    const a = o({ commitSeq: 2, solveMs: 500 });
    const b = o({ commitSeq: 1, solveMs: 900 });
    expect(compareOutcomes('aurora', a, b)).toBeGreaterThan(0);
    expect(compareOutcomes('split-code', a, b)).toBeLessThan(0);
    expect(compareOutcomes('split-code', o({ attempts: 3 }), o({ attempts: 1, commitSeq: 2 }))).toBeGreaterThan(0);
    expect(compareOutcomes('aurora', o({ correct: false, commitSeq: 0 }), o({ commitSeq: 9 }))).toBeGreaterThan(0);
    expect(auroraTemplate.scoring.score(o({ attempts: 3 }))).toBe(700);
  });
});
