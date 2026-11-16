// Quick Quiz, the Kahoot-style anchor for live streams: the creator authors 3–10 multiple-choice questions, every
// team gets each question at the same moment on the server clock, and a correct answer scores more the faster it
// lands. Solo or dealt teams of up to 4, and every player answers for themselves: the team scores the sum of its
// members' points, and a teammate's answer never locks yours. The streamer advances each question from the console, and a question
// also closes on its own at its time limit. Choice order is shuffled per team (seeded), so "it's C" from another
// team is useless, and the correct choice reaches a device or the overlay only after its question closes.
import { ConvexError, v } from 'convex/values';

import { rng, shuffle } from './random';
import type { ChallengeTemplate, CheckResult, ConfigIssue, Progress, TemplateError } from './types';

export const QUIZ_MIN_QUESTIONS = 3;
export const QUIZ_MAX_QUESTIONS = 10;
export const QUIZ_MIN_CHOICES = 2;
export const QUIZ_MAX_CHOICES = 4;
export const QUIZ_MIN_TIME_MS = 5_000;
export const QUIZ_MAX_TIME_MS = 60_000;
export const QUIZ_DEFAULT_TIME_MS = 20_000; // a question without its own time limit; stored quizzes keep theirs
export const QUIZ_MAX_POINTS = 1000;

export type QuizQuestion = { prompt: string; choices: string[]; correct: number; timeLimitMs: number };
export type QuizConfig = { questions: QuizQuestion[] };

type DealtQuestion = {
  prompt: string;
  choices: string[];
  correct: number;
  timeLimitMs: number;
  opensAt: number | null;
  closesAt: number | null;
};
type QuizAnswer = { choice: number; at: number; by: string; points: number } | null;

export type QuizState = {
  players: { playerId: string; name: string }[];
  startedAt: number;
  questions: DealtQuestion[];
  // Sessions dealt before per-player play: one answer per question for the whole team. Per-player sessions keep
  // these null and use byPlayer.
  answers: QuizAnswer[];
  // Per-player play: each player's answer per question, keyed by playerId.
  byPlayer?: Record<string, QuizAnswer[]>;
  // How many questions have opened and how many have closed, moved only by tick and the host's advance.
  opened: number;
  closed: number;
};

export type QuizAction = { type: 'answer'; questionIndex: number; choice: number };

export type QuizQuestionView = {
  index: number;
  prompt: string;
  choices: string[];
  opensAt: number | null;
  closesAt: number | null;
  closed: boolean;
  // Sessions dealt before per-player play only: the team's one answer. Null in per-player play, so a teammate's
  // pick is never shown; the player's own pick is in the private view.
  answer: { choice: number; by: string } | null;
  // Per-player play: who has locked this question (playerIds, no choices).
  lockedBy?: string[];
  // Present only once the question has closed.
  correctChoice: number | null;
  points: number | null;
};
export type QuizSharedView = {
  questionCount: number;
  startedAt: number;
  questions: QuizQuestionView[];
  points: number; // the team's, summed over members, closed questions only
  finished: boolean;
  players?: { playerId: string; name: string }[];
};
// myChoices[i]: this player's own pick for question i, or null. myPoints[i]: what that pick scored, once question i closed.
export type QuizPrivateView = { answeredByMe: number[]; playerId?: string; myChoices?: (number | null)[]; myPoints?: (number | null)[] };

// lobby: nothing open yet. question: one is open. leaderboard: between questions. finished: all closed.
export type QuizPhase = 'lobby' | 'question' | 'leaderboard' | 'finished';
// Safe for a public, token-free overlay: no team's choices, and the correct answer only once closed.
export type QuizRoundView = {
  phase: QuizPhase;
  questionCount: number;
  index: number | null;
  prompt: string | null;
  opensAt: number | null;
  closesAt: number | null;
  correctText: string | null;
};

const questionValidator = v.object({ prompt: v.string(), choices: v.array(v.string()), correct: v.number(), timeLimitMs: v.optional(v.number()) });

