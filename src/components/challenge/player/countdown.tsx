import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import { Txt } from '@/components/signal/txt';
import { Palette, Radius } from '@/constants/signal';
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

export function SecondsLeft({ closesAt, offset }: { closesAt: number | null; offset: number }) {
  const secs = useSecondsLeft(closesAt, offset);
  const reduced = useReduced();
  const scale = useSharedValue(1);
  useEffect(() => {
    if (secs < 1 || secs > 3) return;
    Haptic.select();
    if (!reduced) scale.set(withSequence(withTiming(1.06, { duration: 60 }), withTiming(1, { duration: 60 })));
  }, [secs, reduced, scale]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  return (
    <Animated.View style={style}>
      <Txt variant="time" color={secs <= 3 ? Palette.paper : Palette.paperMuted}>
        {`${secs}s`}
      </Txt>
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
  fill: { ...StyleSheet.absoluteFill, backgroundColor: Palette.paper, transformOrigin: 'left' },
});
