import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FontFamily, Palette, RoleMeta, Space } from '@/constants/signal';
import { Txt } from '@/components/signal/txt';
import { Enter, PressScale } from '@/motion';

import type { BuilderRole } from './validate';

export const G = {
  bg: Palette.ink,
  surface: Palette.card,
  ink: Palette.paper,
  inkSoft: Palette.paperMuted,
  line: Palette.hairline,
  fill: Palette.paperShade,
  onInk: Palette.ink,
  ok: Palette.ok,
  okWash: Palette.paperShade,
  bad: Palette.danger,
  badWash: Palette.paperShade,
  role: { detective: Palette.paperShade, hacker: Palette.paperShade, witness: Palette.paperShade } as Record<BuilderRole, string>,
};

export const docName = (label: string) => label.charAt(0) + label.slice(1).toLowerCase();

export function StudioScreen({ title, kicker, children, footer, onBack }: { title: string; kicker?: string; children: ReactNode; footer?: ReactNode; onBack?: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + Space.m, paddingBottom: insets.bottom + (footer ? 120 : Space.xxxl) }]}>
        <Pressable accessibilityRole="button" hitSlop={12} onPress={onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/')))} style={styles.back}>
          <Txt variant="small" color={G.inkSoft}>
            ‹ Back
          </Txt>
        </Pressable>
        <Enter from={8}>
          <View style={styles.head}>
            {kicker ? <Caption>{kicker}</Caption> : null}
            <Txt style={styles.title}>{title}</Txt>
          </View>
        </Enter>
        {children}
      </ScrollView>
      {footer ? <View style={[styles.footer, { paddingBottom: insets.bottom + Space.l }]}>{footer}</View> : null}
    </View>
  );
}

export function Caption({ children, color = G.inkSoft }: { children: ReactNode; color?: string }) {
  return <Txt style={[styles.caption, { color }]}>{children}</Txt>;
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Section({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Txt style={styles.sectionTitle}>{title}</Txt>
        {action}
      </View>
      {children}
    </View>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress?: () => void }) {
  const body = (
    <View style={[styles.chip, selected && styles.chipOn]}>
      <Txt variant="small" color={selected ? G.onInk : G.ink}>
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

export function RoleCaption({ role, docLabel }: { role: BuilderRole; docLabel: string }) {
  return (
    <Caption>
      {docName(docLabel)} · {RoleMeta[role].label}
    </Caption>
  );
}

export function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Txt style={styles.statValue}>{value}</Txt>
      <Caption>{label}</Caption>
    </View>
  );
}

export function PrimaryButton({ title, onPress, variant = 'primary', disabled }: { title: string; onPress?: () => void; variant?: 'primary' | 'text'; disabled?: boolean }) {
  if (variant === 'text') {
    return (
      <PressScale accessibilityRole="button" onPress={onPress} haptic="tap" style={styles.textButton}>
        <Txt variant="button" color={G.ink}>
          {title}
        </Txt>
      </PressScale>
    );
  }
  return (
    <View style={styles.flex}>
      <PressScale accessibilityRole="button" disabled={disabled} onPress={onPress} haptic="tap">
        <View style={[styles.button, disabled && styles.buttonDisabled]}>
          <Txt variant="button" color={G.onInk} style={styles.buttonText}>
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
  root: { flex: 1, backgroundColor: G.bg },
  scroll: { paddingHorizontal: Space.xl, gap: Space.l },
  back: { alignSelf: 'flex-start', paddingVertical: Space.xs },
  head: { gap: Space.xs },
  title: { fontFamily: FontFamily.display, fontSize: 28, lineHeight: 32, letterSpacing: -0.4, color: G.ink },
  caption: { fontFamily: FontFamily.ui, fontSize: 13, lineHeight: 17, color: G.inkSoft },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: Space.xl,
    paddingTop: Space.m,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.l,
    backgroundColor: G.bg,
  },
  card: { backgroundColor: G.surface, borderRadius: 16, padding: Space.l, gap: Space.m },
  section: { gap: Space.m, marginTop: Space.m },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontFamily: FontFamily.uiSemi, fontSize: 17, lineHeight: 24, color: G.ink },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, backgroundColor: G.fill },
  chipOn: { backgroundColor: G.ink },
  stat: { flexBasis: '45%', flexGrow: 1, gap: 2 },
  statValue: { fontFamily: FontFamily.uiSemi, fontSize: 28, lineHeight: 34, color: G.ink, fontVariant: ['tabular-nums'] },
  flex: { flex: 1 },
  button: { height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Space.l, backgroundColor: G.ink },
  buttonText: { fontFamily: FontFamily.uiMedium },
  buttonDisabled: { opacity: 0.32 },
  textButton: { paddingHorizontal: Space.s, paddingVertical: Space.m },
  hairline: { height: StyleSheet.hairlineWidth, backgroundColor: G.line },
});

