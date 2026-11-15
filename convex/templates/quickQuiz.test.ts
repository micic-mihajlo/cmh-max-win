/// <reference types="vite/client" />
import { describe, expect, test } from 'vitest';

import {
  act,
  checkNecessity,
  checkSession,
  compareOutcomes,
  hostAdvance,
  pointsOf,
  publicBoard,
  publishIssues,
  startSession,
  tickSession,
  viewsFor,
  wakeTimes,
  type Session,
} from './engine';
import { quickQuizTemplate, type QuizConfig, type QuizSharedView, type QuizState } from './quickQuiz';
import type { Team } from './types';

const SEEDS = Array.from({ length: 40 }, (_, i) => `challenge-1:team${i}`);
const T0 = Date.parse('2026-11-15T22:00:00Z');
const team = (n: number, tag = 'p'): Team => Array.from({ length: n }, (_, i) => ({ playerId: `${tag}${i + 1}`, name: `${tag.toUpperCase()}${i + 1}` }));

async function errorCode(fn: () => unknown) {
  try {
    await fn();
  } catch (e) {
    return (e as { data?: { code?: string } }).data?.code;
  }
  throw new Error('expected the call to fail');
}

const QUIZ: QuizConfig = {
  questions: [
    { prompt: 'Which planet is the red one?', choices: ['Venus', 'Mars', 'Jupiter', 'Saturn'], correct: 1, timeLimitMs: 20_000 },
    { prompt: 'How many sides on a hexagon?', choices: ['Five', 'Six', 'Eight'], correct: 1, timeLimitMs: 10_000 },
    { prompt: 'Water boils at sea level at?', choices: ['90 C', '100 C'], correct: 1, timeLimitMs: 15_000 },
  ],
};

const quizSession = (seed: string, config: QuizConfig = QUIZ, now = T0) => startSession('quick-quiz', team(2, seed.replace(/\W/g, '')), seed, config, { now }).session;
const quizView = (s: Session) => viewsFor(s, s.players[0].playerId).shared as QuizSharedView;
const correctIndex = (s: Session, q: number) => (s.state as QuizState).questions[q].correct;

describe('quick-quiz content schema', () => {
  test('a well-formed quiz publishes, and every problem is reported by field', () => {
    expect(publishIssues('quick-quiz', QUIZ)).toEqual([]);
    expect(publishIssues('quick-quiz', { questions: QUIZ.questions.slice(0, 2) })).toEqual([{ field: 'questions', message: 'Write 3–10 questions.' }]);
    const bad = {
      questions: [
        { prompt: '', choices: ['A'], correct: 3, timeLimitMs: 1000 },
        { prompt: 'Dupes?', choices: ['Yes', 'yes '], correct: 0, timeLimitMs: 10_000 },
        QUIZ.questions[0],
      ],
    };
    expect(publishIssues('quick-quiz', bad).map((i) => i.field)).toEqual([
      'questions[0].prompt',
      'questions[0].choices',
      'questions[0].correct',
      'questions[0].timeLimitMs',
      'questions[1].choices',
    ]);
    expect(publishIssues('quick-quiz', undefined)).toEqual([{ field: 'questions', message: 'Add your questions.' }]);
    expect(publishIssues('mystery-aurora', {})).toEqual([]);
  });

  test('dealing refuses unpublishable content', async () => {
    expect(await errorCode(() => startSession('quick-quiz', team(1), 's', { questions: [] }, { now: T0 }))).toBe('BAD_CONFIG');
  });
});

