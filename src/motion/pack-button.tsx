import { useEffect, useRef } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, Keyframe } from 'react-native-reanimated';

import type { SeasonPackState } from '@/lib/contract';

import { Haptic } from './haptics';
import { useMotionColors } from './palette';
import { PressScale } from './press-scale';
import { useReduced } from './reduced';
import { Seal } from './seal';
import { Duration, Ease } from './tokens';

type Props = {
  state: SeasonPackState;
  onBuy: () => void;
  price?: string;
  sandbox?: boolean;
  play?: boolean;
};

const contentIn = new Keyframe({
  0: { opacity: 0, transform: [{ translateY: 6 }] },
  100: { opacity: 1, transform: [{ translateY: 0 }], easing: Ease.out },
}).duration(220);

// One surface that morphs through locked → checkout → verifying → owned. Background and border
// cross-fade; the label swaps in place. Owned gets sealed with the same stamp as a lock-in.
export function PackButton({ state, onBuy, price, sandbox = false, play = true }: Props) {
  const reduced = useReduced();
  const colors = useMotionColors();
  const previous = useRef(state);
  useEffect(() => {
    if (previous.current !== state && state === 'owned' && play) Haptic.success();
    previous.current = state;
  }, [state, play]);

  const owned = state === 'owned';
  const busy = state === 'checkout' || state === 'verifying';
  const quiet = owned || state === 'verifying';
  const surface = quiet
    ? { backgroundColor: colors.card, borderColor: owned ? colors.owned : colors.hairline }
    : { backgroundColor: colors.accent, borderColor: colors.accent };
  const entering = !play ? undefined : reduced ? FadeIn.duration(Duration.fade) : contentIn;
  const exiting = !play ? undefined : FadeOut.duration(100);
  const fg = quiet ? colors.ink : colors.onAccent;

  return (
    <PressScale
      disabled={state !== 'locked'}
      onPress={onBuy}
      accessibilityRole="button"
      accessibilityState={{ busy, disabled: state !== 'locked' }}
      style={styles.base}>
      <Animated.View style={[styles.surface, surface, { transitionProperty: ['backgroundColor', 'borderColor'], transitionDuration: Duration.clear }]} />
      <Animated.View key={state} entering={entering} exiting={exiting} style={styles.content}>
        {state === 'locked' && (
          <Text style={[styles.label, { color: fg }]}>{price ? `Get the season · ${price}` : 'Get the season'}</Text>
        )}
        {state === 'checkout' && <Text style={[styles.label, { color: fg }]}>Opening Whop…</Text>}
        {state === 'verifying' && (
          <>
            <ActivityIndicator size="small" color={colors.muted} />
            <Text style={[styles.label, { color: fg }]}>Confirming your purchase…</Text>
          </>
        )}
        {owned && (
          <>
            <Seal locked color={colors.owned} initial="✓" size={24} play={play} />
            <View>
              <Text style={[styles.label, { color: fg }]}>Season 01 is yours</Text>
              {sandbox && <Text style={[styles.sub, { color: colors.muted }]}>Test purchase</Text>}
            </View>
          </>
        )}
      </Animated.View>
    </PressScale>
  );
}

const styles = StyleSheet.create({
  base: { height: 60 },
  surface: { ...StyleSheet.absoluteFill, borderRadius: 14, borderWidth: 1 },
  content: { ...StyleSheet.absoluteFill, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  label: { fontSize: 17, fontWeight: '600' },
  sub: { fontSize: 13 },
});
