import type { ComponentProps, ReactNode } from 'react';
import { Pressable, type PressableProps } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { Haptic, type HapticName } from './haptics';
import { useReduced } from './reduced';
import { Duration, Ease, Spring } from './tokens';

type Props = Omit<PressableProps, 'children' | 'style'> & {
  children: ReactNode;
  style?: ComponentProps<typeof Animated.View>['style'];
  scaleTo?: number;
  haptic?: HapticName;
};

// Feedback on touch-down, commit on release. The press-in is a 100ms ease-out; the release is a
// spring, so a quick tap that lets go mid-press reverses from wherever it is.
export function PressScale({ children, style, scaleTo = 0.97, haptic, disabled, onPressIn, onPressOut, onPress, ...rest }: Props) {
  const reduced = useReduced();
  const pressed = useSharedValue(0);

  const animated = useAnimatedStyle(() => {
    const p = pressed.get();
    return reduced ? { opacity: 1 - p * 0.25 } : { transform: [{ scale: 1 - p * (1 - scaleTo) }] };
  });

  return (
    <Pressable
      {...rest}
      disabled={disabled}
      hitSlop={rest.hitSlop ?? 8}
      pressRetentionOffset={rest.pressRetentionOffset ?? 16}
      onPressIn={(e) => {
        pressed.set(withTiming(1, { duration: Duration.press, easing: Ease.out }));
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        pressed.set(withSpring(0, Spring.release));
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
