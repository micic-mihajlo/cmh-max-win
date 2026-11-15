import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Txt } from '@/components/signal/txt';
import { Palette, Space } from '@/constants/signal';
import type { FeedLiveRow, StreamerPageView } from '@/lib/contract';
import { Enter, Haptic } from '@/motion';

import { dropTime, followers, nameList } from './copy';
import { SampleNote } from './feed';
import { pushAvailable } from './push';
import { Avatar, BigButton, Screen, Section, TextAction, showcase } from './kit';

let askedForPings = false;

export function StreamerScreen({
  page,
  onFollow,
  onUnfollow,
  onOpenLive,
  onTurnOnPings,
  sample,
}: {
  page: StreamerPageView | null | undefined;
  onFollow: () => void;
  onUnfollow: () => void;
  onOpenLive: (row: FeedLiveRow) => void;
  onTurnOnPings?: () => void;
  sample?: boolean;
}) {
  const [asking, setAsking] = useState(false);

  if (page === undefined) return <Screen>{null}</Screen>;
  if (page === null)
    return (
      <Screen>
        <Txt variant="body" color={Palette.paperMuted} style={[showcase.gutter, styles.none]}>
          No streamer to show yet.
        </Txt>
      </Screen>
    );

  const follow = () => {
    Haptic.tap();
    onFollow();
    if (askedForPings) return;
    askedForPings = true;
    setAsking(true);
  };

  return (
    <Screen scroll={false}>
      <View style={styles.body}>
        <Enter style={[showcase.gutter, styles.head]}>
          <Avatar initials={page.name.slice(0, 1)} size={84} />
          <Txt variant="display">{page.name}</Txt>
          <Txt variant="body" color={Palette.paperMuted}>
            {followers(page.followerCount)}
          </Txt>
        </Enter>
        <View style={[showcase.gutter, styles.follow]}>
          {page.following ? (
            <Animated.View entering={FadeIn.duration(150)} style={styles.center}>
              <TextAction title="Following" muted onPress={onUnfollow} />
            </Animated.View>
          ) : (
            <BigButton title="Follow" onPress={follow} />
          )}
        </View>

        {page.liveDrop ? (
          <Pressable
            accessibilityRole="button"
            disabled={page.liveDrop.dropStatus === 'live'}
            style={[showcase.gutter, showcase.row, styles.live]}
            onPress={() => onOpenLive(page.liveDrop!)}>
            <View style={styles.dot} />
            <Txt variant="bodyStrong" style={showcase.flex}>
              Live now · {page.liveDrop.title}
            </Txt>
            <Txt variant="label" color={page.liveDrop.dropStatus === 'live' ? Palette.paperMuted : Palette.paper}>
              {page.liveDrop.dropStatus === 'live' ? 'In progress' : 'Join'}
            </Txt>
          </Pressable>
        ) : null}

        <Section title={page.nextDrop ? `Next drop · ${dropTime(page.nextDrop.startsAt, page.serverNow)}` : 'No drop scheduled'}>
          <View style={showcase.list}>
            {page.past.slice(0, 3).map((d) => (
              <View key={d.dropId}>
                <Txt variant="body" numberOfLines={1}>
                  {d.winner ? nameList(d.winner.memberNames) : d.title}
                </Txt>
                {d.winner ? (
                  <Txt variant="caption" color={Palette.paperMuted} numberOfLines={1}>
                    {d.winner.squadLabel} · {d.title}
                  </Txt>
                ) : null}
              </View>
            ))}
          </View>
        </Section>
      </View>
      {sample ? <SampleNote /> : null}
      <PingSheet
        name={page.name}
        visible={asking}
        onTurnOn={() => {
          setAsking(false);
          onTurnOnPings?.();
        }}
        onClose={() => setAsking(false)}
      />
    </Screen>
  );
}

function PingSheet({ name, visible, onTurnOn, onClose }: { name: string; visible: boolean; onTurnOn: () => void; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Close" />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + Space.xl }]}>
        <Txt variant="title" style={styles.centerText}>
          Get a ping when {name} goes live?
        </Txt>
        {pushAvailable ? (
          <>
            <BigButton title="Turn on" onPress={onTurnOn} />
            <View style={styles.center}>
              <TextAction title="Not now" muted onPress={onClose} />
            </View>
          </>
        ) : (
          <>
            <Txt variant="body" color={Palette.paperMuted} style={styles.centerText}>
              Pings work in the SIGNAL app.
            </Txt>
            <BigButton title="Got it" onPress={onClose} />
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, justifyContent: 'center', paddingBottom: Space.xxxl },
  none: { marginTop: Space.xxxl, textAlign: 'center' },
  head: { alignItems: 'center', gap: Space.s, marginTop: Space.s },
  center: { alignItems: 'center' },
  centerText: { textAlign: 'center' },
  follow: { marginTop: Space.xl, minHeight: 52, justifyContent: 'center' },
  live: { marginTop: Space.xl },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Palette.ember },
  scrim: { flex: 1, backgroundColor: 'rgba(22,21,19,0.2)' },
  sheet: { backgroundColor: Palette.ink, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: Space.xl, gap: Space.xl },
});