function issues(raw: unknown): ConfigIssue[] {
  const qs = (raw as { questions?: unknown } | undefined)?.questions;
  if (!Array.isArray(qs)) return [{ field: 'questions', message: 'Add your questions.' }];
  const out: ConfigIssue[] = [];
  if (qs.length < QUIZ_MIN_QUESTIONS || qs.length > QUIZ_MAX_QUESTIONS) {
    out.push({ field: 'questions', message: `Write ${QUIZ_MIN_QUESTIONS}–${QUIZ_MAX_QUESTIONS} questions.` });
  }
  qs.forEach((q: Partial<QuizQuestion>, i) => {
    const at = (f: string) => `questions[${i}].${f}`;
    if (typeof q?.prompt !== 'string' || !q.prompt.trim() || q.prompt.length > 200) out.push({ field: at('prompt'), message: 'A question needs a prompt of up to 200 characters.' });
    const choices = Array.isArray(q?.choices) ? q.choices : [];
    if (choices.length < QUIZ_MIN_CHOICES || choices.length > QUIZ_MAX_CHOICES) {
      out.push({ field: at('choices'), message: `Give ${QUIZ_MIN_CHOICES}–${QUIZ_MAX_CHOICES} choices.` });
    } else if (choices.some((c) => typeof c !== 'string' || !c.trim() || c.length > 80)) {
      out.push({ field: at('choices'), message: 'Every choice needs text of up to 80 characters.' });
    } else if (new Set(choices.map((c) => c.trim().toLowerCase())).size !== choices.length) {
      out.push({ field: at('choices'), message: 'Choices must be different.' });
    }
    if (!Number.isInteger(q?.correct) || q.correct! < 0 || q.correct! >= choices.length) out.push({ field: at('correct'), message: 'Mark which choice is correct.' });
    if (q?.timeLimitMs === undefined) return;
    if (!Number.isInteger(q.timeLimitMs) || q.timeLimitMs < QUIZ_MIN_TIME_MS || q.timeLimitMs > QUIZ_MAX_TIME_MS) {
      out.push({ field: at('timeLimitMs'), message: `Time limits are ${QUIZ_MIN_TIME_MS / 1000}–${QUIZ_MAX_TIME_MS / 1000} seconds.` });
    }
  });
  return out;
}

function pointsFor(q: DealtQuestion, at: number) {
  return Math.round(QUIZ_MAX_POINTS * (0.5 + (0.5 * Math.max(0, q.closesAt! - at)) / q.timeLimitMs));
}

function phase(state: QuizState): QuizPhase {
  if (state.closed === state.questions.length) return 'finished';
  if (state.opened > state.closed) return 'question';
  return state.opened === 0 ? 'lobby' : 'leaderboard';
}

function roundView(state: QuizState): QuizRoundView {
  const index = state.opened > 0 ? state.opened - 1 : null;
  const q = index === null ? null : state.questions[index];
  const closed = index !== null && index < state.closed;
  return {
    phase: phase(state),
    questionCount: state.questions.length,
    index,
    prompt: q?.prompt ?? null,
    opensAt: q?.opensAt ?? null,
    closesAt: q?.closesAt ?? null,
    correctText: q && closed ? q.choices[q.correct] : null,
  };
}

// The host's Next button: closes the open question early, otherwise opens the next one for timeLimitMs.
function advance(state: QuizState, now: number): QuizState {
  if (state.opened > state.closed) {
    const i = state.closed;
    return { ...state, questions: state.questions.map((q, k) => (k === i ? { ...q, closesAt: Math.min(q.closesAt!, now) } : q)), closed: i + 1 };
  }
  const i = state.opened;
  if (i >= state.questions.length) return state;
  return { ...state, questions: state.questions.map((q, k) => (k === i ? { ...q, opensAt: now, closesAt: now + q.timeLimitMs } : q)), opened: i + 1 };
}

// Every answer to question i: one per player in per-player play, the team's one answer before it.
function answersTo(state: QuizState, i: number) {
  const all = state.byPlayer ? state.players.map((p) => state.byPlayer![p.playerId]?.[i] ?? null) : [state.answers[i]];
  return all.filter((a): a is NonNullable<QuizAnswer> => a !== null);
}

const questionPoints = (state: QuizState, i: number) => answersTo(state, i).reduce((sum, a) => sum + a.points, 0);

function lockedBy(state: QuizState, i: number) {
  return answersTo(state, i).map((a) => a.by);
}

// Per-player play: every member has answered. Before it: the team's one answer.
export function teamLocked(state: QuizState, i: number) {
  return lockedBy(state, i).length >= (state.byPlayer ? state.players.length : 1);
}

