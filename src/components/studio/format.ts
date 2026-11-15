import type { ChallengeStatus, ChallengeTemplateId, TeamSize } from '@/lib/contract';

export const STUDIO_TEMPLATES: ChallengeTemplateId[] = ['quick-quiz', 'mystery-aurora'];

export const templateName = (id: ChallengeTemplateId) => (id === 'quick-quiz' ? 'Quick Quiz' : id === 'mystery-aurora' ? 'Mystery' : 'Passphrase');

export const teamSizeName = (n: TeamSize) => (n === 1 ? 'Solo' : n === 2 ? 'Duos' : n === 3 ? 'Trios' : 'Fours');

export const at = (handle: string) => (handle.startsWith('@') ? handle : `@${handle}`);

export function money(cents: number) {
  const dollars = cents / 100;
  return `$${Number.isInteger(dollars) ? dollars.toLocaleString('en-US') : dollars.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export const statusName: Record<ChallengeStatus, string> = {
  draft: 'Draft',
  published: 'Open',
  live: 'Live',
  ended: 'Ended',
  cancelled: 'Cancelled',
};

export const SHARE_ORIGIN = 'https://signal-app-wine.vercel.app';
export const shareUrl = (code: string) => `${SHARE_ORIGIN}/c/${code}`;

export function errorMessage(e: unknown, fallback: string) {
  const data = (e as { data?: { message?: string } })?.data;
  return data && typeof data === 'object' && data.message ? data.message : fallback;
}
