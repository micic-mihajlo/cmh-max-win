import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withDelay, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Txt } from '@/components/signal/txt';
import { Palette, Space } from '@/constants/signal';
import { Ease, Haptic, PressScale, useReduced } from '@/motion';

import { Avatar } from './kit';

export function InAppBanner({
  initials,
  title,
  body,
  onPress,
  onDone,
}: {
  initials: string;
  title: string;
  body: string;
  onPress?: () => void;
  onDone: () => void;
}) {
  const insets = useSafeAreaInsets();
  const reduced = useReduced();
  const shown = useSharedValue(0);
  useEffect(() => {
    Haptic.tap();
    shown.set(withSequence(withTiming(1, { duration: 220, easing: Ease.out }), withDelay(4000, withTiming(0, { duration: 220, easing: Ease.out }))));
    const id = setTimeout(onDone, 4440);
    return () => clearTimeout(id);
  }, [shown, onDone]);
  const style = useAnimatedStyle(() => ({
    opacity: shown.get(),
    transform: [{ translateY: reduced ? 0 : (1 - shown.get()) * -24 }],
  }));
  return (
    <Animated.View style={[styles.wrap, { top: insets.top + Space.s }, style]}>
      <PressScale scaleTo={0.98} haptic="tap" accessibilityRole="alert" onPress={onPress} style={styles.banner}>
        <Avatar initials={initials} size={36} />
        <View style={styles.body}>
          <Txt variant="smallStrong" numberOfLines={1}>
            {title}
          </Txt>
          <Txt variant="small" color={Palette.paperMuted} numberOfLines={1}>
            {body}
          </Txt>
        </View>
      </PressScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: Space.l, right: Space.l, zIndex: 10 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.m,
    padding: Space.m,
    borderRadius: 20,
    backgroundColor: Palette.card,
    shadowColor: Palette.paper,
    shadowOpacity: 0.06,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
  },
  body: { flex: 1, minWidth: 0 },
});
