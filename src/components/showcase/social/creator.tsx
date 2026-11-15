import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Txt } from '@/components/signal/txt';
import { Palette, Space } from '@/constants/signal';
import { nova } from '@/mocks/showcase/social';
import { Enter } from '@/motion';

import { Countdown } from './countdown';
import { Avatar, BigButton, Card, Screen, Section, TextAction, showcase } from './kit';

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
        <Txt variant="small" color={Palette.paperMuted}>
          <Txt variant="smallStrong">{nova.followers}</Txt> followers · <Txt variant="smallStrong">9</Txt> drops
        </Txt>
      </Enter>
      <Enter index={1} style={[showcase.gutter, styles.follow]}>
        <BigButton title={following ? 'Following' : 'Follow'} onPress={() => setFollowing((f) => !f)} />
      </Enter>

      <Section title="Next drop">
        <Enter index={2}>
          <Card style={styles.next}>
            <Txt variant="title">{nova.next.title}</Txt>
            <Countdown seconds={nova.next.startsInSeconds} />
            <View style={[showcase.row, styles.nextFoot]}>
              <Txt variant="small" color={Palette.paperMuted} style={showcase.flex}>
                {nova.next.stakes}
              </Txt>
              <TextAction title={reminded ? 'Reminder set' : 'Remind me'} muted={reminded} onPress={() => setReminded((r) => !r)} />
            </View>
          </Card>
        </Enter>
      </Section>

      <Section title={nova.season.title}>
        <View style={styles.season}>
          {nova.season.episodes.map((ep, i) => {
            const out = i < nova.season.released;
            return (
              <View key={ep} style={showcase.row}>
                <Txt variant="time" color={Palette.paperMuted} style={styles.num}>
                  {i + 1}
                </Txt>
                <Txt variant="body" color={out ? Palette.paper : Palette.paperMuted} style={showcase.flex}>
                  {ep}
                </Txt>
                {out ? null : (
                  <Txt variant="small" color={Palette.paperMuted}>
                    Soon
                  </Txt>
                )}
              </View>
            );
          })}
        </View>
      </Section>

      <Section title="Past drops">
        <View style={showcase.list}>
          {nova.past.map((d) => (
            <View key={d.id} style={showcase.row}>
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
          ))}
        </View>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { alignItems: 'center', gap: Space.s, marginTop: Space.s },
  bio: { textAlign: 'center', maxWidth: 320 },
  follow: { marginTop: Space.xl },
  next: { gap: Space.xs },
  nextFoot: { marginTop: Space.m },
  season: { gap: Space.m },
  num: { width: 20 },
  right: { alignItems: 'flex-end' },
});
