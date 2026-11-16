import { router, type Href } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Txt } from '@/components/signal/txt';
import { Palette, Space } from '@/constants/signal';
import { useRemindMe, useStreamerPage, useStreamers } from '@/hooks/use-feed';
import type { StreamerCardView } from '@/lib/contract';
import { PressScale } from '@/motion';

// What's happening now and next from the streamers on Signal. Each streamer's page is its own query, so a row
// appears as soon as its streamer has something on.
export function OnNow() {
  const streamers = useStreamers();
  const live = (streamers ?? []).filter((s) => s.live);
  if (!live.length) return null;
  return (
    <Section title="On now">
      {live.map((s) => (
        <LiveRow key={s.streamerId} streamer={s} />
      ))}
    </Section>
  );
}

export function ComingUp() {
  const streamers = useStreamers();
  if (!streamers?.length) return null;
  return (
    <Section title="Coming up">
      {streamers.map((s) => (
        <NextRow key={s.streamerId} streamer={s} />
      ))}
    </Section>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Txt variant="label" color={Palette.paperMuted}>
        {title}
      </Txt>
      {children}
    </View>
  );
}

function LiveRow({ streamer }: { streamer: StreamerCardView }) {
  const page = useStreamerPage(streamer.streamerId);
  const drop = page?.liveDrop;
  if (!drop) return null;
  return (
    <Row
      title={drop.title}
      line={drop.entrantCount ? streamer.name + ' · ' + drop.entrantCount + ' in' : streamer.name}
      action="Join"
      onPress={() => router.push(('/join/' + drop.joinCode) as Href)}
    />
  );
}

function NextRow({ streamer }: { streamer: StreamerCardView }) {
  const page = useStreamerPage(streamer.streamerId);
  const drop = page?.nextDrop;
  const { remind, cancel } = useRemindMe(drop?.dropId ?? '');
  const [reminded, setReminded] = useState<boolean | null>(null);
  if (!drop) return null;
  const on = reminded ?? drop.reminded;
  return (
    <Row
      title={drop.title}
      line={streamer.name + ' · ' + when(drop.startsAt)}
      action={on ? 'Reminded' : 'Remind me'}
      quiet={on}
      onPress={async () => {
        setReminded(!on);
        try {
          await (on ? cancel() : remind());
        } catch {
          setReminded(on);
        }
      }}
    />
  );
}

function Row({ title, line, action, quiet, onPress }: { title: string; line: string; action: string; quiet?: boolean; onPress: () => void }) {
  return (
    <PressScale
      accessibilityRole="button"
      accessibilityLabel={title + ', ' + action}
      haptic="tap"
      scaleTo={0.98}
      onPress={onPress}
      style={styles.row}>
      <View style={styles.flex}>
        <Txt variant="bodyStrong" numberOfLines={1}>
          {title}
        </Txt>
        <Txt variant="small" color={Palette.paperMuted} numberOfLines={1}>
          {line}
        </Txt>
      </View>
      <Txt variant="label" color={quiet ? Palette.paperMuted : Palette.paper}>
        {action}
      </Txt>
    </PressScale>
  );
}

function when(at: number) {
  return new Date(at).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' });
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  section: { gap: Space.xs, paddingTop: Space.m },
  row: { flexDirection: 'row', alignItems: 'center', gap: Space.m, minHeight: 56, paddingVertical: Space.s },
});
