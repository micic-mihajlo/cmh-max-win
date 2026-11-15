import { Image } from 'expo-image';
import { router, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Atmosphere } from '@/components/signal/backdrop';
import { Txt } from '@/components/signal/txt';
import { FontFamily, Palette, Radius, Space } from '@/constants/signal';
import { PressScale } from '@/motion';

export function Screen({
  children,
  scroll = true,
  back = true,
  title,
  right,
}: {
  children: ReactNode;
  scroll?: boolean;
  back?: boolean;
  title?: string;
  right?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const bar = (
    <View style={styles.bar}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        hitSlop={12}
        disabled={!back}
        style={styles.back}
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/showcase' as Href))}>
        {back ? (
          <Txt variant="title" style={styles.chevron}>
            ‹
          </Txt>
        ) : null}
      </Pressable>
      <Txt variant="bodyStrong" style={styles.barTitle} numberOfLines={1}>
        {title ?? ''}
      </Txt>
      <View style={styles.barRight}>{right}</View>
    </View>
  );
  const pad = { paddingTop: insets.top + Space.s, paddingBottom: insets.bottom + Space.xxxl };
  return (
    <View style={styles.screen}>
      <Atmosphere />
      {scroll ? (
        <ScrollView style={styles.flex} contentContainerStyle={pad} showsVerticalScrollIndicator={false}>
          {bar}
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.flex, pad]}>
          {bar}
          {children}
        </View>
      )}
    </View>
  );
}

const washes = ['#F3EDE0', '#E7EDF4', '#F4E6E1'];
export const Wash = { neutral: '#F1F0EB', pick: (key: string) => washes[key.charCodeAt(0) % washes.length] };

export function Avatar({ initials, uri, size = 44 }: { initials: string; uri?: string; size?: number }) {
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size, backgroundColor: Wash.pick(initials) }]}>
      {uri ? (
        <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size }} contentFit="cover" transition={150} accessibilityIgnoresInvertColors />
      ) : (
        <Txt style={{ fontFamily: FontFamily.displayBold, fontSize: size * 0.4, lineHeight: size * 0.5 }}>{initials}</Txt>
      )}
    </View>
  );
}

export function Section({ title, action, children, style }: { title: string; action?: ReactNode; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.section, style]}>
      <View style={styles.sectionHead}>
        <Txt variant="bodyStrong">{title}</Txt>
        {action}
      </View>
      {children}
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function TextAction({ title, onPress, muted }: { title: string; onPress?: () => void; muted?: boolean }) {
  return (
    <PressScale accessibilityRole="button" onPress={onPress} haptic="tap" hitSlop={12}>
      <Txt variant="label" style={styles.textAction} color={muted ? Palette.paperMuted : Palette.paper}>
        {title}
      </Txt>
    </PressScale>
  );
}

export function BigButton({ title, onPress, style }: { title: string; onPress?: () => void; style?: StyleProp<ViewStyle> }) {
  return (
    <PressScale accessibilityRole="button" onPress={onPress} haptic="tap" style={[styles.big, style]}>
      <Txt variant="button" color={Palette.ink}>
        {title}
      </Txt>
    </PressScale>
  );
}

export const showcase = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Space.m },
  flex: { flex: 1, minWidth: 0 },
  gutter: { paddingHorizontal: Space.xl },
  list: { gap: Space.xl },
});

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Palette.ink },
  flex: { flex: 1 },
  bar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Space.l, height: 44, marginBottom: Space.s },
  back: { width: 32 },
  chevron: { fontSize: 34, lineHeight: 40, marginTop: -4 },
  barTitle: { flex: 1, textAlign: 'center' },
  barRight: { minWidth: 32, alignItems: 'flex-end' },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  section: { marginTop: Space.xxl + Space.s, paddingHorizontal: Space.xl, gap: Space.l },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  card: { backgroundColor: Palette.card, borderRadius: Radius.l, padding: Space.xl },
  textAction: { fontFamily: FontFamily.uiSemi },
  big: { height: 52, borderRadius: 14, backgroundColor: Palette.paper, alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch' },
});
