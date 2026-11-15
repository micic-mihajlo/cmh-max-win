import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import { Palette } from '@/constants/signal';
import { Ease, useReduced } from '@/motion';

import { Avatar } from './kit';

export function LiveAvatar({ initials, size = 56 }: { initials: string; size?: number }) {
  const reduced = useReduced();
  const pulse = useSharedValue(1);
  useEffect(() => {
    if (reduced) return;
    pulse.set(withSequence(withTiming(1.5, { duration: 150, easing: Ease.out }), withTiming(1, { duration: 150, easing: Ease.out })));
  }, [reduced, pulse]);
  const dot = useAnimatedStyle(() => ({ transform: [{ scale: pulse.get() }] }));
  return (
    <View style={styles.wrap}>
      <Avatar initials={initials} size={size} />
      <Animated.View style={[styles.dot, dot]} accessibilityLabel="Live" />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'flex-start' },
  dot: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 3,
    borderColor: Palette.ink,
    backgroundColor: Palette.ember,
  },
});
