import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Txt } from '@/components/signal/txt';
import { PressScale } from '@/motion';
import { Palette, Space } from '@/constants/signal';
import type { StreamerCardView } from '@/lib/contract';

import { followers } from './copy';
import { SampleNote, streamerHref } from './feed';
import { Avatar, Screen, showcase } from './kit';

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
            <PressScale scaleTo={0.98} haptic="tap" key={s.streamerId} accessibilityRole="button" style={showcase.row} onPress={() => router.push(streamerHref(s.streamerId))}>
              <Avatar initials={s.name.slice(0, 1)} uri={s.avatarUrl} size={44} />
              <View style={showcase.flex}>
                <Txt variant="bodyStrong">{s.name}</Txt>
                {s.live || s.showFollowerCount !== false ? (
                  <Txt variant="small" color={Palette.paperMuted}>
                    {s.live ? 'Happening now' : followers(s.followerCount)}
                  </Txt>
                ) : null}
              </View>
              {s.following ? (
                <Txt variant="small" color={Palette.paperMuted}>
                  Following
                </Txt>
              ) : null}
            </PressScale>
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
