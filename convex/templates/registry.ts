import { auroraTemplate } from './aurora';
import { quickQuizTemplate } from './quickQuiz';
import { splitCodeTemplate } from './splitCode';
import type { AnyTemplate } from './types';

// Every challenge type the platform can host, in gallery order. Add a template here and nothing else in the
// platform changes.
export const TEMPLATES = [quickQuizTemplate, splitCodeTemplate, auroraTemplate] as const satisfies readonly AnyTemplate[];

export type TemplateId = (typeof TEMPLATES)[number]['id'];

const BY_ID = new Map<string, AnyTemplate>(TEMPLATES.map((t) => [t.id, t]));

export function findTemplate(id: string): AnyTemplate | null {
  return BY_ID.get(id) ?? null;
}

export function listTemplates() {
  return TEMPLATES.map((t) => ({
    id: t.id,
    name: t.name,
    summary: t.summary,
    mode: t.mode,
    teamSizes: [...t.teamSizes],
    formations: [...t.formations],
  }));
}
