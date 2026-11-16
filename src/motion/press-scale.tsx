import type { ComponentProps, ReactNode } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { Haptic, type HapticName } from './haptics';
import { useReduced } from './reduced';
import { Spring } from './tokens';

type Props = Omit<PressableProps, 'children' | 'style'> & {
  children: ReactNode;
  style?: ComponentProps<typeof Animated.View>['style'];
  outerStyle?: StyleProp<ViewStyle>;
  scaleTo?: number;
  haptic?: HapticName;
};

const pressIn = { ...Spring.press, reduceMotion: ReduceMotion.Never };
const release = { ...Spring.release, reduceMotion: ReduceMotion.Never };

// Feedback on touch-down, commit on release. Both directions are springs, so a quick tap that lets go
// mid-press reverses from wherever it is. Reduce Motion swaps the scale for a dim that still animates.
export function PressScale({ children, style, outerStyle, scaleTo = 0.97, haptic, disabled, onPressIn, onPressOut, onPress, ...rest }: Props) {
  const reduced = useReduced();
  const pressed = useSharedValue(0);

  const animated = useAnimatedStyle(() => {
    const p = pressed.get();
    return reduced ? { opacity: 1 - p * 0.25 } : { transform: [{ scale: 1 - p * (1 - scaleTo) }] };
  });

  return (
    <Pressable
      {...rest}
      style={outerStyle}
      accessibilityRole={rest.accessibilityRole ?? 'button'}
      disabled={disabled}
      hitSlop={rest.hitSlop ?? 8}
      pressRetentionOffset={rest.pressRetentionOffset ?? 16}
      onPressIn={(e) => {
        pressed.set(withSpring(1, pressIn));
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        pressed.set(withSpring(0, release));
        onPressOut?.(e);
      }}
      onPress={(e) => {
        if (haptic) Haptic[haptic]();
        onPress?.(e);
      }}>
      <Animated.View style={[style, animated]}>{children}</Animated.View>
    </Pressable>
  );
}
