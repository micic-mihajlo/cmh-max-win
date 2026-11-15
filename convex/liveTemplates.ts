// Template SDK v2, live half: hostActions and overlayView. CMHM-30 owns the real interface in convex/templates/**;
// until it publishes, this local type mirrors the counter reference, and liveTemplateFor() prefers a registry
// template that declares hostActions and overlayView over the local ones. Templates stay pure: no Date.now (the
// platform passes ctx.now), no Math.random, and state is a plain Convex value.
import { findTemplate } from './templates/registry';
import type { LivePhase } from '../src/lib/contract';

export type TemplateError = { code: string; message: string };
export type HostActionContext = { now: number; phase: LivePhase };

export type HostActionSpec<State> = {
  minIntervalMs?: number; // the platform refuses the same action again sooner (default 150ms)
  validate?(state: State, payload: unknown, ctx: HostActionContext): TemplateError | null;
  apply(state: State, payload: unknown, ctx: HostActionContext): State;
};

export type LiveTemplate<State = unknown> = {
  id: string;
  init(config: unknown, seed: string): State;
  hostActions: Record<string, HostActionSpec<State>>;
  overlayView(state: State): unknown; // public: goes on stream, so nothing private
};

// The counter reference: one count the host ticks live, with undo. It is the shape Stream Calls' counters take.
type CounterState = { value: number; ticks: { delta: 1 | -1; at: number }[] };

export const counterTemplate: LiveTemplate<CounterState> = {
  id: 'counter',
  init: () => ({ value: 0, ticks: [] }),
  hostActions: {
    tick: {
      minIntervalMs: 250,
      validate: (s, payload, ctx) => {
        const delta = (payload as { delta?: unknown } | null)?.delta;
        if (delta !== 1 && delta !== -1) return { code: 'BAD_PAYLOAD', message: 'A tick is +1 or -1.' };
        if (ctx.phase !== 'live') return { code: 'NOT_LIVE', message: 'The counter runs once the challenge is live.' };
        if (delta === -1 && s.value === 0) return { code: 'AT_ZERO', message: 'The count is already 0.' };
        return null;
      },
      apply: (s, payload, ctx) => {
        const delta = (payload as { delta: 1 | -1 }).delta;
        return { value: s.value + delta, ticks: [...s.ticks, { delta, at: ctx.now }] };
      },
    },
    undo: {
      validate: (s) => (s.ticks.length ? null : { code: 'NOTHING_TO_UNDO', message: 'No tick to undo.' }),
      apply: (s) => ({ value: s.value - s.ticks[s.ticks.length - 1].delta, ticks: s.ticks.slice(0, -1) }),
    },
  },
  overlayView: (s) => ({ value: s.value, ticks: s.ticks.length, lastTickAt: s.ticks[s.ticks.length - 1]?.at ?? null }),
};

const LOCAL: Record<string, LiveTemplate<any>> = { counter: counterTemplate }; // eslint-disable-line @typescript-eslint/no-explicit-any

export function liveTemplateFor(templateId: string): LiveTemplate<unknown> | null {
  const t = findTemplate(templateId) as unknown as Partial<LiveTemplate> | null;
  if (t?.hostActions && t.overlayView && t.init) return t as LiveTemplate;
  return LOCAL[templateId] ?? null;
}
