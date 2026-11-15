import { router, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Txt } from '@/components/signal/txt';
import { Palette, Space } from '@/constants/signal';
import { notes, push } from '@/mocks/showcase/social';
import { Enter } from '@/motion';

import { Avatar, Card, Hairline, Pill, Screen, Section, showcase } from './kit';
import { PushBanner } from './push-banner';

const groups = ['Today', 'Earlier'] as const;

export function NotificationsScreen() {
  return (
    <Screen
      title="Notifications"
      right={
        <Txt variant="smallStrong" color={Palette.paperMuted} onPress={() => router.push('/showcase/notification-settings' as Href)}>
          Settings
        </Txt>
      }>
      <Enter style={[showcase.gutter, styles.push]}>
        <PushBanner {...push} />
      </Enter>
      {groups.map((g) => (
        <Section key={g} title={g}>
          <Card style={styles.list}>
            {notes
              .filter((n) => n.group === g)
              .map((n, i) => (
                <View key={n.id}>
                  {i > 0 ? <Hairline style={styles.gap} /> : null}
                  <View style={[showcase.row, styles.item]}>
                    <Avatar initials={n.initials} size={40} tone={n.kind === 'result' ? 'card' : 'soft'} />
                    <View style={showcase.flex}>
                      <Txt variant="bodyStrong">{n.title}</Txt>
                      <Txt variant="small" color={Palette.paperMuted}>
                        {n.body}
                      </Txt>
                      {n.action ? <Pill title={n.action} tone={n.kind === 'invite' ? 'ember' : 'line'} style={styles.action} /> : null}
                    </View>
                    <View style={styles.meta}>
                      <Txt variant="small" color={Palette.paperMuted}>
                        {n.when}
                      </Txt>
                      {n.unread ? <View style={styles.unread} /> : null}
                    </View>
                  </View>
                </View>
              ))}
          </Card>
        </Section>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  push: { marginTop: Space.s },
  list: { paddingVertical: Space.l },
  gap: { marginVertical: Space.m },
  item: { alignItems: 'flex-start' },
  action: { alignSelf: 'flex-start', marginTop: Space.s },
  meta: { alignItems: 'flex-end', gap: Space.s },
  unread: { width: 8, height: 8, borderRadius: 4, backgroundColor: Palette.ember },
});
