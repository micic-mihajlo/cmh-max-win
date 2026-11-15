import { Children, isValidElement, useEffect, type ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';

import { useReduced } from './reduced';
import { Duration, Ease, Spring } from './tokens';

type EnterProps = {
  children: ReactNode;
  index?: number;
  play?: boolean;
  from?: number;
  stagger?: number;
  delay?: number;
  style?: StyleProp<ViewStyle>;
};

// Rises a few points into place with a settle spring; opacity leads so it never reads as a slide.
// Remount (change key) to replay. play=false renders in place with no motion (rejoin, first load).
export function Enter({ children, index = 0, play = true, from = 16, stagger = Duration.stagger, delay = 0, style }: EnterProps) {
  const reduced = useReduced();
  const progress = useSharedValue(play ? 0 : 1);

  useEffect(() => {
    if (!play) {
      progress.set(1);
      return;
    }
    const wait = delay + index * stagger;
    const to = reduced ? withTiming(1, { duration: Duration.fade, easing: Ease.out }) : withSpring(1, Spring.enter);
    progress.set(0);
    progress.set(withDelay(wait, to));
  }, [play, reduced, delay, index, stagger, progress]);

  const animated = useAnimatedStyle(() => {
    const p = progress.get();
    return {
      opacity: Math.min(1, p * 1.6),
      transform: [{ translateY: reduced ? 0 : (1 - p) * from }],
    };
  });

  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}

type StaggerProps = Omit<EnterProps, 'index' | 'style'> & { itemStyle?: StyleProp<ViewStyle> };

export function Stagger({ children, itemStyle, ...enter }: StaggerProps) {
  return Children.toArray(children).map((child, i) => (
    <Enter key={isValidElement(child) && child.key != null ? child.key : i} index={i} style={itemStyle} {...enter}>
      {child}
    </Enter>
  ));
}
