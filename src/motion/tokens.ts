import { Easing } from 'react-native-reanimated';

// Springs use Apple's two designer parameters (perceived duration + damping ratio), so they stay
// interruptible: a new target picks up the current velocity instead of restarting from zero.
export const Spring = {
  release: { duration: 260, dampingRatio: 1 },
  stamp: { duration: 360, dampingRatio: 0.6 },
  enter: { duration: 420, dampingRatio: 0.9 },
  move: { duration: 460, dampingRatio: 0.82 },
  banner: { duration: 320, dampingRatio: 0.85 },
} as const;

export const Ease = {
  out: Easing.bezier(0.23, 1, 0.32, 1),
  inOut: Easing.bezier(0.77, 0, 0.175, 1),
  linear: Easing.linear,
} as const;

export const Duration = {
  press: 100,
  fade: 150,
  clear: 200,
  bleed: 320,
  exit: 180,
  stagger: 60,
  checkingHold: 1200,
} as const;
