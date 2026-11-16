import { FadeIn, FadeOut, ReduceMotion, SlideInDown, SlideOutDown } from 'react-native-reanimated';

import { Duration, Spring } from './tokens';

// Sheets rise on the GUIDE spring (settles in ~300ms, one small settle) and leave faster than they came.
// Reduce Motion keeps a fade so the sheet still arrives instead of popping in.
export const Sheet = {
  enter: (reduced: boolean) =>
    reduced
      ? FadeIn.duration(Duration.fade).reduceMotion(ReduceMotion.Never)
      : SlideInDown.springify().damping(Spring.press.damping).stiffness(Spring.press.stiffness).mass(Spring.press.mass),
  exit: (reduced: boolean) =>
    reduced ? FadeOut.duration(Duration.exit).reduceMotion(ReduceMotion.Never) : SlideOutDown.duration(Duration.exit),
  scrimIn: FadeIn.duration(Duration.fade).reduceMotion(ReduceMotion.Never),
  scrimOut: FadeOut.duration(Duration.exit).reduceMotion(ReduceMotion.Never),
} as const;