// The team scored on a closed question; null while it is open.
export function questionCorrect(state: QuizState, i: number) {
  return i < state.closed ? questionPoints(state, i) > 0 : null;
}

export function lockCounts(state: QuizState, i: number) {
  return { lockedCount: lockedBy(state, i).length, memberCount: state.byPlayer ? state.players.length : 1 };
}

// The answer this player's lock recorded: their own in per-player play, the team's one answer before it.
export function answerOf(state: QuizState, playerId: string, i: number) {
  return (state.byPlayer ? state.byPlayer[playerId]?.[i] : state.answers[i]) ?? null;
}

// The open question while per-player answers to it may live outside the session; null otherwise.
export const openQuestion = (state: QuizState) => (state.byPlayer && state.opened > state.closed ? state.closed : null);

// Merges per-player answers kept outside the session (the live layer's pulseLocks rows) back into it.
export function withAnswers(state: QuizState, answers: readonly { playerId: string; questionIndex: number; choice: number; at: number; points: number }[]): QuizState {
  if (!state.byPlayer || !answers.length) return state;
  const byPlayer = { ...state.byPlayer };
  for (const a of answers) {
    const mine = [...(byPlayer[a.playerId] ?? state.questions.map(() => null))];
    mine[a.questionIndex] = { choice: a.choice, at: a.at, by: a.playerId, points: a.points };
    byPlayer[a.playerId] = mine;
  }
  return { ...state, byPlayer };
}

function totalPoints(state: QuizState, upTo = state.questions.length) {
  let sum = 0;
  for (let i = 0; i < upTo; i++) sum += questionPoints(state, i);
  return sum;
}

function check(state: QuizState): CheckResult {
  if (state.closed < state.questions.length) return { solved: false, correct: false };
  return { solved: true, correct: totalPoints(state) > 0 };
}

function sharedView(state: QuizState): QuizSharedView {
  return {
    questionCount: state.questions.length,
    startedAt: state.startedAt,
    questions: state.questions.slice(0, state.opened).map((q, index) => {
      const closed = index < state.closed;
      const a = state.byPlayer ? null : state.answers[index];
      return {
        index,
        prompt: q.prompt,
        choices: q.choices,
        opensAt: q.opensAt,
        closesAt: q.closesAt,
        closed,
        answer: a ? { choice: a.choice, by: a.by } : null,
        ...(state.byPlayer ? { lockedBy: lockedBy(state, index) } : {}),
        correctChoice: closed ? q.correct : null,
        points: closed ? questionPoints(state, index) : null,
      };
    }),
    points: totalPoints(state, state.closed),
    finished: state.closed === state.questions.length,
    ...(state.byPlayer ? { players: state.players } : {}),
  };
}

const STAGES = ['waiting', 'playing', 'finished'] as const;

function progress(state: QuizState): Progress {
  const i = state.closed === state.questions.length ? 2 : state.opened > 0 ? 1 : 0;
  return { value: state.closed / state.questions.length, stage: STAGES[i], stageIndex: i, stageCount: STAGES.length, solved: i === 2 };
}

function validateAnswer(state: QuizState, playerId: string, action: QuizAction, now: number): TemplateError | null {
  const q = state.questions[action.questionIndex];
  if (!q) return { code: 'BAD_QUESTION', message: 'No such question.' };
  if (q.opensAt === null || q.closesAt === null || now < q.opensAt) return { code: 'NOT_OPEN', message: 'That question has not opened yet.' };
  if (now >= q.closesAt || action.questionIndex < state.closed) return { code: 'CLOSED', message: "Time's up on that question." };
  if (state.byPlayer ? state.byPlayer[playerId]?.[action.questionIndex] : state.answers[action.questionIndex]) {
    return { code: 'ALREADY_ANSWERED', message: state.byPlayer ? 'You already locked in.' : 'Your team already answered.' };
  }
  if (!Number.isInteger(action.choice) || action.choice < 0 || action.choice >= q.choices.length) return { code: 'BAD_CHOICE', message: 'No such choice.' };
  return null;
}

