import type { ReactNode } from 'react';
import { Image, ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
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
  grain: { width: '100%', height: '100%', opacity: 0.035 },
});
