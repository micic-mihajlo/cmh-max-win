import { router, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Txt } from '@/components/signal/txt';
import { Palette, Space } from '@/constants/signal';
import { notes, push } from '@/mocks/showcase/social';
import { Enter } from '@/motion';

import { Avatar, Screen, Section, TextAction, showcase } from './kit';
import { PushBanner } from './push-banner';

const groups = ['Today', 'Earlier'] as const;

export function NotificationsScreen() {
  return (
    <Screen title="Notifications" right={<TextAction title="Settings" muted onPress={() => router.push('/showcase/notification-settings' as Href)} />}>
      <Enter style={[showcase.gutter, styles.push]}>
        <PushBanner {...push} />
      </Enter>
      {groups.map((g) => (
        <Section key={g} title={g}>
          <View style={showcase.list}>
            {notes
              .filter((n) => n.group === g)
              .map((n) => (
                <View key={n.id} style={[showcase.row, styles.item]}>
                  <Avatar initials={n.initials} size={40} />
                  <View style={showcase.flex}>
                    <Txt variant="bodyStrong">{n.title}</Txt>
                    <Txt variant="small" color={Palette.paperMuted}>
                      {n.body} · {n.when}
                    </Txt>
                    {n.action ? (
                      <View style={styles.action}>
                        <TextAction title={n.action} />
                      </View>
                    ) : null}
                  </View>
                  {n.unread ? <View style={styles.unread} /> : null}
                </View>
              ))}
          </View>
        </Section>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  push: { marginTop: Space.s },
  item: { alignItems: 'flex-start' },
  action: { alignSelf: 'flex-start', marginTop: Space.s },
  unread: { width: 8, height: 8, borderRadius: 4, backgroundColor: Palette.paper, marginTop: Space.s },
});
