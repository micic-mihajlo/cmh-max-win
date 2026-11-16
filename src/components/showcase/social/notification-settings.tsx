import type { ComponentType } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import { Txt } from '@/components/signal/txt';
import { Palette, Space } from '@/constants/signal';
import type { StreamerCardView } from '@/lib/contract';

import { Account } from './account';
import { SampleNote } from './feed';
import { Avatar, Screen, Section, Wash, showcase } from './kit';

export function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <Switch
      value={value}
      onValueChange={onChange}
      accessibilityLabel={label}
      trackColor={{ true: Palette.paper, false: Wash.neutral }}
      thumbColor={Palette.card}
      {...{ activeThumbColor: Palette.card }}
      ios_backgroundColor={Wash.neutral}
    />
  );
}

export function NotificationSettingsScreen({
  streamers,
  FollowToggle,
  sample,
}: {
  streamers: StreamerCardView[] | undefined;
  FollowToggle: ComponentType<{ streamer: StreamerCardView }>;
  sample?: boolean;
}) {
  return (
    <Screen title="Settings">
      <View style={styles.first}>
        <Account />
      </View>
      <Section title="Going live">
        {streamers && streamers.length === 0 ? (
          <Txt variant="body" color={Palette.paperMuted}>
            Follow a streamer to get a ping when they go live.
          </Txt>
        ) : (
          <View style={showcase.list}>
            {(streamers ?? []).map((s) => (
              <View key={s.streamerId} style={showcase.row}>
                <Avatar initials={s.name.slice(0, 1)} uri={s.avatarUrl} size={36} />
                <Txt variant="body" style={showcase.flex}>
                  {s.name}
                </Txt>
                <FollowToggle streamer={s} />
              </View>
            ))}
          </View>
        )}
      </Section>
      <Txt variant="small" color={Palette.paperMuted} style={[showcase.gutter, styles.note]}>
        Drops you tap Remind me on also ping you when the room opens.
      </Txt>
      {sample ? <SampleNote /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  first: { marginTop: Space.m },
  note: { marginTop: Space.xxl },
});
