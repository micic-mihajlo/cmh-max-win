import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, { FadeIn, FadeInUp, FadeOut, ReduceMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FontFamily, Palette, Radius, RoleMeta, Space } from '@/constants/signal';
import type { Presence, Role } from '@/lib/contract';
import { PressScale, Spring } from '@/motion';

import { Icon } from './icon';
import { useMotionReduced } from './settings';
import { Txt } from './txt';

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  icon,
  style,
  haptic = true,
}: {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'accent' | 'secondary' | 'ghost' | 'danger';
  disabled?: boolean;
  icon?: ReactNode;
  style?: ViewStyle;
  haptic?: boolean;
}) {
  const fg = variant === 'primary' ? Palette.ink : variant === 'danger' || variant === 'accent' ? Palette.onAccent : Palette.paper;
  return (
    <PressScale
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      haptic={haptic && onPress ? 'tap' : undefined}
      onPress={onPress}
      style={[
        styles.button,
        variant === 'primary' && styles.primary,
        variant === 'secondary' && styles.secondary,
        variant === 'danger' && styles.danger,
        variant === 'accent' && styles.accent,
        disabled && styles.disabled,
        style,
      ]}>
      {icon}
      <Txt variant="button" color={disabled ? Palette.disabledText : fg}>
        {title}
      </Txt>
    </PressScale>
  );
}

export function Label({ children, color = Palette.paperMuted, style }: { children: ReactNode; color?: string; style?: ViewStyle }) {
  return (
    <View style={style}>
      <Txt variant="label" color={color}>
        {children}
      </Txt>
    </View>
  );
}

export function RoleDot({ role, size = 8 }: { role: Role; size?: number }) {
  return <View style={{ width: size, height: size, borderRadius: size, backgroundColor: RoleMeta[role].color }} />;
}

export function RoleTag({ role, suffix }: { role: Role; suffix?: string }) {
  return (
    <View style={styles.roleTag}>
      <RoleDot role={role} />
      <Txt variant="label" color={RoleMeta[role].color}>
        {RoleMeta[role].label}
        {suffix ? ` · ${suffix}` : ''}
      </Txt>
    </View>
  );
}

const presenceCopy: Record<Presence, string> = {
  online: 'is on the theory',
  reviewing: 'is reading evidence',
  ready: 'has locked in',
  offline: 'stepped away',
};

export function PresenceLine({ person }: { person: { name: string; presence: Presence } | null }) {
  return (
    <View style={styles.presence}>
      {person ? (
        <Animated.View
          key={`${person.name}-${person.presence}`}
          entering={FadeIn.duration(180).reduceMotion(ReduceMotion.Never)}
          exiting={FadeOut.duration(180).reduceMotion(ReduceMotion.Never)}
          style={styles.presenceItem}>
          <Txt variant="caption" color={Palette.paperMuted} numberOfLines={1}>
            {`${person.name} ${presenceCopy[person.presence]}`}
          </Txt>
        </Animated.View>
      ) : null}
    </View>
  );
}

export function Banner({
  tone = 'info',
  title,
  text,
  busy,
  action,
}: {
  tone?: 'info' | 'warn' | 'good';
  title: string;
  text?: string;
  busy?: boolean;
  action?: ReactNode;
}) {
  const accent = tone === 'warn' ? Palette.paper : tone === 'good' ? Palette.ok : Palette.paperMuted;
  return (
    <View accessibilityRole="alert" style={[styles.banner, { borderColor: accent }]}>
      {busy ? (
        <ActivityIndicator color={accent} />
      ) : (
        <Icon name={tone === 'good' ? 'checkmark.circle.fill' : tone === 'warn' ? 'exclamationmark.circle' : 'info.circle'} color={accent} />
      )}
      <View style={styles.bannerBody}>
        <Txt variant="smallStrong">{title}</Txt>
        {text ? (
          <Txt variant="small" color={Palette.paperMuted}>
            {text}
          </Txt>
        ) : null}
      </View>
      {action}
    </View>
  );
}

export function NextStep({ children }: { children: ReactNode }) {
  return (
    <View style={styles.next}>
      <Txt variant="label" color={Palette.paperMuted}>
        Next
      </Txt>
      <Txt variant="smallStrong" style={styles.flex}>
        {children}
      </Txt>
    </View>
  );
}

export function TopBar({ left, right }: { left?: ReactNode; right?: ReactNode }) {
  return (
    <View style={styles.topBar}>
      <View style={styles.flex}>{left}</View>
      {right}
    </View>
  );
}

