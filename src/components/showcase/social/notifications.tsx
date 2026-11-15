import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Txt } from '@/components/signal/txt';
import { Palette, Space } from '@/constants/signal';

import { notificationCopy, type InboxItem } from './copy';
import { SampleNote } from './feed';
import { InAppBanner } from './in-app-banner';
import { Avatar, Screen, TextAction, showcase } from './kit';

export function NotificationsScreen({ items, onOpen, sample }: { items: InboxItem[]; onOpen: (n: InboxItem) => void; sample?: boolean }) {
  const [banner, setBanner] = useState<InboxItem | null>(items[0] ?? null);

  return (
    <View style={styles.flex}>
      <Screen title="Notifications" right={<TextAction title="Settings" muted onPress={() => router.push('/showcase/notification-settings' as Href)} />}>
        {items.length === 0 ? (
          <Txt variant="body" color={Palette.paperMuted} style={[showcase.gutter, styles.none]}>
            No notifications yet.
          </Txt>
        ) : (
          <View style={[showcase.gutter, showcase.list, styles.list]}>
            {items.map((n) => {
              const copy = notificationCopy(n);
              return (
                <Pressable key={n.id} accessibilityRole="button" style={[showcase.row, styles.item]} onPress={() => onOpen(n)}>
                  <Avatar initials={n.streamerName.slice(0, 1)} size={40} />
                  <View style={showcase.flex}>
                    <Txt variant="bodyStrong" numberOfLines={1}>
                      {copy.title}
                    </Txt>
                    <Txt variant="small" color={Palette.paperMuted} numberOfLines={1}>
                      {copy.body} · {n.when}
                    </Txt>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
        {sample ? <SampleNote /> : null}
      </Screen>
      {banner ? (
        <InAppBanner initials={banner.streamerName.slice(0, 1)} {...notificationCopy(banner)} onPress={() => onOpen(banner)} onDone={() => setBanner(null)} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  none: { marginTop: Space.xxxl, textAlign: 'center' },
  list: { marginTop: Space.l },
  item: { alignItems: 'flex-start' },
});
