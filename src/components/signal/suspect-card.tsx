import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Palette, Radius, Space } from '@/constants/signal';
import type { Suspect } from '@/constants/case01';

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
  pending,
  pickedBy,
  first,
  onPress,
}: {
  suspect: Suspect;
  selected: boolean;
  ruledOutBy?: string;
  pending?: boolean;
  pickedBy?: string;
  first?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.option, !first && styles.listRule]}>
      <View style={[styles.radio, selected && styles.radioOn]}>{selected ? <View style={styles.radioDot} /> : null}</View>
      <View style={styles.optionBody}>
        <Txt variant="name">{suspect.name}</Txt>
        <Txt variant="small" color={Palette.paperMuted}>
          {suspect.job}
        </Txt>
      </View>
      {pending ? <ActivityIndicator color={Palette.paper} /> : null}
      {pickedBy ? (
        <View style={styles.pick}>
          <Txt variant="smallStrong">{pickedBy}</Txt>
        </View>
      ) : null}
      {ruledOutBy ? (
        <View style={styles.struck}>
          <Txt variant="label" color={Palette.danger}>
            Ruled out by the {ruledOutBy}
          </Txt>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: { backgroundColor: Palette.card, borderRadius: Radius.l, borderWidth: 1, borderColor: Palette.hairline, paddingHorizontal: Space.l },
  listRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Space.s },
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
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.m,
    minHeight: 56,
    paddingHorizontal: Space.l,
    backgroundColor: Palette.card,
  },
  pick: { backgroundColor: Palette.accentSoft, borderRadius: 14, height: 28, paddingHorizontal: Space.m, justifyContent: 'center' },
  optionBody: { flex: 1 },
  struck: { borderWidth: 1, borderColor: Palette.danger, borderRadius: Radius.s, paddingHorizontal: 6, paddingVertical: 3, transform: [{ rotate: '-3deg' }], maxWidth: 120 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: Palette.paperFaint, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: Palette.paper, backgroundColor: Palette.paper },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Palette.card },
});
