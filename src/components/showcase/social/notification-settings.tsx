import { useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import { Txt } from '@/components/signal/txt';
import { Palette, Space } from '@/constants/signal';
import { creators } from '@/mocks/showcase/social';

import { Avatar, Card, Hairline, Screen, Section, showcase } from './kit';

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
        trackColor={{ true: Palette.ember, false: Palette.hairline }}
        thumbColor={Palette.card}
        {...{ activeThumbColor: Palette.card }}
        ios_backgroundColor={Palette.hairline}
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
        <Card style={styles.card}>
          <Toggle label="Squad invites" value={squad} onChange={setSquad} />
        </Card>
      </Section>
      <Section title="Creators you follow">
        {creators.map((c) => (
          <Card key={c.id} style={styles.card}>
            <View style={showcase.row}>
              <Avatar initials={c.initials} size={36} />
              <View style={showcase.flex}>
                <Txt variant="bodyStrong">{c.name}</Txt>
                <Txt variant="small" color={Palette.paperMuted}>
                  {c.tagline}
                </Txt>
              </View>
            </View>
            <Hairline />
            <Toggle label="New drops" value={prefs[c.id].drops} onChange={(v) => set(c.id, 'drops', v)} />
            <Toggle label="Results" value={prefs[c.id].results} onChange={(v) => set(c.id, 'results', v)} />
          </Card>
        ))}
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  first: { marginTop: Space.m },
  card: { gap: Space.m },
});
