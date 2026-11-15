import { useEffect, type ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

import { Enter } from './enter';
import { Haptic } from './haptics';

type Props = { children: ReactNode; play?: boolean; haptic?: boolean; style?: StyleProp<ViewStyle> };

// Wraps the screen's nudge card. It rises in as the check resolves wrong, with one warning haptic
// on the same frame. play=false (rejoin, already-seen seq) shows it in place, silently.
export function NudgeEntrance({ children, play = true, haptic = true, style }: Props) {
  useEffect(() => {
    if (play && haptic) Haptic.warning();
  }, [play, haptic]);
  return (
    <Enter play={play} from={14} style={style}>
      {children}
    </Enter>
  );
}