export const quickQuizTemplate: ChallengeTemplate<QuizConfig, QuizState, QuizAction, QuizPrivateView, QuizSharedView> = {
  id: 'quick-quiz',
  name: 'Quick Quiz',
  summary: 'Live multiple choice: every team sees each question at once, and faster right answers score more.',
  mode: 'solo',
  config: {
    schema: v.object({ questions: v.array(questionValidator) }),
    issues,
    parse(raw) {
      const found = issues(raw);
      if (found.length) throw new ConvexError({ code: 'BAD_CONFIG', message: `${found[0].field}: ${found[0].message}` });
      const { questions } = raw as { questions: (Omit<QuizQuestion, 'timeLimitMs'> & { timeLimitMs?: number })[] };
      return {
        questions: questions.map((q) => ({ prompt: q.prompt.trim(), choices: q.choices.map((c) => c.trim()), correct: q.correct, timeLimitMs: q.timeLimitMs ?? QUIZ_DEFAULT_TIME_MS })),
      };
    },
  },
  teamSizes: [1, 2, 3, 4],
  formations: ['dealt'],

  deal(team, seed, config, ctx) {
    const next = rng(seed);
    const questions = config.questions.map((q) => {
      const order = shuffle(
        q.choices.map((_, k) => k),
        next,
      );
      return { prompt: q.prompt, choices: order.map((k) => q.choices[k]), correct: order.indexOf(q.correct), timeLimitMs: q.timeLimitMs, opensAt: null, closesAt: null };
    });
    const state: QuizState = {
      players: team.map((p) => ({ playerId: p.playerId, name: p.name })),
      startedAt: ctx.now,
      questions,
      answers: questions.map(() => null),
      byPlayer: Object.fromEntries(team.map((p) => [p.playerId, questions.map(() => null)])),
      opened: 0,
      closed: 0,
    };
    return { state, views: Object.fromEntries(team.map((p) => [p.playerId, { answeredByMe: [] }])) };
  },

  privateView: (state, playerId) => {
    const mine = state.byPlayer ? (state.byPlayer[playerId] ?? []) : state.answers.map((a) => (a?.by === playerId ? a : null));
    return {
      answeredByMe: mine.flatMap((a, i) => (a ? [i] : [])),
      playerId,
      myChoices: state.questions.map((_, i) => mine[i]?.choice ?? null),
      myPoints: state.questions.map((_, i) => (i < state.closed ? (mine[i]?.points ?? 0) : null)),
    };
  },
  sharedView,

  actions: {
    answer: {
      args: v.object({ type: v.literal('answer'), questionIndex: v.number(), choice: v.number() }),
      validate: (state, playerId, action, ctx) => validateAnswer(state, playerId, action, ctx.now),
    },
  },

  apply(state, playerId, action, ctx) {
    const q = state.questions[action.questionIndex];
    const points = action.choice === q.correct ? pointsFor(q, ctx.now) : 0;
    const answer = { choice: action.choice, at: ctx.now, by: playerId, points };
    if (state.byPlayer) {
      const mine = (state.byPlayer[playerId] ?? state.questions.map(() => null)).map((a, i) => (i === action.questionIndex ? answer : a));
      return { ...state, byPlayer: { ...state.byPlayer, [playerId]: mine } };
    }
    return { ...state, answers: state.answers.map((a, i) => (i === action.questionIndex ? answer : a)) };
  },

  check,
  progress,

  // The open question's timeout. The host's advance can close it earlier.
  wakeTimes: (state) => (state.opened > state.closed ? [state.questions[state.closed].closesAt!] : []),
  tick(state, now) {
    const closed = Math.max(state.closed, state.questions.filter((q) => q.closesAt !== null && q.closesAt <= now).length);
    return closed === state.closed ? state : { ...state, closed };
  },
  points: (state) => sharedView(state).points,
  host: { advance },
  board: {
    round: roundView,
    // Closed questions only, so the overlay never shows who's ahead on an open question.
    // answeredCurrent: every member has locked the open question.
    team: (state) => ({ points: sharedView(state).points, answeredCurrent: state.opened > state.closed && teamLocked(state, state.closed) }),
  },

  scoring: {
    score: (o) => o.points ?? 0,
    // Most points first; then the faster finish, then commit order.
    rankKey: (o) => [-(o.points ?? 0), o.solveMs, o.commitSeq],
  },

  necessity: {
    // Solo by design: any one member can score for the team.
    solvableBy: (_state, playerIds) => playerIds.length > 0,
  },
};
