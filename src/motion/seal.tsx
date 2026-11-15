import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Fonts } from '@/constants/theme';

import { Haptic } from './haptics';
import { Palette } from './palette';
import { useReduced } from './reduced';
import { Duration, Ease, Spring } from './tokens';

type Props = {
  locked: boolean;
  color: string;
  initial: string;
  // false: jump to the state without motion (first load, rejoin, a seq this phone already saw).
  play?: boolean;
  size?: number;
  // Away / stepped-away holder: the seal dims, its lock-in stays valid.
  dimmed?: boolean;
  // Only for this phone's own lock-in. Other players' stamps stay silent.
  haptic?: boolean;
  onDone?: (locked: boolean) => void;
  accessibilityLabel?: string;
};

// Stateless seal stamp (RESEARCH §4.4): 1.35x and -8deg down to rest on a stiff spring with a little
// bounce, then a 1pt ink-bleed ring. Clearing is a 200ms fade with no shake; edits aren't punitive.
export function Seal({ locked, color, initial, play = true, size = 56, dimmed = false, haptic = false, onDone, accessibilityLabel }: Props) {
  const reduced = useReduced();
  const fill = useSharedValue(locked ? 1 : 0);
  const scale = useSharedValue(1);
  const rotate = useSharedValue(0);
  const bleed = useSharedValue(1);
  const stamping = useSharedValue(false);
  const previous = useRef(locked);

  useEffect(() => {
    if (previous.current === locked) return;
    previous.current = locked;
    const finish = (finished?: boolean) => {
      'worklet';
      if (finished && onDone) scheduleOnRN(onDone, locked);
    };

    if (!play) {
      fill.set(locked ? 1 : 0);
      onDone?.(locked);
      return;
    }
    if (!locked) {
      fill.set(withTiming(0, { duration: Duration.clear, easing: Ease.out }, finish));
      return;
    }
    if (reduced) {
      if (haptic) Haptic.tap();
      fill.set(withTiming(1, { duration: Duration.fade, easing: Ease.out }, finish));
      return;
    }
    stamping.set(true);
    fill.set(withSequence(withTiming(0, { duration: 0 }), withTiming(1, { duration: 90, easing: Ease.out })));
    rotate.set(withSequence(withTiming(-8, { duration: 0 }), withSpring(0, Spring.stamp)));
    scale.set(withSequence(withTiming(1.35, { duration: 0 }), withSpring(1, Spring.stamp, finish)));
  }, [locked, play, reduced, haptic, onDone, fill, scale, rotate, stamping]);

  // The stamp "lands" the first frame it reaches rest size: the bleed ring and the haptic start there.
  useAnimatedReaction(
    () => scale.get() <= 1.002,
    (landed, before) => {
      if (!landed || before !== false || !stamping.get()) return;
      stamping.set(false);
      bleed.set(withSequence(withTiming(0, { duration: 0 }), withTiming(1, { duration: Duration.bleed, easing: Ease.out })));
      if (haptic) scheduleOnRN(Haptic.tap);
    },
  );

  const discStyle = useAnimatedStyle(() => ({
    opacity: fill.get(),
    transform: [{ rotate: `${rotate.get()}deg` }, { scale: scale.get() }],
  }));
  const bleedStyle = useAnimatedStyle(() => ({
    opacity: (1 - bleed.get()) * 0.7,
    transform: [{ scale: 1 + bleed.get() * 0.45 }],
  }));

  const ring = { width: size, height: size, borderRadius: size / 2 };
  return (
    <Animated.View
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel ?? (locked ? `${initial} locked in` : `${initial} not locked`)}
      style={[
        ring,
        { opacity: dimmed ? 0.4 : 1, transitionProperty: 'opacity', transitionDuration: Duration.clear },
      ]}>
      <View style={[StyleSheet.absoluteFill, ring, styles.empty, { borderColor: color }]} />
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, ring, styles.bleed, { borderColor: color }, bleedStyle]} />
      <Animated.View style={[StyleSheet.absoluteFill, ring, styles.disc, { backgroundColor: color }, discStyle]}>
        <Text allowFontScaling={false} style={[styles.initial, { fontSize: size * 0.42 }]}>
          {initial}
        </Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  empty: { borderWidth: 1.5, borderStyle: 'dashed' },
  bleed: { borderWidth: 1 },
  disc: { alignItems: 'center', justifyContent: 'center' },
  initial: { fontFamily: Fonts.serif, fontWeight: '600', color: Palette.ink },
});
