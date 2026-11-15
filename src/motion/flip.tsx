import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { View, type HostInstance, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';

import { useReduced } from './reduced';
import { Duration, Ease, Spring } from './tokens';

export type Rect = { x: number; y: number; width: number; height: number };

export function measureRect(node: HostInstance | null): Promise<Rect | null> {
  return new Promise((resolve) => {
    if (!node) return resolve(null);
    node.measureInWindow((x, y, width, height) => resolve({ x, y, width, height }));
  });
}

type Props = {
  // Where the content came from on this screen (the card the user tapped). null: it changed
  // elsewhere (another player's edit), so it cross-fades in place instead of flying.
  from: Rect | null;
  flipKey: string | number;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

// FLIP: render in the final slot, measure, invert to the source rect, then spring home.
export function FlipFrom({ from, flipKey, children, style }: Props) {
  const ref = useRef<HostInstance>(null);
  const reduced = useReduced();
  const lastKey = useRef<string | number | null>(null);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const sx = useSharedValue(1);
  const sy = useSharedValue(1);
  const opacity = useSharedValue(1);

  useLayoutEffect(() => {
    if (lastKey.current === flipKey) return;
    const first = lastKey.current === null;
    lastKey.current = flipKey;
    if (first && !from) return;
    if (!from || reduced) {
      const swap = reduced ? Duration.fade : Duration.swap;
      opacity.set(withSequence(withTiming(0, { duration: 0 }), withTiming(1, { duration: swap, easing: Ease.out })));
      ty.set(withSequence(withTiming(reduced ? 0 : -8, { duration: 0 }), withTiming(0, { duration: swap, easing: Ease.out })));
      return;
    }
    opacity.set(0);
    ref.current?.measureInWindow((x, y, w, h) => {
      if (!w || !h) {
        opacity.set(1);
        return;
      }
      const go = (v: number, to: number) => withSequence(withTiming(v, { duration: 0 }), withSpring(to, Spring.flight));
      tx.set(go(from.x + from.width / 2 - (x + w / 2), 0));
      ty.set(go(from.y + from.height / 2 - (y + h / 2), 0));
      sx.set(go(from.width / w, 1));
      sy.set(go(from.height / h, 1));
      opacity.set(1);
    });
  }, [flipKey, from, reduced, tx, ty, sx, sy, opacity]);

  const animated = useAnimatedStyle(() => ({
    opacity: opacity.get(),
    transform: [{ translateX: tx.get() }, { translateY: ty.get() }, { scaleX: sx.get() }, { scaleY: sy.get() }],
  }));

  return (
    <View ref={ref} collapsable={false} style={style}>
      <Animated.View style={animated}>{children}</Animated.View>
    </View>
  );
}
