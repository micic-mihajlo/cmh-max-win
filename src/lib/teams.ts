// Team names and their muted paper tints (Razeen, Nov 16). Deterministic: the same team gets the same name and tint
// on every screen and phone. Tints mark team clusters and markers only, never buttons or backgrounds.
// Sixty distinct names; past sixty they cycle with " 2", " 3"... Tints cycle over eight, so neighbours never share one.
const NAMES = [
  'Coral', 'Sage', 'Sky', 'Sand', 'Lilac', 'Moss', 'Clay', 'Slate', 'Fern', 'Pine',
  'Rust', 'Plum', 'Dune', 'Cove', 'Reef', 'Birch', 'Cedar', 'Flint', 'Heath', 'Juniper',
  'Kelp', 'Linen', 'Maple', 'Oat', 'Pebble', 'Quartz', 'Reed', 'Saffron', 'Tide', 'Umber',
  'Willow', 'Elm', 'Aspen', 'Basalt', 'Brook', 'Cliff', 'Dew', 'Fjord', 'Frost', 'Glade',
  'Grove', 'Hazel', 'Ivy', 'Lagoon', 'Larch', 'Marsh', 'Meadow', 'Mist', 'Oak', 'Olive',
  'Opal', 'Pearl', 'Prairie', 'Rain', 'River', 'Shale', 'Spruce', 'Thistle', 'Thyme', 'Wren',
] as const;

const TINTS = [
  { tint: '#F3DDD5', ink: '#8A4A3A' },
  { tint: '#DDE7DA', ink: '#4F6B4C' },
  { tint: '#DAE5EE', ink: '#46637A' },
  { tint: '#EEE6D3', ink: '#7A6A45' },
  { tint: '#E6DFEE', ink: '#66577D' },
  { tint: '#E0E5D0', ink: '#5C6740' },
  { tint: '#EAD9CF', ink: '#7D5743' },
  { tint: '#DDE1E5', ink: '#515C67' },
] as const;

export type TeamStyle = { name: string; tint: string; ink: string };

function hash(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

// index: the team's 0-based order in its challenge (Team 1 -> 0). Without one, the id picks a stable slot.
export function teamStyle(teamId: string, index?: number | null): TeamStyle {
  const i = index ?? hash(teamId) % NAMES.length;
  const round = Math.floor(i / NAMES.length);
  return { name: `Team ${NAMES[i % NAMES.length]}${round > 0 ? ` ${round + 1}` : ''}`, ...TINTS[i % TINTS.length] };
}

// The server labels dealt teams 'Team 1', 'Team 2'...; this reads the order back out of that label.
export function teamIndexFromLabel(label: string): number | null {
  const n = /(\d+)\s*$/.exec(label)?.[1];
  return n ? Number(n) - 1 : null;
}
