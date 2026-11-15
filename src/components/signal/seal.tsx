import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';

import { FontFamily, Palette, RoleMeta } from '@/constants/signal';
import type { Role } from '@/lib/contract';

import { useMotionReduced } from './settings';
import { Txt } from './txt';

export function Seal({
  role,
  filled,
  size = 64,
  broken,
  delay = 0,
}: {
  role: Role;
  filled: boolean;
  size?: number;
  broken?: boolean;
  delay?: number;
}) {
  const reduced = useMotionReduced();
  const meta = RoleMeta[role];
  const stamp = useSharedValue(0);
  const bleed = useSharedValue(0);
  useEffect(() => {
    if (!filled) {
      stamp.value = withTiming(0, { duration: 200 });
      return;
    }
    if (reduced) {
      stamp.value = withDelay(delay, withTiming(1, { duration: 150 }));
      return;
    }
    stamp.value = withDelay(delay, withSpring(1, { damping: 16, stiffness: 320 }));
    bleed.value = 0;
    bleed.value = withDelay(delay + 120, withTiming(1, { duration: 300 }));
  }, [filled, reduced, delay, stamp, bleed]);
  const ink = useAnimatedStyle(() =>
    reduced
      ? { opacity: stamp.value }
      : {
          opacity: Math.min(1, stamp.value * 1.4),
          transform: [{ scale: 1.35 - stamp.value * 0.35 }, { rotate: `${-8 + stamp.value * 8}deg` }],
        },
  );
  const ring = useAnimatedStyle(() => ({ opacity: bleed.value > 0 && bleed.value < 1 ? 1 - bleed.value : 0, transform: [{ scale: 1 + bleed.value * 0.35 }] }));
  return (
    <View accessible accessibilityLabel={`${meta.label} ${filled ? 'locked in' : 'not locked in'}`} style={{ width: size, height: size }}>
      <View
        style={[
          StyleSheet.absoluteFill,
          styles.empty,
          { borderRadius: size, borderColor: broken ? Palette.paperFaint : meta.color, opacity: broken ? 0.7 : 1 },
        ]}>
        <Txt style={{ fontFamily: FontFamily.display, fontSize: size * 0.34, lineHeight: size * 0.44, color: meta.color, opacity: 0.6 }}>{meta.glyph}</Txt>
      </View>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: size, borderWidth: 1, borderColor: meta.color }, ring]} />
      <Animated.View style={[StyleSheet.absoluteFill, styles.center, ink]}>
        <View style={[StyleSheet.absoluteFill, { borderRadius: size, backgroundColor: meta.color }]} />
        <View
          style={{
            position: 'absolute',
            top: size * 0.09,
            left: size * 0.09,
            right: size * 0.09,
            bottom: size * 0.09,
            borderRadius: size,
            borderWidth: 1.5,
            borderColor: 'rgba(14,15,19,0.5)',
            borderStyle: 'dashed',
          }}
        />
        <Txt style={{ fontFamily: FontFamily.displayBold, fontSize: size * 0.38, lineHeight: size * 0.46, color: Palette.ink }}>{meta.glyph}</Txt>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { borderWidth: 1.5, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  center: { alignItems: 'center', justifyContent: 'center' },
});
