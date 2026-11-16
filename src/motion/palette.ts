import { createContext, useContext } from 'react';

import { Palette } from '@/constants/signal';
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

// The app theme (src/constants/signal.ts): the default.
export const PaperColors: MotionColors = {
  canvas: Palette.ink,
  card: Palette.card,
  ink: Palette.paper,
  muted: Palette.paperMuted,
  faint: Palette.paperMuted,
  hairline: Palette.hairline,
  accent: Palette.ember,
  onAccent: Palette.onAccent,
  accentSoft: Palette.accentSoft,
  onRole: Palette.card,
  owned: Palette.paper,
};

// Midnight Editorial, kept so the dark build still works.
export const MidnightColors: MotionColors = {
  canvas: '#0E0F13',
  card: '#181A21',
  ink: '#EDE6DA',
  muted: '#94908A',
  faint: '#7E7B77',
  hairline: '#29292B',
  accent: Palette.ember,
  onAccent: Palette.onAccent,
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
