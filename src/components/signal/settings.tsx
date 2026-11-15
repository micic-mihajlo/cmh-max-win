import { createContext, use } from 'react';
import { useReducedMotion } from 'react-native-reanimated';

export type DisplaySettings = { typeScale: number; reduceMotion: boolean | null };

export const DisplaySettingsContext = createContext<DisplaySettings>({ typeScale: 1, reduceMotion: null });

export function useTypeScale() {
  return use(DisplaySettingsContext).typeScale;
}

export function useMotionReduced() {
  const system = useReducedMotion();
  const { reduceMotion } = use(DisplaySettingsContext);
  return reduceMotion ?? system;
}
