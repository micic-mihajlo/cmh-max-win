import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { cancelAnimation, Easing, FadeIn, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import { Txt } from '@/components/signal/txt';
import { FontFamily, Palette, Radius } from '@/constants/signal';
import { Haptic, useReduced } from '@/motion';

// Time left on the open question, from the server clock: a hairline that drains, and the whole seconds left.
function useSecondsLeft(closesAt: number | null, offset: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (closesAt === null) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [closesAt]);
  return closesAt === null ? 0 : Math.max(0, Math.ceil((closesAt - (now + offset)) / 1000));
}

// The header's quiet seconds. In the last five the heartbeat takes over, so this steps aside.
export function SecondsLeft({ closesAt, offset }: { closesAt: number | null; offset: number }) {
  const secs = useSecondsLeft(closesAt, offset);
  return (
    <Txt variant="time" color={Palette.paperMuted}>
      {secs > 5 ? `${secs}s` : ' '}
    </Txt>
  );
}

// The last five seconds take the empty band: big digits that tick on each second, with a selection haptic on the last three.
export function Heartbeat({ closesAt, offset }: { closesAt: number | null; offset: number }) {
  const secs = useSecondsLeft(closesAt, offset);
  const reduced = useReduced();
  const scale = useSharedValue(1);
  const shown = secs >= 1 && secs <= 5;
  useEffect(() => {
    if (secs < 1 || secs > 5) return;
    if (secs <= 3) Haptic.select();
    if (!reduced) scale.set(withSequence(withTiming(1.06, { duration: 60 }), withTiming(1, { duration: 60 })));
  }, [secs, reduced, scale]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  if (!shown) return null;
  return (
    <Animated.View entering={reduced ? undefined : FadeIn.duration(150)} style={style} accessibilityLiveRegion="polite" accessibilityLabel={`${secs} seconds left`}>
      <Text maxFontSizeMultiplier={1} style={styles.beat}>
        {secs}
      </Text>
    </Animated.View>
  );
}

export function DrainBar({ opensAt, closesAt, offset, stopped }: { opensAt: number | null; closesAt: number | null; offset: number; stopped: boolean }) {
  const p = useSharedValue(1);
  useEffect(() => {
    if (opensAt === null || closesAt === null) return;
    const now = Date.now() + offset;
    const total = Math.max(1, closesAt - opensAt);
    const remaining = Math.max(0, closesAt - now);
    p.set(remaining / total);
    if (stopped) {
      p.set(withTiming(0, { duration: 200 }));
      return;
    }
    p.set(withTiming(0, { duration: remaining, easing: Easing.linear }));
    return () => cancelAnimation(p);
  }, [opensAt, closesAt, offset, stopped, p]);
  const style = useAnimatedStyle(() => ({ transform: [{ scaleX: p.get() }] }));
  return (
    <View style={styles.track}>
      <Animated.View style={[styles.fill, style]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: 4, borderRadius: Radius.pill, backgroundColor: Palette.paperShade, overflow: 'hidden' },
  beat: { fontFamily: FontFamily.uiBold, fontSize: 120, lineHeight: 128, letterSpacing: -4, color: Palette.paper, fontVariant: ['tabular-nums'], textAlign: 'center' },
  fill: { ...StyleSheet.absoluteFill, backgroundColor: Palette.paper, transformOrigin: 'left' },
});
