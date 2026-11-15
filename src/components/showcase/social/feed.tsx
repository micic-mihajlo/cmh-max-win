import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Txt } from '@/components/signal/txt';
import { Palette, Space } from '@/constants/signal';
import type { LiveRoom, ScheduledDrop, Streamer } from '@/mocks/showcase/feed';
import { Enter } from '@/motion';

import { Avatar, BigButton, Screen, Section, TextAction, showcase } from './kit';
import { LiveAvatar } from './live-avatar';

const streamerHref = (id: string) => ({ pathname: '/showcase/creator', params: { id } }) as unknown as Href;

export function FeedScreen({
  streamers,
  live,
  upcoming,
  sample,
}: {
  streamers: Streamer[];
  live: LiveRoom[];
  upcoming: ScheduledDrop[];
  sample?: boolean;
}) {
  const [reminded, setReminded] = useState(() => new Set(upcoming.filter((u) => u.reminded).map((u) => u.id)));
  const byId = (id: string) => streamers.find((s) => s.id === id)!;

  if (live.length === 0 && upcoming.length === 0)
    return (
      <Screen title="Following">
        <View style={[showcase.gutter, styles.empty]}>
          <Txt variant="body" color={Palette.paperMuted} style={styles.center}>
            Follow a streamer to see their drops here.
          </Txt>
          <BigButton title="Find streamers" />
        </View>
      </Screen>
    );

  return (
    <Screen title="Following">
      {live.length > 0 ? (
        <Section title="Live now" style={styles.first}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.liveRow} style={styles.bleed}>
            {live.map((l, i) => {
              const s = byId(l.streamerId);
              return (
                <Enter key={l.streamerId} index={i}>
                  <Pressable accessibilityRole="button" accessibilityLabel={`${s.name} is live with ${l.challenge}`} style={styles.live} onPress={() => router.push(streamerHref(s.id))}>
                    <LiveAvatar initials={s.initials} />
                    <Txt variant="smallStrong">{s.name}</Txt>
                    <Txt variant="small" color={Palette.paperMuted} numberOfLines={1}>
                      {l.challenge}
                    </Txt>
                  </Pressable>
                </Enter>
              );
            })}
          </ScrollView>
        </Section>
      ) : null}

      <Section title="Coming up">
        <View>
          {upcoming.map((u) => {
            const s = byId(u.streamerId);
            const on = reminded.has(u.id);
            return (
              <Pressable key={u.id} style={[showcase.row, styles.row]} onPress={() => router.push(streamerHref(s.id))}>
                <Avatar initials={s.initials} size={40} />
                <View style={showcase.flex}>
                  <Txt variant="bodyStrong" numberOfLines={1}>
                    {s.name} · {u.when}
                  </Txt>
                  <Txt variant="small" color={Palette.paperMuted} numberOfLines={1}>
                    {u.challenge}
                  </Txt>
                </View>
                <TextAction
                  title={on ? '✓ Reminded' : 'Remind me'}
                  muted={on}
                  onPress={() =>
                    setReminded((prev) => {
                      const next = new Set(prev);
                      if (on) next.delete(u.id);
                      else next.add(u.id);
                      return next;
                    })
                  }
                />
              </Pressable>
            );
          })}
        </View>
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
