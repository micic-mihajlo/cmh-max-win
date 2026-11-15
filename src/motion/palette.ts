import { createContext, useContext } from 'react';

import type { Role } from '@/lib/contract';

// Every primitive reads its colors from here, so a screen can swap the palette with one provider.
export type MotionColors = {
  canvas: string;
  card: string;
  ink: string;
  muted: string;
  faint: string;
  hairline: string;
  accent: string;
  onAccent: string;
  accentSoft: string;
  onRole: string;
  owned: string;
};

// Paper & Type (DIRECTION.md, Nov 15): the default.
export const PaperColors: MotionColors = {
  canvas: '#F7F6F2',
  card: '#FFFFFF',
  ink: '#1A1916',
  muted: '#6B675F',
  faint: '#A29D93',
  hairline: '#E6E3DC',
  accent: '#E39B5B',
  onAccent: '#1A1916',
  accentSoft: '#FFF1E6',
  onRole: '#1A1916',
  owned: '#D9B26F',
};

// Midnight Editorial, kept so the dark build still works.
export const MidnightColors: MotionColors = {
  canvas: '#0E0F13',
  card: '#181A21',
  ink: '#EDE6DA',
  muted: '#94908A',
  faint: '#7E7B77',
  hairline: '#29292B',
  accent: '#E39B5B',
  onAccent: '#0E0F13',
  accentSoft: '#2A211A',
  onRole: '#0E0F13',
  owned: '#D9B26F',
};

const ColorsContext = createContext<MotionColors>(PaperColors);

export const MotionColorsProvider = ColorsContext.Provider;

export function useMotionColors() {
  return useContext(ColorsContext);
}

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
