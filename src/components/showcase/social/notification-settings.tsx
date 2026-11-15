import { useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import { Txt } from '@/components/signal/txt';
import { Palette, Space } from '@/constants/signal';
import type { Streamer } from '@/mocks/showcase/feed';

import { SampleNote } from './feed';
import { Avatar, Screen, Section, Wash, showcase } from './kit';

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
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

export function NotificationSettingsScreen({ streamers, sample }: { streamers: Streamer[]; sample?: boolean }) {
  const [live, setLive] = useState<Record<string, boolean>>(() => Object.fromEntries(streamers.map((s) => [s.id, true])));
  const [starting, setStarting] = useState(true);
  return (
    <Screen title="Notifications">
      <Section title="Room starting" style={styles.first}>
        <View style={showcase.row}>
          <Txt variant="body" color={Palette.paperMuted} style={showcase.flex}>
            When a reminded drop opens
          </Txt>
          <Toggle label="Room starting" value={starting} onChange={setStarting} />
        </View>
      </Section>
      <Section title="Going live">
        <View style={showcase.list}>
          {streamers.map((s) => (
            <View key={s.id} style={showcase.row}>
              <Avatar initials={s.initials} size={36} />
              <Txt variant="body" style={showcase.flex}>
                {s.name}
              </Txt>
              <Toggle label={`${s.name} going live`} value={live[s.id]} onChange={(v) => setLive((p) => ({ ...p, [s.id]: v }))} />
            </View>
          ))}
        </View>
      </Section>
      {sample ? <SampleNote /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  first: { marginTop: Space.m },
});
