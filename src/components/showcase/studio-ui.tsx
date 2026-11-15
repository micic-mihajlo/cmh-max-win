import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FontFamily, Palette, Radius, RoleMeta, Space } from '@/constants/signal';
import { Txt } from '@/components/signal/txt';
import { PressScale } from '@/motion';

import type { BuilderRole } from './validate';

export function StudioScreen({ title, kicker, children, footer, onBack }: { title: string; kicker?: string; children: ReactNode; footer?: ReactNode; onBack?: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + Space.m, paddingBottom: insets.bottom + (footer ? 120 : Space.xxxl) }]}>
        <Pressable accessibilityRole="button" hitSlop={12} onPress={onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/')))} style={styles.back}>
          <Txt variant="label" color={Palette.paperMuted}>
            ‹ Back
          </Txt>
        </Pressable>
        {kicker ? (
          <Txt variant="label" color={Palette.emberDeep}>
            {kicker}
          </Txt>
        ) : null}
        <Txt variant="title" style={styles.title}>
          {title}
        </Txt>
        {children}
      </ScrollView>
      {footer ? <View style={[styles.footer, { paddingBottom: insets.bottom + Space.l }]}>{footer}</View> : null}
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Section({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Txt variant="name">{title}</Txt>
        {action}
      </View>
      {children}
    </View>
  );
}

export function Chip({ label, selected, onPress, tone = 'plain' }: { label: string; selected?: boolean; onPress?: () => void; tone?: 'plain' | 'soft' }) {
  const body = (
    <View style={[styles.chip, tone === 'soft' && styles.chipSoft, selected && styles.chipOn]}>
      <Txt variant="smallStrong" color={Palette.paper}>
        {label}
      </Txt>
    </View>
  );
  if (!onPress) return body;
  return (
    <PressScale accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} haptic="tap">
      {body}
    </PressScale>
  );
}

export function RolePill({ role, docLabel }: { role: BuilderRole; docLabel: string }) {
  return (
    <View style={styles.rolePill}>
      <Txt variant="label" color={Palette.paper}>
        {docLabel} · {RoleMeta[role].label}
      </Txt>
    </View>
  );
}

export function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Txt style={styles.statValue}>{value}</Txt>
      <Txt variant="small" color={Palette.paperMuted}>
        {label}
      </Txt>
    </View>
  );
}

export function PrimaryButton({ title, onPress, variant = 'primary', disabled }: { title: string; onPress?: () => void; variant?: 'primary' | 'secondary'; disabled?: boolean }) {
  return (
    <View style={styles.flex}>
      <PressScale accessibilityRole="button" disabled={disabled} onPress={onPress} haptic="tap">
        <View style={[styles.button, variant === 'primary' ? styles.buttonPrimary : styles.buttonSecondary, disabled && styles.buttonDisabled]}>
          <Txt variant="button" color={disabled ? Palette.disabledText : Palette.onAccent}>
            {title}
          </Txt>
        </View>
      </PressScale>
    </View>
  );
}

export function Hairline() {
  return <View style={styles.hairline} />;
}

export const studio = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Space.s },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Space.s },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Space.m },
  gap: { gap: Space.m },
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Palette.ink },
  scroll: { paddingHorizontal: Space.xl, gap: Space.l },
  back: { alignSelf: 'flex-start', paddingVertical: Space.xs },
  title: { marginTop: -Space.s },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: Space.xl,
    paddingTop: Space.l,
    flexDirection: 'row',
    gap: Space.m,
    backgroundColor: Palette.ink,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Palette.hairline,
  },
  card: {
    backgroundColor: Palette.card,
    borderRadius: Radius.m,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.hairline,
    padding: Space.l,
    gap: Space.m,
  },
  section: { gap: Space.m, marginTop: Space.s },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chip: {
    paddingHorizontal: Space.m,
    paddingVertical: Space.s,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Palette.hairline,
    backgroundColor: Palette.card,
  },
  chipSoft: { backgroundColor: Palette.accentSoft, borderColor: Palette.accentSoft },
  chipOn: { backgroundColor: Palette.ember, borderColor: Palette.ember },
  rolePill: { alignSelf: 'flex-start', backgroundColor: Palette.accentSoft, borderRadius: Radius.pill, paddingHorizontal: Space.m, paddingVertical: Space.xs },
  stat: { flexBasis: '45%', flexGrow: 1, gap: 2 },
  statValue: { fontFamily: FontFamily.displayBold, fontSize: 28, lineHeight: 34, color: Palette.paper, fontVariant: ['tabular-nums'] },
  flex: { flex: 1 },
  button: { height: 52, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Space.l },
  buttonPrimary: { backgroundColor: Palette.ember },
  buttonSecondary: { backgroundColor: Palette.card, borderWidth: 1, borderColor: Palette.hairline },
  buttonDisabled: { backgroundColor: Palette.inkDeep },
  hairline: { height: StyleSheet.hairlineWidth, backgroundColor: Palette.hairline },
});
