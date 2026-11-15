import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Txt } from '@/components/signal/txt';
import { Palette, Space } from '@/constants/signal';
import type { FeedNotification, Streamer } from '@/mocks/showcase/feed';

import { notificationCopy } from './copy';
import { SampleNote } from './feed';
import { InAppBanner } from './in-app-banner';
import { Avatar, Screen, TextAction, showcase } from './kit';

export function NotificationsScreen({ streamers, items, sample }: { streamers: Streamer[]; items: FeedNotification[]; sample?: boolean }) {
  const byId = (id: string) => streamers.find((s) => s.id === id)!;
  const [banner, setBanner] = useState<FeedNotification | null>(items[0] ?? null);
  const open = (n: FeedNotification) => router.push({ pathname: '/showcase/creator', params: { id: n.streamerId } } as unknown as Href);
  const bannerStreamer = banner ? byId(banner.streamerId) : null;

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
              const s = byId(n.streamerId);
              const copy = notificationCopy(n, s);
              return (
                <Pressable key={n.id} accessibilityRole="button" style={[showcase.row, styles.item]} onPress={() => open(n)}>
                  <Avatar initials={s.initials} size={40} />
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
      {banner && bannerStreamer ? (
        <InAppBanner
          initials={bannerStreamer.initials}
          {...notificationCopy(banner, bannerStreamer)}
          onPress={() => open(banner)}
          onDone={() => setBanner(null)}
        />
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
