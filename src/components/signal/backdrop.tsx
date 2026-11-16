import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Palette, Space } from '@/constants/signal';

const grain = require('@/assets/images/signal/grain.png');

export function Atmosphere() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Image source={grain} resizeMode="repeat" style={styles.grain} />
    </View>
  );
}

// Stands in while a screen's first query answers: the page colour and grain, no spinner. Most loads land
// inside the push transition; only one that runs past 600ms fades a spinner in.
export function Pending() {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setSlow(true), 600);
    return () => clearTimeout(id);
  }, []);
  return (
    <View style={styles.pending}>
      <Atmosphere />
      {slow ? (
        <Animated.View entering={FadeIn.duration(150).reduceMotion(ReduceMotion.Never)}>
          <ActivityIndicator color={Palette.paperMuted} />
        </Animated.View>
      ) : null}
    </View>
  );
}

// Wrap the real layout that replaces <Pending />, so the data arrives with a 150ms fade instead of a cut.
export function Arrive({ children }: { children: ReactNode }) {
  return (
    <Animated.View entering={FadeIn.duration(150).reduceMotion(ReduceMotion.Never)} style={styles.flex}>
      {children}
    </Animated.View>
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
  pending: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Palette.ink },
  safe: { flex: 1 },
  flex: { flex: 1 },
  content: { paddingHorizontal: Space.xl, paddingTop: Space.l, paddingBottom: Space.xxl, gap: Space.l },
  footer: { paddingHorizontal: Space.xl, paddingTop: Space.m, paddingBottom: Space.s, gap: Space.m },
  grain: { width: '100%', height: '100%', opacity: 0.035 },
});
