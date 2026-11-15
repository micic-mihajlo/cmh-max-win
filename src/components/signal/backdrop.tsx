import type { ReactNode } from 'react';
import { Image, ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useFrameCallback, useSharedValue } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Palette, Space } from '@/constants/signal';

import { useMotionReduced } from './settings';

const grain = require('@/assets/images/signal/grain.png');

export function Atmosphere() {
  const reduced = useMotionReduced();
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const last = useSharedValue(0);
  useFrameCallback((frame) => {
    if (frame.timestamp - last.value < 125) return;
    last.value = frame.timestamp;
    x.value = -Math.floor(Math.random() * 48);
    y.value = -Math.floor(Math.random() * 48);
  }, !reduced);
  const grainStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }, { translateY: y.value }] }));
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View style={[styles.grainWrap, grainStyle]}>
        <Image source={grain} resizeMode="repeat" style={styles.grain} />
      </Animated.View>
      <View style={styles.vignette} />
    </View>
  );
}

export function Screen({
  children,
  footer,
  overlay,
  header,
  scroll = true,
  contentStyle,
}: {
  children: ReactNode;
  footer?: ReactNode;
  overlay?: ReactNode;
  header?: ReactNode;
  scroll?: boolean;
  contentStyle?: ViewStyle;
}) {
  return (
    <View style={styles.root}>
      <Atmosphere />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        {header}
        {scroll ? (
          <ScrollView
            style={styles.flex}
            contentContainerStyle={[styles.content, contentStyle]}
            showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.flex, styles.content, contentStyle]}>{children}</View>
        )}
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </SafeAreaView>
      {overlay}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Palette.ink },
  safe: { flex: 1 },
  flex: { flex: 1 },
  content: { paddingHorizontal: Space.xl, paddingTop: Space.l, paddingBottom: Space.xxl, gap: Space.l },
  footer: { paddingHorizontal: Space.xl, paddingTop: Space.m, paddingBottom: Space.s, gap: Space.m },
  grainWrap: { position: 'absolute', top: 0, left: 0, right: -64, bottom: -64 },
  grain: { width: '100%', height: '100%', opacity: 0.06 },
  vignette: {
    ...StyleSheet.absoluteFill,
    backgroundImage: 'radial-gradient(ellipse farthest-corner at 50% 40%, transparent 55%, rgba(0,0,0,0.55) 100%)',
  },
});
