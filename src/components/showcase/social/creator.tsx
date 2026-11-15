import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Txt } from '@/components/signal/txt';
import { Palette, Space } from '@/constants/signal';
import { nova } from '@/mocks/showcase/social';
import { Enter } from '@/motion';

import { Countdown } from './countdown';
import { Avatar, Card, Hairline, Pill, Screen, Section, showcase } from './kit';

export function CreatorScreen() {
  const [following, setFollowing] = useState(false);
  const [reminded, setReminded] = useState(false);
  return (
    <Screen title={`@${nova.handle}`}>
      <Enter style={[showcase.gutter, styles.head]}>
        <Avatar initials={nova.initials} size={84} live={nova.live} />
        <Txt variant="display">{nova.name}</Txt>
        <Txt variant="body" color={Palette.paperMuted} style={styles.bio}>
          {nova.bio}
        </Txt>
        <View style={styles.counts}>
          <Txt variant="small" color={Palette.paperMuted}>
            <Txt variant="smallStrong">{nova.followers}</Txt> followers
          </Txt>
          <Txt variant="small" color={Palette.paperMuted}>
            <Txt variant="smallStrong">{nova.drops.split(' ')[0]}</Txt> drops
          </Txt>
          <Txt variant="small" color={Palette.paperMuted}>
            <Txt variant="smallStrong">{nova.players.split(' ')[0]}</Txt> players
          </Txt>
        </View>
        <Pill
          title={following ? 'Following' : 'Follow'}
          tone={following ? 'line' : 'ink'}
          onPress={() => setFollowing((f) => !f)}
          style={styles.follow}
        />
      </Enter>

      <Section title="Next drop">
        <Enter index={1}>
          <Card style={styles.next}>
            <Txt variant="label" color={Palette.paperMuted}>
              {nova.next.when}
            </Txt>
            <Txt variant="title">{nova.next.title}</Txt>
            <Countdown seconds={nova.next.startsInSeconds} />
            <View style={[showcase.row, styles.nextFoot]}>
              <Txt variant="smallStrong" style={showcase.flex}>
                {nova.next.stakes}
              </Txt>
              <Pill title={reminded ? 'Reminder set' : 'Remind me'} tone={reminded ? 'line' : 'ember'} onPress={() => setReminded((r) => !r)} />
            </View>
          </Card>
        </Enter>
      </Section>

      <Section title={nova.season.title}>
        <Card style={styles.season}>
          {nova.season.episodes.map((ep, i) => {
            const out = i < nova.season.released;
            return (
              <View key={ep} style={showcase.row}>
                <View style={[styles.ep, out && styles.epOut]}>
                  <Txt variant="smallStrong" color={Palette.paper}>
                    {i + 1}
                  </Txt>
                </View>
                <Txt variant={out ? 'bodyStrong' : 'body'} color={out ? Palette.paper : Palette.paperMuted} style={showcase.flex}>
                  {ep}
                </Txt>
                <Txt variant="small" color={Palette.paperMuted}>
                  {out ? 'Out' : 'Soon'}
                </Txt>
              </View>
            );
          })}
        </Card>
      </Section>

      <Section title="Past drops">
        <Card style={styles.past}>
          {nova.past.map((d, i) => (
            <View key={d.id}>
              {i > 0 ? <Hairline style={styles.gap} /> : null}
              <View style={showcase.row}>
                <View style={showcase.flex}>
                  <Txt variant="bodyStrong">{d.title}</Txt>
                  <Txt variant="small" color={Palette.paperMuted}>
                    {d.winners}
                  </Txt>
                </View>
                <View style={styles.right}>
                  <Txt variant="time">{d.solve}</Txt>
                  <Txt variant="small" color={Palette.paperMuted}>
                    {d.date}
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
  bio: { textAlign: 'center', maxWidth: 320 },
  counts: { flexDirection: 'row', gap: Space.l, marginTop: Space.xs },
  follow: { minWidth: 140, marginTop: Space.m },
  next: { gap: Space.xs, padding: Space.xl },
  nextFoot: { marginTop: Space.m },
  season: { gap: Space.m },
  ep: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Palette.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  epOut: { backgroundColor: Palette.accentSoft, borderColor: Palette.accentSoft },
  past: { paddingVertical: Space.s },
  gap: { marginVertical: Space.m },
  right: { alignItems: 'flex-end' },
});
