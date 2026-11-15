// The quick-quiz template's own content (templates.md, PR #65). Mirrors convex/templates/quickQuiz.ts limits.
export type QuizQuestion = {
  prompt: string;
  choices: string[];
  correct: number;
  timeLimitMs: number;
};
export type QuizConfig = { questions: QuizQuestion[] };

export const QUIZ = {
  minQuestions: 3,
  maxQuestions: 10,
  minChoices: 2,
  maxChoices: 4,
  times: [10_000, 20_000, 30_000],
} as const;

export const blankQuestion = (): QuizQuestion => ({
  prompt: '',
  choices: ['', ''],
  correct: 0,
  timeLimitMs: 20_000,
});

export function quizOf(raw: unknown): QuizConfig {
  const qs = (raw as { questions?: unknown } | null | undefined)?.questions;
  return { questions: Array.isArray(qs) ? (qs as QuizQuestion[]) : [] };
}
