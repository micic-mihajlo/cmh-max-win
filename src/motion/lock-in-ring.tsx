import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInUp, FadeOut, FadeOutUp } from 'react-native-reanimated';

import { useMotionColors } from './palette';
import { useReduced } from './reduced';
import { Seal } from './seal';
import { Duration, Ease } from './tokens';

export type RingSeat = {
  key: string;
  name: string;
  color: string;
  initial: string;
  locked: boolean;
  away?: boolean;
  isMe?: boolean;
};

type Props = {
  seats: RingSeat[];
  play?: boolean;
  size?: number;
  caption?: string;
  onSealDone?: (key: string, locked: boolean) => void;
};

// Three seals on one ring around the agreement count. The count ticks upward as a seal lands.
export function LockInRing({ seats, play = true, size = 232, caption = 'agree', onSealDone }: Props) {
  const reduced = useReduced();
  const colors = useMotionColors();
  const seal = Math.round(size * 0.26);
  const radius = (size - seal) / 2 - 6;
  const count = seats.filter((s) => s.locked).length;
  const digitIn = reduced ? FadeIn.duration(Duration.fade) : FadeInUp.duration(220).easing(Ease.out);
  const digitOut = reduced ? FadeOut.duration(Duration.fade) : FadeOutUp.duration(160).easing(Ease.out);

  return (
    <View
      style={{ width: size, height: size + LABEL, marginTop: LABEL }}
      accessible
      accessibilityLabel={`${count} of ${seats.length} agree`}>
      <View
        style={[
          styles.track,
          { borderColor: colors.hairline },
          { width: radius * 2, height: radius * 2, borderRadius: radius, left: size / 2 - radius, top: size / 2 - radius },
        ]}
      />
      <View style={[styles.center, { width: size, height: size }]}>
        <View style={styles.countRow}>
          <View style={styles.digitBox}>
            <Animated.Text key={count} entering={play ? digitIn : undefined} exiting={play ? digitOut : undefined} style={[styles.count, { color: colors.ink }]}>
              {count}
            </Animated.Text>
          </View>
          <Text style={[styles.of, { color: colors.muted }]}>/{seats.length}</Text>
        </View>
        <Text style={[styles.caption, { color: colors.muted }]}>{caption}</Text>
      </View>
      {seats.map((s, i) => {
        const angle = -Math.PI / 2 + (i * 2 * Math.PI) / seats.length;
        const cx = size / 2 + radius * Math.cos(angle);
        const cy = size / 2 + radius * Math.sin(angle);
        const above = cy < size / 2 - 1;
        return (
          <View
            key={s.key}
            style={[styles.seat, above && styles.seatAbove, { left: cx - 45, top: cy - seal / 2 - (above ? LABEL + 4 : 0) }]}>
            <Seal
              locked={s.locked}
              color={s.color}
              initial={s.initial}
              size={seal}
              play={play}
              dimmed={s.away}
              haptic={s.isMe}
              onDone={onSealDone ? (locked) => onSealDone(s.key, locked) : undefined}
              accessibilityLabel={`${s.name}${s.locked ? ' agrees' : ''}${s.away ? ', away' : ''}`}
            />
            <Text numberOfLines={1} style={[styles.name, { color: s.isMe ? colors.ink : colors.muted }, s.isMe && styles.me]}>
              {s.away ? `${s.name} · away` : s.isMe ? 'You' : s.name}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const LABEL = 20;

const styles = StyleSheet.create({
  track: { position: 'absolute', borderWidth: 1 },
  center: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  countRow: { flexDirection: 'row', alignItems: 'flex-end' },
  digitBox: { height: 44, overflow: 'hidden', justifyContent: 'flex-end' },
  count: { fontSize: 40, lineHeight: 44, fontWeight: '600', fontVariant: ['tabular-nums'] },
  of: { fontSize: 20, lineHeight: 34, fontVariant: ['tabular-nums'] },
  caption: { fontSize: 15 },
  seat: { position: 'absolute', width: 90, alignItems: 'center', gap: 4 },
  seatAbove: { flexDirection: 'column-reverse' },
  name: { fontSize: 15, lineHeight: LABEL, maxWidth: 90 },
  me: { fontWeight: '600' },
});
