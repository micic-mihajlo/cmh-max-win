import { StyleSheet, View } from 'react-native';

import { Txt } from '@/components/signal/txt';
import { Palette, Radius, Space } from '@/constants/signal';
import { me } from '@/mocks/showcase/social';
import { Enter } from '@/motion';

import { Avatar, Card, Hairline, Screen, Section, showcase } from './kit';

export function ProfileScreen() {
  return (
    <Screen title="Profile">
      <Enter style={[showcase.gutter, styles.head]}>
        <Avatar initials={me.initials} size={84} />
        <Txt variant="display">@{me.handle}</Txt>
        <Txt variant="body" color={Palette.paperMuted}>
          {me.name} · {me.joined}
        </Txt>
      </Enter>

      <View style={[showcase.gutter, styles.grid]}>
        {me.stats.map((s, i) => (
          <Enter key={s.label} index={i + 1} style={styles.cell}>
            <Card style={styles.stat}>
              <Txt variant="title" style={styles.tabular}>
                {s.value}
              </Txt>
              <Txt variant="small" color={Palette.paperMuted}>
                {s.label}
              </Txt>
            </Card>
          </Enter>
        ))}
      </View>

      <Section title="Season packs">
        <View style={styles.packs}>
          {me.packs.map((p) => (
            <View key={p.id} style={styles.pack}>
              <View style={styles.cover}>
                <Txt variant="label" color={Palette.paperMuted}>
                  {p.season}
                </Txt>
                <Txt variant="name" numberOfLines={2}>
                  {p.title}
                </Txt>
              </View>
              <View style={styles.packFoot}>
                <Txt variant="smallStrong">{p.creator}</Txt>
                <Txt variant="small" color={Palette.paperMuted}>
                  {p.owned} of {p.episodes}
                </Txt>
              </View>
            </View>
          ))}
        </View>
      </Section>

      <Section title="Recent squads">
        <Card style={styles.list}>
          {me.squads.map((q, i) => (
            <View key={q.id}>
              {i > 0 ? <Hairline style={styles.gap} /> : null}
              <View style={showcase.row}>
                <View style={[styles.place, q.earned ? styles.placeWon : null]}>
                  <Txt variant="smallStrong">{q.placement}</Txt>
                </View>
                <View style={showcase.flex}>
                  <Txt variant="bodyStrong">{q.squad}</Txt>
                  <Txt variant="small" color={Palette.paperMuted} numberOfLines={1}>
                    {q.members.join(', ')} · {q.drop}
                  </Txt>
                </View>
                <View style={styles.right}>
                  <Txt variant="smallStrong" style={styles.tabular}>
                    {q.earned ?? '—'}
                  </Txt>
                  <Txt variant="small" color={Palette.paperMuted}>
                    {q.when}
                  </Txt>
                </View>
              </View>
            </View>
          ))}
        </Card>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { alignItems: 'center', gap: Space.s, marginTop: Space.s },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Space.m, marginTop: Space.xxl },
  cell: { width: '47%', flexGrow: 1 },
  stat: { gap: 2 },
  tabular: { fontVariant: ['tabular-nums'] },
  packs: { flexDirection: 'row', gap: Space.m },
  pack: { flex: 1, backgroundColor: Palette.card, borderRadius: Radius.m, borderWidth: 1, borderColor: Palette.hairline, overflow: 'hidden' },
  cover: { backgroundColor: Palette.accentSoft, padding: Space.l, minHeight: 112, justifyContent: 'flex-end', gap: 2 },
  packFoot: { padding: Space.m, paddingHorizontal: Space.l },
  list: { paddingVertical: Space.l },
  gap: { marginVertical: Space.m },
  place: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Palette.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeWon: { backgroundColor: Palette.accentSoft, borderColor: Palette.accentSoft },
  right: { alignItems: 'flex-end' },
});
