import { Easing } from 'react-native-reanimated';

// Short springs (DIRECTION.md: Emil's rules, under 300ms). Written as perceived duration +
// damping ratio, so the number you read is roughly how long it takes to settle. They stay
// interruptible: a new target picks up the current velocity instead of restarting.
export const Spring = {
  // GUIDE spring (damping 20, stiffness 240, mass 0.8, ζ≈0.72): press-down and sheets, ~300ms to rest.
  press: { damping: 20, stiffness: 240, mass: 0.8 },
  // Press release: critically damped, never overshoots past rest.
  release: { duration: 160, dampingRatio: 1 },
  // Seal stamp (claim, ready, lock-in, owned): quick, one small settle.
  stamp: { duration: 240, dampingRatio: 0.72 },
  // Things that travel or arrive: suspect → slot, invite tiles, nudge, checking.
  flight: { duration: 280, dampingRatio: 0.9 },
  // The calm reveal: dossier lines, reveal credits. No overshoot.
  file: { duration: 300, dampingRatio: 1 },
  // Sheets and the reconnecting banner.
  sheet: { duration: 280, dampingRatio: 0.9 },
} as const;

export type SpringToken = (typeof Spring)[keyof typeof Spring];

export const Ease = {
  out: Easing.bezier(0.23, 1, 0.32, 1),
  inOut: Easing.bezier(0.77, 0, 0.175, 1),
  drawer: Easing.bezier(0.32, 0.72, 0, 1),
  linear: Easing.linear,
} as const;

export const Duration = {
  press: 100,
  fade: 150,
  clear: 200,
  swap: 200,
  bleed: 240,
  exit: 160,
  stagger: 50,
  // A deliberate hold, not an animation: the same beat on all three phones.
  checkingHold: 1200,
} as const;
