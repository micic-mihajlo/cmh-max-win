import { StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/signal/primitives';
import { Txt } from '@/components/signal/txt';
import { Palette, Space } from '@/constants/signal';
import { me } from '@/mocks/showcase/social';
import { Enter } from '@/motion';

import { nameList } from './copy';
import { Screen, Section, showcase } from './kit';

export function ProfileScreen() {
  return (
    <Screen>
      <Enter style={[showcase.gutter, styles.head]}>
        <Avatar name={me.name} size={48} filled />
        <Txt variant="display" style={styles.name}>
          {me.name}
        </Txt>
        <Txt variant="caption" color={Palette.paperMuted}>
          @{me.handle} · {me.joined} · Sample data
        </Txt>
        <Txt variant="body" style={styles.summary}>
          {me.solved} cases solved with {me.squadCount} squads. {`Best\u00A0finish\u00A0${me.bestFinish}.`}
        </Txt>
      </Enter>

      <Section title="Recent squads">
        <View style={showcase.list}>
          {me.squads.map((q, i) => (
            <Enter key={q.id} index={i + 1} style={showcase.row}>
              <Txt variant="bodyStrong" style={styles.place}>
                {q.placement}
              </Txt>
              <View style={showcase.flex}>
                <Txt variant="bodyStrong" numberOfLines={1}>
                  {nameList(q.members)}
                </Txt>
                <Txt variant="caption" color={Palette.paperMuted} numberOfLines={1}>
                  {q.squad} · {q.drop}
                </Txt>
              </View>
              <View style={styles.right}>
                {q.earned ? (
                  <Txt variant="smallStrong" style={styles.tabular}>
                    {q.earned}
                  </Txt>
                ) : null}
                <Txt variant="small" color={Palette.paperMuted}>
                  {q.when}
                </Txt>
              </View>
            </Enter>
          ))}
        </View>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { gap: Space.xs, marginTop: Space.s },
  name: { marginTop: Space.m },
  summary: { marginTop: Space.l },
  tabular: { fontVariant: ['tabular-nums'] },
  place: { width: 36, fontVariant: ['tabular-nums'] },
  right: { alignItems: 'flex-end' },
});
