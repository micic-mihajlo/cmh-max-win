import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Txt } from '@/components/signal/txt';
import { Palette, Space } from '@/constants/signal';
import type { StreamerCardView } from '@/lib/contract';

import { followers } from './copy';
import { SampleNote, streamerHref } from './feed';
import { Avatar, Screen, showcase } from './kit';
import { LiveAvatar } from './live-avatar';

export function StreamersScreen({ streamers, sample }: { streamers: StreamerCardView[] | undefined; sample?: boolean }) {
  return (
    <Screen title="Streamers">
      {streamers && streamers.length === 0 ? (
        <Txt variant="body" color={Palette.paperMuted} style={[showcase.gutter, styles.none]}>
          Nobody has hosted a drop yet.
        </Txt>
      ) : (
        <View style={[showcase.gutter, showcase.list, styles.list]}>
          {(streamers ?? []).map((s) => (
            <Pressable key={s.streamerId} accessibilityRole="button" style={showcase.row} onPress={() => router.push(streamerHref(s.streamerId))}>
              {s.live ? <LiveAvatar initials={s.name.slice(0, 1)} size={44} /> : <Avatar initials={s.name.slice(0, 1)} size={44} />}
              <View style={showcase.flex}>
                <Txt variant="bodyStrong">{s.name}</Txt>
                <Txt variant="small" color={Palette.paperMuted}>
                  {s.live ? 'Live now' : followers(s.followerCount)}
                </Txt>
              </View>
              {s.following ? (
                <Txt variant="small" color={Palette.paperMuted}>
                  Following
                </Txt>
              ) : null}
            </Pressable>
          ))}
        </View>
      )}
      {sample ? <SampleNote /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  none: { marginTop: Space.xxxl, textAlign: 'center' },
  list: { marginTop: Space.l },
});
