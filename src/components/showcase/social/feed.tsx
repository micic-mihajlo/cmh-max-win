import { router, type Href } from 'expo-router';
import type { ComponentType } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Txt } from '@/components/signal/txt';
import { Palette, Space } from '@/constants/signal';
import type { FeedLiveRow, FeedUpcomingRow, FollowingFeedView } from '@/lib/contract';
import { Enter, PressScale } from '@/motion';

import { dropTime } from './copy';
import { Avatar, BigButton, Screen, Section, showcase } from './kit';

export const streamerHref = (id: string) => ({ pathname: '/showcase/creator', params: { id } }) as unknown as Href;

export function FeedScreen({
  view,
  Remind,
  onOpenLive,
  sample,
}: {
  view: FollowingFeedView | undefined;
  Remind: ComponentType<{ row: FeedUpcomingRow }>;
  onOpenLive: (row: FeedLiveRow) => void;
  sample?: boolean;
}) {
  if (!view) return <Screen title="Following">{null}</Screen>;
  const avatar = (streamerId: string) => view.following.find((s) => s.streamerId === streamerId)?.avatarUrl;

  if (view.following.length === 0)
    return (
      <Screen title="Following">
        <View style={[showcase.gutter, styles.empty]}>
          <Txt variant="body" color={Palette.paperMuted} style={styles.center}>
            Follow a streamer to see their drops here.
          </Txt>
          <BigButton title="Find streamers" onPress={() => router.push('/showcase/streamers' as Href)} />
        </View>
      </Screen>
    );

  return (
    <Screen title="Following">
      {view.live.length > 0 ? (
        <Section title="Happening now" style={styles.first}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.liveRow} style={styles.bleed}>
            {view.live.map((l, i) => (
              <Enter key={l.dropId} index={i}>
                <PressScale scaleTo={0.98} haptic="tap" accessibilityRole="button" accessibilityLabel={`${l.streamerName}, ${l.title}`} style={styles.live} onPress={() => onOpenLive(l)}>
                  <Avatar initials={l.streamerName.slice(0, 1)} uri={avatar(l.streamerId)} size={56} />
                  <Txt variant="smallStrong">{l.streamerName}</Txt>
                  <Txt variant="small" color={Palette.paperMuted} numberOfLines={1}>
                    {l.dropStatus === 'live' ? 'In progress' : l.title}
                  </Txt>
                </PressScale>
              </Enter>
            ))}
          </ScrollView>
        </Section>
      ) : null}

      <Section title="Coming up">
        {view.upcoming.length === 0 ? (
          <Txt variant="body" color={Palette.paperMuted}>
            Nothing scheduled yet.
          </Txt>
        ) : (
          <View>
            {view.upcoming.map((u) => (
              <PressScale scaleTo={0.98} haptic="tap" key={u.dropId} style={[showcase.row, styles.row]} onPress={() => router.push(streamerHref(u.streamerId))}>
                <Avatar initials={u.streamerName.slice(0, 1)} uri={avatar(u.streamerId)} size={40} />
                <View style={showcase.flex}>
                  <Txt variant="bodyStrong" numberOfLines={1}>
                    {u.streamerName}
                  </Txt>
                  <Txt variant="small" color={Palette.paperMuted} numberOfLines={1}>
                    {dropTime(u.startsAt, view.serverNow)} · {u.title}
                  </Txt>
                </View>
                <Remind row={u} />
              </PressScale>
            ))}
          </View>
        )}
      </Section>
      {sample ? <SampleNote /> : null}
    </Screen>
  );
}

export function SampleNote() {
  return (
    <Txt variant="small" color={Palette.paperMuted} style={styles.sample}>
      Sample data
    </Txt>
  );
}

const styles = StyleSheet.create({
  first: { marginTop: Space.s },
  bleed: { marginHorizontal: -Space.xl },
  liveRow: { paddingHorizontal: Space.xl, gap: Space.xl },
  live: { width: 124, gap: Space.xs },
  row: { minHeight: 64 },
  empty: { flex: 1, justifyContent: 'center', gap: Space.xl, marginTop: Space.xxxl * 3 },
  center: { textAlign: 'center' },
  sample: { textAlign: 'center', marginTop: Space.xxxl },
});
