import { useEffect, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Palette } from './palette';
import { useReduced } from './reduced';
import { Duration, Ease, Spring } from './tokens';

type Props = {
  visible: boolean;
  children: ReactNode;
  // Waits this long before showing, so a blip never flashes a banner. Hiding is immediate.
  showAfterMs?: number;
  tone?: 'neutral' | 'away';
};

// Drops from under the status bar and goes back the way it came (spatial consistency).
export function StatusBanner({ visible, children, showAfterMs = 0, tone = 'neutral' }: Props) {
  const insets = useSafeAreaInsets();
  const reduced = useReduced();
  const shown = useSharedValue(0);

  useEffect(() => {
    if (!visible) {
      shown.set(withTiming(0, { duration: Duration.exit, easing: Ease.out }));
      return;
    }
    const t = setTimeout(() => {
      shown.set(reduced ? withTiming(1, { duration: Duration.fade, easing: Ease.out }) : withSpring(1, Spring.sheet));
    }, showAfterMs);
    return () => clearTimeout(t);
  }, [visible, showAfterMs, reduced, shown]);

  const animated = useAnimatedStyle(() => ({
    opacity: Math.min(1, shown.get() * 1.4),
    transform: [{ translateY: reduced ? 0 : (1 - shown.get()) * -(insets.top + 56) }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      accessibilityElementsHidden={!visible}
      importantForAccessibility={visible ? 'yes' : 'no-hide-descendants'}
      style={[styles.wrap, { top: insets.top + 6 }, animated]}>
      <View style={styles.pill}>
        <View style={[styles.dot, { backgroundColor: tone === 'away' ? Palette.muted : Palette.ember }]} />
        {typeof children === 'string' ? <Text style={styles.text}>{children}</Text> : children}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 10 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: Palette.panel,
    borderWidth: 1,
    borderColor: Palette.hairline,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  text: { fontSize: 15, color: Palette.paper },
});
