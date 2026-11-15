import { useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import { Txt } from '@/components/signal/txt';
import { Palette, Space } from '@/constants/signal';
import { creators } from '@/mocks/showcase/social';

import { Avatar, Screen, Section, Wash, showcase } from './kit';

type Prefs = Record<string, { drops: boolean; results: boolean }>;

const initial: Prefs = Object.fromEntries(creators.map((c, i) => [c.id, { drops: i < 3, results: i < 2 }]));

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={showcase.row}>
      <Txt variant="body" style={showcase.flex}>
        {label}
      </Txt>
      <Switch
        value={value}
        onValueChange={onChange}
        accessibilityLabel={label}
        trackColor={{ true: Palette.paper, false: Wash.neutral }}
        thumbColor={Palette.card}
        {...{ activeThumbColor: Palette.card }}
        ios_backgroundColor={Wash.neutral}
      />
    </View>
  );
}

export function NotificationSettingsScreen() {
  const [prefs, setPrefs] = useState(initial);
  const [squad, setSquad] = useState(true);
  const set = (id: string, key: 'drops' | 'results', v: boolean) => setPrefs((p) => ({ ...p, [id]: { ...p[id], [key]: v } }));
  return (
    <Screen title="Notifications">
      <Section title="You" style={styles.first}>
        <Toggle label="Squad invites" value={squad} onChange={setSquad} />
      </Section>
      <Section title="Creators you follow">
        {creators.map((c) => (
          <View key={c.id} style={styles.group}>
          <View style={showcase.row}>
            <Avatar initials={c.initials} size={36} />
            <Txt variant="bodyStrong" style={showcase.flex}>
              {c.name}
            </Txt>
          </View>
          <Toggle label="New drops" value={prefs[c.id].drops} onChange={(v) => set(c.id, 'drops', v)} />
          <Toggle label="Results" value={prefs[c.id].results} onChange={(v) => set(c.id, 'results', v)} />
          </View>
        ))}
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  first: { marginTop: Space.m },
  group: { gap: Space.m, marginBottom: Space.l },
});
