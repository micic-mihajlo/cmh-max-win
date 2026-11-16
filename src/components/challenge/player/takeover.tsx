import { useEffect, type ReactNode } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { Palette, Space } from '@/constants/signal';
import { Duration, Ease, Spring, useReduced } from '@/motion';

// A full-bleed paper sheet that rises over the screen, holds, and drops back to where it came from.
// A tap sends it away early; it never blocks the screen underneath for longer than its hold.
export function Takeover({ holdMs, onDone, children }: { holdMs: number; onDone: () => void; children: ReactNode }) {
  const reduced = useReduced();
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const p = useSharedValue(0);

  useEffect(() => {
    const finish = (done?: boolean) => {
      'worklet';
      if (done) scheduleOnRN(onDone);
    };
    const enter = reduced ? withTiming(1, { duration: Duration.fade, easing: Ease.out }) : withSpring(1, Spring.sheet);
    const exit = withTiming(0, { duration: reduced ? Duration.fade : Duration.bleed, easing: Ease.inOut }, finish);
    p.set(withSequence(enter, withDelay(holdMs, exit)));
  }, [holdMs, onDone, p, reduced]);

  const dismiss = () => p.set(withTiming(0, { duration: Duration.exit, easing: Ease.inOut }, (done) => done && scheduleOnRN(onDone)));

  const style = useAnimatedStyle(() =>
    reduced ? { opacity: p.get() } : { opacity: Math.min(1, p.get() * 3), transform: [{ translateY: (1 - p.get()) * height }] },
  );

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.sheet, style]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Continue" onPress={dismiss} style={[styles.fill, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.body}>{children}</View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: { backgroundColor: Palette.ink, zIndex: 10, boxShadow: '0 -8px 24px rgba(22,21,19,0.06)' },
  fill: { flex: 1 },
  body: { flex: 1, justifyContent: 'center', paddingHorizontal: Space.xl, gap: Space.s },
});
