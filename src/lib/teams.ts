// Team names and their muted paper tints (Razeen, Nov 16). Deterministic: the same team gets the same name and tint
// on every screen and phone. Tints mark team clusters and markers only, never buttons or backgrounds.
// Names cycle with " 2", " 3"... after the eighth team.
const TEAMS = [
  { name: 'Coral', tint: '#F3DDD5', ink: '#8A4A3A' },
  { name: 'Sage', tint: '#DDE7DA', ink: '#4F6B4C' },
  { name: 'Sky', tint: '#DAE5EE', ink: '#46637A' },
  { name: 'Sand', tint: '#EEE6D3', ink: '#7A6A45' },
  { name: 'Lilac', tint: '#E6DFEE', ink: '#66577D' },
  { name: 'Moss', tint: '#E0E5D0', ink: '#5C6740' },
  { name: 'Clay', tint: '#EAD9CF', ink: '#7D5743' },
  { name: 'Slate', tint: '#DDE1E5', ink: '#515C67' },
] as const;

// Room pulse (prototype A): a dot that hasn't locked yet.
export const THINKING = '#D3D1CC';

export type TeamStyle = { name: string; tint: string; ink: string };

function hash(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

// index: the team's 0-based order in its challenge (Team 1 -> 0). Without one, the id picks a stable slot.
export function teamStyle(teamId: string, index?: number | null): TeamStyle {
  const i = index ?? hash(teamId);
  const base = TEAMS[i % TEAMS.length];
  const round = Math.floor(i / TEAMS.length);
  return { name: `Team ${base.name}${round > 0 ? ` ${round + 1}` : ''}`, tint: base.tint, ink: base.ink };
}

// The server labels dealt teams 'Team 1', 'Team 2'...; this reads the order back out of that label.
export function teamIndexFromLabel(label: string): number | null {
  const n = /(\d+)\s*$/.exec(label)?.[1];
  return n ? Number(n) - 1 : null;
}
