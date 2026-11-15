import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Enter } from './enter';
import { Palette } from './palette';
import { useReduced } from './reduced';
import { Duration, Ease } from './tokens';

// Holds "Checking…" for at least minMs on every phone. key: a new value starts a hold (the screen
// passes lastCheck.seq once it decides to play it, or null on first load). pending: the third
// phone's in-flight lockIn, which extends the hold if the server is slower than minMs.
export function useCheckingHold(key: string | number | null, pending = false, minMs: number = Duration.checkingHold) {
  const [settled, setSettled] = useState<string | number | null>(null);
  useEffect(() => {
    if (key == null) return;
    const t = setTimeout(() => setSettled(key), minMs);
    return () => clearTimeout(t);
  }, [key, minMs]);
  return pending || (key != null && settled !== key);
}

type Props = { label?: string; minMs?: number; color?: string };

// Mount while checking. A hairline fills linearly across the hold: constant motion, so linear.
export function Checking({ label = 'Checking…', minMs = Duration.checkingHold, color = Palette.paper }: Props) {
  const reduced = useReduced();
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reduced) return;
    progress.set(withTiming(1, { duration: minMs, easing: Ease.linear }));
  }, [reduced, minMs, progress]);

  const fill = useAnimatedStyle(() => ({ transform: [{ scaleX: progress.get() }] }));

  return (
    <Enter from={6} style={styles.wrap}>
      <Text accessibilityLiveRegion="polite" style={[styles.label, { color }]}>
        {label}
      </Text>
      {!reduced && (
        <View style={styles.track}>
          <Animated.View style={[styles.fill, { backgroundColor: color }, fill]} />
        </View>
      )}
    </Enter>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 10 },
  label: { fontSize: 15, lineHeight: 22 },
  track: { width: 120, height: 1, backgroundColor: Palette.hairline, overflow: 'hidden' },
  fill: { width: 120, height: 1, transformOrigin: 'left' },
});
