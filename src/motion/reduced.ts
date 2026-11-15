import { createContext, useContext } from 'react';
import { useReducedMotion } from 'react-native-reanimated';

const Override = createContext<boolean | null>(null);

// Lets the lab (or a screenshot run) force reduced motion without touching iOS Settings.
export const ReducedMotionOverride = Override.Provider;

export function useReduced() {
  const system = useReducedMotion();
  return useContext(Override) ?? system;
}
