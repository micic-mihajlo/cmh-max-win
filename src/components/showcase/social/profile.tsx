import { StyleSheet, View } from 'react-native';

import { Txt } from '@/components/signal/txt';
import { FontFamily, Palette, Radius, Space } from '@/constants/signal';
import { me } from '@/mocks/showcase/social';
import { Enter } from '@/motion';

import { Avatar, Screen, Section, Wash, showcase } from './kit';

export function ProfileScreen() {
  return (
    <Screen title="Profile">
      <Enter style={[showcase.gutter, styles.head]}>
        <Avatar initials={me.initials} size={84} />
        <Txt variant="display">@{me.handle}</Txt>
        <Txt variant="small" color={Palette.paperMuted}>
          {me.name} · {me.joined}
        </Txt>
      </Enter>

      <Enter index={1} style={[showcase.gutter, styles.grid]}>
        {me.stats.map((s) => (
          <View key={s.label} style={styles.cell}>
            <Txt style={styles.stat}>
              {s.value}
            </Txt>
            <Txt variant="small" color={Palette.paperMuted}>
              {s.label}
            </Txt>
          </View>
        ))}
      </Enter>

      <Section title="Season packs">
        <View style={styles.packs}>
          {me.packs.map((p) => (
            <View key={p.id} style={[styles.pack, { backgroundColor: Wash.pick(p.creator) }]}>
              <Txt variant="bodyStrong" numberOfLines={2}>
                {p.title}
              </Txt>
              <Txt variant="small" color={Palette.paperMuted}>
                {p.creator} · {p.owned} of {p.episodes}
              </Txt>
            </View>
          ))}
        </View>
      </Section>

      <Section title="Recent squads">
        <View style={showcase.list}>
          {me.squads.map((q) => (
            <View key={q.id} style={showcase.row}>
              <Txt variant="bodyStrong" style={styles.place}>
                {q.placement}
              </Txt>
              <View style={showcase.flex}>
                <Txt variant="bodyStrong">{q.squad}</Txt>
                <Txt variant="small" color={Palette.paperMuted} numberOfLines={1}>
                  {q.members.join(', ')} · {q.drop}
                </Txt>
              </View>
              <View style={styles.right}>
                <Txt variant="smallStrong" style={styles.tabular}>
                  {q.earned ?? ''}
                </Txt>
                <Txt variant="small" color={Palette.paperMuted}>
                  {q.when}
                </Txt>
              </View>
            </View>
          ))}
        </View>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { alignItems: 'center', gap: Space.s, marginTop: Space.s },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: Space.xl, marginTop: Space.xxl },
  cell: { width: '50%' },
  tabular: { fontVariant: ['tabular-nums'] },
  stat: { fontFamily: FontFamily.uiSemi, fontSize: 28, lineHeight: 34, fontVariant: ['tabular-nums'] },
  packs: { flexDirection: 'row', gap: Space.m },
  pack: { flex: 1, borderRadius: Radius.m, padding: Space.l, minHeight: 128, justifyContent: 'flex-end', gap: Space.xs },
  place: { width: 36, fontVariant: ['tabular-nums'] },
  right: { alignItems: 'flex-end' },
});
