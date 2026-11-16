import { StyleSheet, View } from 'react-native';

import { Palette, Radius, Space } from '@/constants/signal';
import type { Suspect } from '@/constants/case01';
import { PressScale } from '@/motion';

import { Txt } from './txt';

export function SuspectCard({ suspect }: { suspect: Suspect }) {
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Txt variant="name">{suspect.name}</Txt>
        <Txt variant="label" color={Palette.paperMuted}>
          {suspect.job} · {suspect.pronouns}
        </Txt>
      </View>
      <Txt variant="quote" color={Palette.paper}>
        “{suspect.claim}”
      </Txt>
      <Txt variant="small" color={Palette.paperMuted}>
        <Txt variant="smallStrong" color={Palette.paper} style={{ fontVariant: ['tabular-nums'] }}>
          {suspect.walk}
        </Txt>{' '}
        walk to the greenhouse
      </Txt>
    </View>
  );
}

export function SuspectList({ suspects }: { suspects: Suspect[] }) {
  return (
    <View style={styles.list}>
      {suspects.map((s, i) => (
        <View key={s.id} style={[styles.listRow, i > 0 && styles.listRule]}>
          <Txt variant="name">{s.name}</Txt>
          <Txt variant="small" color={Palette.paperMuted}>
            {s.job}
          </Txt>
        </View>
      ))}
    </View>
  );
}

export function SuspectOption({
  suspect,
  selected,
  ruledOutBy,
  onPress,
}: {
  suspect: Suspect;
  selected: boolean;
  ruledOutBy?: string;
  onPress?: () => void;
}) {
  return (
    <PressScale accessibilityRole="radio" accessibilityState={{ selected }} haptic="tap" onPress={onPress} style={styles.option}>
      <View style={styles.optionBody}>
        <Txt variant="bodyStrong" color={selected ? Palette.paper : Palette.paperMuted}>
          {suspect.name}
        </Txt>
        <Txt variant="small" color={Palette.paperMuted}>
          {suspect.job}
        </Txt>
      </View>
      {selected ? <Txt variant="bodyStrong">✓</Txt> : null}
      {ruledOutBy ? (
        <View style={styles.struck}>
          <Txt variant="label" color={Palette.danger}>
            Ruled out by {ruledOutBy}
          </Txt>
        </View>
      ) : null}
    </PressScale>
  );
}

const styles = StyleSheet.create({
  list: { backgroundColor: Palette.card, borderRadius: Radius.l, borderWidth: 1, borderColor: Palette.hairline, paddingHorizontal: Space.l },
  listRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Space.s },
  listRule: { borderTopWidth: 1, borderTopColor: Palette.hairline },
  card: {
    backgroundColor: Palette.panel,
    borderRadius: Radius.m,
    borderWidth: 1,
    borderColor: Palette.hairline,
    padding: Space.l,
    gap: Space.s,
  },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: Space.s, flexWrap: 'wrap' },
  option: { flexDirection: 'row', alignItems: 'center', gap: Space.m, minHeight: 56 },
  optionBody: { flex: 1 },
  struck: { borderWidth: 1, borderColor: Palette.danger, borderRadius: Radius.s, paddingHorizontal: 6, paddingVertical: 3, transform: [{ rotate: '-3deg' }], maxWidth: 120 },
});