export function IconButton({ name, label, onPress }: { name: Parameters<typeof Icon>[0]['name']; label: string; onPress?: () => void }) {
  return (
    <PressScale accessibilityLabel={label} onPress={onPress} hitSlop={10} scaleTo={0.92} style={styles.iconButton}>
      <Icon name={name} size={17} color={Palette.paperMuted} />
    </PressScale>
  );
}

export function Toast({ text, tone = 'info' }: { text: string; tone?: 'info' | 'warn' | 'good' }) {
  const insets = useSafeAreaInsets();
  const reduced = useMotionReduced();
  const accent = tone === 'warn' ? Palette.paper : tone === 'good' ? Palette.ok : Palette.paperMuted;
  return (
    <Animated.View
      entering={
        reduced
          ? FadeIn.duration(150).reduceMotion(ReduceMotion.Never)
          : FadeInUp.springify().damping(Spring.press.damping).stiffness(Spring.press.stiffness).mass(Spring.press.mass)
      }
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[styles.toast, { top: insets.top + Space.s }]}>
      <View style={[styles.toastDot, { backgroundColor: accent }]} />
      <Txt variant="smallStrong" style={styles.flexShrink}>
        {text}
      </Txt>
    </Animated.View>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange?: (value: T) => void;
}) {
  return (
    <View style={styles.segmented} accessibilityRole="tablist">
      {options.map((o) => (
        <PressScale
          key={o.value}
          accessibilityRole="tab"
          accessibilityState={{ selected: o.value === value }}
          haptic={o.value === value ? undefined : 'select'}
          hitSlop={0}
          outerStyle={styles.flex}
          onPress={() => onChange?.(o.value)}
          style={[styles.segment, o.value === value && styles.segmentOn]}>
          <Txt variant="smallStrong" color={o.value === value ? Palette.paper : Palette.paperMuted}>
            {o.label}
          </Txt>
        </PressScale>
      ))}
    </View>
  );
}

export function Avatar({ name, size = 40, filled }: { name: string; size?: number; filled?: boolean }) {
  return (
    <View
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 2 },
        filled ? { backgroundColor: Palette.paper, borderColor: Palette.paper } : null,
      ]}>
      <Txt style={{ fontFamily: FontFamily.uiSemi, fontSize: size * 0.4, lineHeight: size * 0.5 }} color={filled ? Palette.card : Palette.paper}>
        {name.charAt(0).toUpperCase()}
      </Txt>
    </View>
  );
}

export function Divider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  avatar: { alignItems: 'center', justifyContent: 'center', backgroundColor: Palette.card, borderWidth: 1, borderColor: Palette.hairline },
  flex: { flex: 1 },
  button: {
    minHeight: 52,
    borderRadius: Radius.m,
    paddingHorizontal: Space.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space.s,
  },
  primary: { backgroundColor: Palette.paper },
  secondary: { backgroundColor: 'transparent' },
  danger: { backgroundColor: Palette.danger },
  accent: { backgroundColor: Palette.ember },
  disabled: { backgroundColor: Palette.paperShade, borderWidth: 0 },
  roleTag: { flexDirection: 'row', alignItems: 'center', gap: Space.s },
  presence: { height: 17 },
  presenceItem: { position: 'absolute', top: 0, left: 0, right: 0 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.m,
    padding: Space.m,
    paddingHorizontal: Space.l,
    borderRadius: Radius.m,
    borderWidth: 1,
    backgroundColor: Palette.panel,
  },
  bannerBody: { flex: 1, gap: 2 },
  next: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.m,
    paddingVertical: Space.s,
  },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Space.xl, paddingTop: Space.s, gap: Space.l, minHeight: 36 },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Palette.panel,
    borderWidth: 1,
    borderColor: Palette.hairline,
  },
  flexShrink: { flexShrink: 1 },
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    maxWidth: '88%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.s,
    paddingVertical: 10,
    paddingHorizontal: Space.l,
    borderRadius: Radius.pill,
    backgroundColor: Palette.panelRaised,
    borderWidth: 1,
    borderColor: Palette.hairline,
    boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
  },
  toastDot: { width: 8, height: 8, borderRadius: 4 },
  segmented: { flexDirection: 'row', backgroundColor: Palette.panel, borderRadius: Radius.pill, padding: 4, borderWidth: 1, borderColor: Palette.hairline },
  segment: { alignItems: 'center', paddingVertical: 8, borderRadius: Radius.pill },
  segmentOn: { backgroundColor: Palette.panelRaised },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: Palette.hairline },
});
