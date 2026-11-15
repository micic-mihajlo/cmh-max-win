import type { Role } from '@/lib/contract';

// Midnight Editorial (RESEARCH.md §4). Defaults for the motion primitives and the lab only;
// screens pass their own colors from src/constants once the theme lands there.
export const Palette = {
  ink: '#0E0F13',
  panel: '#181A21',
  paper: '#EDE6DA',
  hairline: '#29292B',
  muted: '#94908A',
  faint: '#7E7B77',
  ember: '#E39B5B',
  brass: '#D9B26F',
} as const;

export const RoleColor: Record<Role, string> = {
  detective: '#D9B26F',
  hacker: '#86A9D6',
  witness: '#D98E7C',
};

export const RoleInitial: Record<Role, string> = {
  detective: 'D',
  hacker: 'H',
  witness: 'W',
};

export const RoleLabel: Record<Role, string> = {
  detective: 'Detective',
  hacker: 'Hacker',
  witness: 'Witness',
};
