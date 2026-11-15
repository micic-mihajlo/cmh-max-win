import { router, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
  if (!scroll)
    return (
      <View style={[styles.screen, pad]}>
        {bar}
        {children}
      </View>
    );
  return (
    <ScrollView style={styles.screen} contentContainerStyle={pad} showsVerticalScrollIndicator={false}>
      {bar}
      {children}
    </ScrollView>
  );
}

export function Avatar({ initials, size = 44, live, tone = 'soft' }: { initials: string; size?: number; live?: boolean; tone?: 'soft' | 'ink' | 'card' }) {
  const bg = tone === 'ink' ? Palette.paper : tone === 'card' ? Palette.card : Palette.accentSoft;
  const fg = tone === 'ink' ? Palette.ink : Palette.paper;
  return (
    <View style={[styles.ring, { width: size + 8, height: size + 8, borderRadius: size, borderColor: live ? Palette.ember : 'transparent' }]}>
      <View style={[styles.avatar, { width: size, height: size, borderRadius: size, backgroundColor: bg }]}>
        <Txt style={{ fontFamily: FontFamily.displayBold, fontSize: size * 0.4, lineHeight: size * 0.5 }} color={fg}>
          {initials}
        </Txt>
      </View>
    </View>
  );
}

export function Section({ title, action, children, style }: { title: string; action?: ReactNode; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.section, style]}>
      <View style={styles.sectionHead}>
        <Txt variant="name">{title}</Txt>
        {action}
      </View>
      {children}
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Pill({
  title,
  onPress,
  tone = 'line',
  style,
}: {
  title: string;
  onPress?: () => void;
  tone?: 'ember' | 'line' | 'ink' | 'soft';
  style?: StyleProp<ViewStyle>;
}) {
  const bg = tone === 'ember' ? Palette.ember : tone === 'ink' ? Palette.paper : tone === 'soft' ? Palette.accentSoft : Palette.card;
  const fg = tone === 'ink' ? Palette.ink : Palette.paper;
  return (
    <PressScale accessibilityRole="button" onPress={onPress} haptic="tap" style={[styles.pill, { backgroundColor: bg, borderColor: tone === 'line' ? Palette.hairline : bg }, style]}>
      <Txt variant="smallStrong" color={fg}>
        {title}
      </Txt>
    </PressScale>
  );
}

export function BigButton({ title, onPress, tone = 'ember' }: { title: string; onPress?: () => void; tone?: 'ember' | 'ink' | 'line' }) {
  const bg = tone === 'ember' ? Palette.ember : tone === 'ink' ? Palette.paper : Palette.card;
  const fg = tone === 'ink' ? Palette.ink : Palette.paper;
  return (
    <PressScale accessibilityRole="button" onPress={onPress} haptic="tap" style={[styles.big, { backgroundColor: bg, borderColor: tone === 'line' ? Palette.hairline : bg }]}>
      <Txt variant="button" color={fg}>
        {title}
      </Txt>
    </PressScale>
  );
}

export function Hairline({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.hairline, style]} />;
}

export const showcase = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Space.m },
  flex: { flex: 1, minWidth: 0 },
  gutter: { paddingHorizontal: Space.xl },
});

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Palette.ink },
  bar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Space.l, height: 44, marginBottom: Space.s },
  back: { width: 32 },
  chevron: { fontSize: 34, lineHeight: 40, marginTop: -4 },
  barTitle: { flex: 1, textAlign: 'center' },
  barRight: { minWidth: 32, alignItems: 'flex-end' },
  ring: { borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  avatar: { alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: Palette.hairline },
  section: { marginTop: Space.xxl, paddingHorizontal: Space.xl, gap: Space.m },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  card: { backgroundColor: Palette.card, borderRadius: Radius.m, borderWidth: 1, borderColor: Palette.hairline, padding: Space.l },
  pill: { borderRadius: Radius.pill, borderWidth: 1, paddingHorizontal: Space.l, paddingVertical: Space.s, alignItems: 'center' },
  big: { height: 56, borderRadius: Radius.m, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  hairline: { height: 1, backgroundColor: Palette.hairline },
});
