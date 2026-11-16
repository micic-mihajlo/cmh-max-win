import type { QuizPrivateView, QuizQuestionView, QuizSharedView } from '@convex/templates/quickQuiz';

export type { QuizPrivateView, QuizQuestionView, QuizSharedView };

export function ordinal(n: number) {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
}

export function money(cents: number) {
  const whole = cents % 100 === 0;
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 })}`;
}

export function points(n: number) {
  return n.toLocaleString('en-US');
}

export function isQuizView(shared: unknown): shared is QuizSharedView {
  return !!shared && typeof shared === 'object' && Array.isArray((shared as QuizSharedView).questions);
}
