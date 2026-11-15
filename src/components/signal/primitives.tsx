import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Palette, Radius, RoleMeta, Space } from '@/constants/signal';
import type { Presence, Role } from '@/lib/contract';

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
}: {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  disabled?: boolean;
  icon?: ReactNode;
  style?: ViewStyle;
}) {
  const fg = variant === 'primary' || variant === 'danger' ? Palette.ink : Palette.paper;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [
        styles.button,
        variant === 'primary' && styles.primary,
        variant === 'secondary' && styles.secondary,
        variant === 'danger' && styles.danger,
        disabled && styles.disabled,
        pressed && !disabled && { opacity: 0.85, transform: [{ scale: 0.985 }] },
        style,
      ]}>
      {icon}
      <Txt variant="button" color={disabled ? Palette.paperMuted : fg}>
        {title}
      </Txt>
    </Pressable>
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

export function PresenceLine({ people }: { people: { name: string; role: Role | null; presence: Presence }[] }) {
  return (
    <View style={styles.presence}>
      {people.map((p) => (
        <View key={p.name} style={styles.presenceItem}>
          <View
            style={[
              styles.presenceDot,
              { backgroundColor: p.presence === 'offline' ? 'transparent' : p.role ? RoleMeta[p.role].color : Palette.paperMuted },
              p.presence === 'offline' && { borderWidth: 1.5, borderColor: Palette.paperFaint },
            ]}
          />
          <Txt variant="small" color={p.presence === 'offline' ? Palette.paperFaint : Palette.paperMuted}>
            <Txt variant="smallStrong" color={Palette.paper}>
              {p.name}
            </Txt>{' '}
            {presenceCopy[p.presence]}
          </Txt>
        </View>
      ))}
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
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={10} style={styles.iconButton}>
      <Icon name={name} size={17} color={Palette.paperMuted} />
    </Pressable>
  );
}

export function Toast({ text, tone = 'info' }: { text: string; tone?: 'info' | 'warn' | 'good' }) {
  const insets = useSafeAreaInsets();
  const reduced = useMotionReduced();
  const accent = tone === 'warn' ? Palette.paper : tone === 'good' ? Palette.ok : Palette.paperMuted;
  return (
    <Animated.View
      entering={reduced ? FadeIn : FadeInUp.springify().damping(18)}
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
        <Pressable
          key={o.value}
          accessibilityRole="tab"
          accessibilityState={{ selected: o.value === value }}
          onPress={() => onChange?.(o.value)}
          style={[styles.segment, o.value === value && styles.segmentOn]}>
          <Txt variant="smallStrong" color={o.value === value ? Palette.paper : Palette.paperMuted}>
            {o.label}
          </Txt>
        </Pressable>
      ))}
    </View>
  );
}

export function Divider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  button: {
    minHeight: 54,
    borderRadius: Radius.pill,
    paddingHorizontal: Space.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space.s,
  },
  primary: { backgroundColor: Palette.ember },
  secondary: { borderWidth: 1, borderColor: Palette.hairline, backgroundColor: Palette.panel },
  danger: { backgroundColor: Palette.danger },
  disabled: { backgroundColor: Palette.panel, borderWidth: 1, borderColor: Palette.hairline },
  roleTag: { flexDirection: 'row', alignItems: 'center', gap: Space.s },
  presence: { gap: 6 },
  presenceItem: { flexDirection: 'row', alignItems: 'center', gap: Space.s },
  presenceDot: { width: 7, height: 7, borderRadius: 7 },
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
  segment: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: Radius.pill },
  segmentOn: { backgroundColor: Palette.panelRaised },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: Palette.hairline },
});
