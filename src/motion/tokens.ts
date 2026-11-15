import { Easing } from 'react-native-reanimated';

// Physics springs, shared with the CMHM-14 mockup's THEME.spring so the HTML preview and the app
// can't drift. They're interruptible: a new target picks up the current velocity.
export const Spring = {
  // Press release: critically damped, so a pressed control never overshoots past rest.
  release: { damping: 42, stiffness: 440, mass: 1 },
  // Seal stamp (claim, ready, lock-in, owned): stiff, one small settle. ~600ms.
  stamp: { damping: 22, stiffness: 400, mass: 1 },
  // Things that travel or arrive: suspect → slot, invite cells, nudge, checking. ~540ms.
  flight: { damping: 26, stiffness: 260, mass: 1 },
  // Paper: the dossier card, its lines, reveal credits. Slower and softer. ~655ms.
  file: { damping: 20, stiffness: 170, mass: 1 },
  // Sheets and the reconnecting banner. ~470ms.
  sheet: { damping: 30, stiffness: 300, mass: 1 },
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
  swap: 220,
  bleed: 320,
  exit: 160,
  stagger: 60,
  checkingHold: 1200,
} as const;
