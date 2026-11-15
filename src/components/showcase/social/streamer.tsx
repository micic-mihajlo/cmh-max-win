import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Txt } from '@/components/signal/txt';
import { Palette, Space } from '@/constants/signal';
import type { Streamer } from '@/mocks/showcase/feed';
import { Enter, Haptic } from '@/motion';

import { SampleNote } from './feed';
import { Avatar, BigButton, Screen, Section, TextAction, showcase } from './kit';

let askedForPings = false;

export function StreamerScreen({ streamer, sample }: { streamer: Streamer | null; sample?: boolean }) {
  const [following, setFollowing] = useState(false);
  const [asking, setAsking] = useState(false);

  if (!streamer)
    return (
      <Screen>
        <Txt variant="body" color={Palette.paperMuted} style={[showcase.gutter, styles.none]}>
          No streamer to show yet.
        </Txt>
      </Screen>
    );

  const follow = () => {
    Haptic.tap();
    setFollowing(true);
    if (askedForPings) return;
    askedForPings = true;
    setAsking(true);
  };

  return (
    <Screen>
      <Enter style={[showcase.gutter, styles.head]}>
        <Avatar initials={streamer.initials} size={84} />
        <Txt variant="display">{streamer.name}</Txt>
        <Txt variant="body" color={Palette.paperMuted} style={styles.center}>
          {streamer.bio}
        </Txt>
      </Enter>
      <View style={[showcase.gutter, styles.follow]}>
        {following ? (
          <Animated.View entering={FadeIn.duration(150)} style={styles.following}>
            <TextAction title="Following" muted onPress={() => setFollowing(false)} />
          </Animated.View>
        ) : (
          <BigButton title="Follow" onPress={follow} />
        )}
      </View>

      <Section title={`Next drop · ${streamer.nextDrop}`}>
        <View style={showcase.list}>
          {streamer.past.map((c) => (
            <Txt key={c} variant="body">
              {c}
            </Txt>
          ))}
        </View>
      </Section>
      {sample ? <SampleNote /> : null}
      <PingSheet name={streamer.name} visible={asking} onClose={() => setAsking(false)} />
    </Screen>
  );
}

function PingSheet({ name, visible, onClose }: { name: string; visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Close" />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + Space.xl }]}>
        <Txt variant="title" style={styles.center}>
          Get a ping when {name} goes live?
        </Txt>
        <BigButton title="Turn on" onPress={onClose} />
        <View style={styles.later}>
          <TextAction title="Not now" muted onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  none: { marginTop: Space.xxxl, textAlign: 'center' },
  head: { alignItems: 'center', gap: Space.s, marginTop: Space.s },
  center: { textAlign: 'center' },
  follow: { marginTop: Space.xl, minHeight: 52, justifyContent: 'center' },
  following: { alignItems: 'center' },
  scrim: { flex: 1, backgroundColor: 'rgba(22,21,19,0.2)' },
  sheet: {
    backgroundColor: Palette.ink,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: Space.xl,
    gap: Space.xl,
  },
  later: { alignItems: 'center' },
});