describe('quick-quiz on stream (host pacing)', () => {
  test('nothing is shown in the lobby, and Next opens the same question for every team at once', () => {
    let teams = SEEDS.slice(0, 3).map((s) => quizSession(s));
    for (const s of teams) expect(quizView(s).questions).toEqual([]);
    expect(publicBoard('quick-quiz', teams.map((s, i) => ({ label: `Team ${i + 1}`, session: s }))).round).toMatchObject({ phase: 'lobby', prompt: null, index: null });
    const opened = T0 + 30_000;
    teams = teams.map((s) => hostAdvance(s, opened));
    for (const s of teams) {
      const [q] = quizView(s).questions;
      expect(q).toMatchObject({ index: 0, prompt: QUIZ.questions[0].prompt, opensAt: opened, closesAt: opened + 20_000, correctChoice: null, points: null });
      expect([...q.choices].sort()).toEqual([...QUIZ.questions[0].choices].sort());
    }
  });

  test('faster right answers score more, wrong ones score 0, and the overlay board ranks closed questions only', () => {
    const opened = T0 + 30_000;
    let [fast, slow, wrong] = SEEDS.slice(0, 3).map((s) => hostAdvance(quizSession(s), opened));
    fast = act(fast, fast.players[0].playerId, { type: 'answer', questionIndex: 0, choice: correctIndex(fast, 0) }, opened + 1_000).session;
    slow = act(slow, slow.players[1].playerId, { type: 'answer', questionIndex: 0, choice: correctIndex(slow, 0) }, opened + 15_000).session;
    wrong = act(wrong, wrong.players[0].playerId, { type: 'answer', questionIndex: 0, choice: (correctIndex(wrong, 0) + 1) % 4 }, opened + 500).session;
    const board = (list: Session[]) => publicBoard('quick-quiz', list.map((s, i) => ({ label: ['Fast', 'Slow', 'Wrong'][i], session: s })));

    const open = board([fast, slow, wrong]);
    expect(open.round).toMatchObject({ phase: 'question', index: 0, correctText: null });
    expect(open.rows.map((r) => [r.label, r.points, r.answeredCurrent, r.rank])).toEqual([
      ['Fast', 0, true, 1],
      ['Slow', 0, true, 1],
      ['Wrong', 0, true, 1],
    ]);
    expect(JSON.stringify(open)).not.toContain('Mars');
    expect(quizView(fast).points).toBe(0);
    expect(quizView(fast).questions[0]).toMatchObject({ answer: { choice: correctIndex(fast, 0) }, correctChoice: null, points: null });

    const closeAt = opened + 18_000;
    [fast, slow, wrong] = [fast, slow, wrong].map((s) => hostAdvance(s, closeAt));
    const closed = board([fast, slow, wrong]);
    expect(closed.round).toMatchObject({ phase: 'leaderboard', index: 0, correctText: 'Mars' });
    expect(closed.rows.map((r) => r.label)).toEqual(['Fast', 'Slow', 'Wrong']);
    expect(pointsOf(fast)).toBe(975);
    expect(pointsOf(slow)).toBe(625);
    expect(pointsOf(wrong)).toBe(0);
    expect(quizView(slow).questions[0]).toMatchObject({ correctChoice: correctIndex(slow, 0), points: 625 });
  });

  test('answers are refused before open, after close, twice, or out of range; the question also closes on its own', async () => {
    const opened = T0 + 30_000;
    const lobby = quizSession(SEEDS[0]);
    const p = lobby.players[0].playerId;
    expect(await errorCode(() => act(lobby, p, { type: 'answer', questionIndex: 0, choice: 0 }, opened))).toBe('NOT_OPEN');
    const s = hostAdvance(lobby, opened);
    expect(await errorCode(() => act(s, p, { type: 'answer', questionIndex: 1, choice: 0 }, opened))).toBe('NOT_OPEN');
    expect(await errorCode(() => act(s, p, { type: 'answer', questionIndex: 0, choice: 7 }, opened))).toBe('BAD_CHOICE');
    expect(await errorCode(() => act(s, p, { type: 'answer', questionIndex: 0, choice: 0 }, opened + 20_000))).toBe('CLOSED');
    const answered = act(s, p, { type: 'answer', questionIndex: 0, choice: 0 }, opened + 1).session;
    expect(await errorCode(() => act(answered, s.players[1].playerId, { type: 'answer', questionIndex: 0, choice: 1 }, opened + 2))).toBe('ALREADY_ANSWERED');
    expect(await errorCode(() => act(hostAdvance(s, opened + 5), p, { type: 'answer', questionIndex: 0, choice: 0 }, opened + 6))).toBe('CLOSED');
    expect(wakeTimes(lobby)).toEqual([]);
    expect(wakeTimes(s)).toEqual([opened + 20_000]);
    const timedOut = tickSession(s, opened + 20_000);
    expect(quizView(timedOut).questions[0].correctChoice).toBe(correctIndex(s, 0));
    expect(tickSession(s, opened + 19_999)).toEqual(s);
  });

  test('the correct choice never reaches a view or the board before its question closes', () => {
    for (const seed of SEEDS) {
      let s = quizSession(seed);
      let now = T0;
      for (let qi = 0; qi < QUIZ.questions.length; qi++) {
        now += 10_000;
        s = hostAdvance(s, now);
        const views = viewsFor(s, s.players[0].playerId);
        const open = (views.shared as QuizSharedView).questions[qi];
        expect(open.correctChoice).toBeNull();
        expect(JSON.stringify(views.mine)).not.toContain('correct');
        const correctText = QUIZ.questions[qi].choices[QUIZ.questions[qi].correct];
        expect(JSON.stringify(publicBoard('quick-quiz', [{ label: 'T', session: s }]))).not.toContain(correctText);
        now += 5_000;
        s = hostAdvance(s, now);
        expect((viewsFor(s, s.players[0].playerId).shared as QuizSharedView).questions[qi].correctChoice).toBe(correctIndex(s, qi));
      }
      expect(checkSession(s)).toEqual({ solved: true, correct: false });
      expect(quizView(s).finished).toBe(true);
    }
  });

  test('a leaked "pick the second one" is useless: choice order is shuffled per team', () => {
    const teams = SEEDS.map((s) => hostAdvance(quizSession(s), T0 + 1));
    const indices = teams.map((s) => correctIndex(s, 0));
    expect(new Set(indices).size).toBeGreaterThan(2);
    const leaked = indices[0];
    let misses = 0;
    for (const s of teams.slice(1)) {
      const after = hostAdvance(act(s, s.players[0].playerId, { type: 'answer', questionIndex: 0, choice: leaked }, T0 + 2).session, T0 + 3);
      if (correctIndex(s, 0) !== leaked) {
        expect(pointsOf(after)).toBe(0);
        misses++;
      }
    }
    expect(misses).toBeGreaterThan(20);
  });

  test('final placement ranks by points, then finish time', () => {
    const o = (points: number, solveMs: number, commitSeq: number) => ({ correct: points > 0, attempts: 0, solveMs, commitSeq, points });
    const rows = [o(1200, 9000, 1), o(2400, 9000, 2), o(1200, 4000, 3)];
    expect([...rows].sort((a, b) => compareOutcomes('quick-quiz', a, b)).map((r) => r.commitSeq)).toEqual([2, 3, 1]);
  });

  test('host controls and boards exist only where they make sense', async () => {
    const aurora = startSession('mystery-aurora', team(2), 'd1:0').session;
    expect(await errorCode(() => hostAdvance(aurora, T0))).toBe('NOT_HOST_PACED');
    expect(await errorCode(() => publicBoard('mystery-aurora', [{ label: 'T', session: aurora }]))).toBe('NO_BOARD');
  });

  test('solo by design: any one player can play for the team', () => {
    expect(checkNecessity(quickQuizTemplate, SEEDS.slice(0, 5), QUIZ)).toEqual({ ok: true, violations: [] });
  });
});

describe('quick-quiz determinism', () => {
  test('same seed and start, same deal', () => {
    expect(quizSession(SEEDS[3])).toEqual(quizSession(SEEDS[3]));
  });
});
