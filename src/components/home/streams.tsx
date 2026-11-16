import { router, type Href } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Txt } from '@/components/signal/txt';
import { Palette, Space } from '@/constants/signal';
import { useDiscoveryHome, useRemindChallenge, useUpcomingReminders } from '@/hooks/use-discovery';
import type { ChallengeCardView } from '@/lib/contract';
import { PressScale } from '@/motion';

// What's on now and next, followed creators first. Both lists come from one discovery query.
export function OnNow() {
  const home = useDiscoveryHome();
  if (!home?.onNow.length) return null;
  return (
    <Section title="On now">
      {home.onNow.map((c) => (
        <Row
          key={c.challengeId}
          title={c.title}
          line={c.entrantCount ? c.entrantCount + ' in' : 'Open now'}
          action="Join"
          onPress={() => router.push(('/c/' + (c.joinCode ?? c.slug)) as Href)}
        />
      ))}
    </Section>
  );
}

export function ComingUp() {
  const home = useDiscoveryHome();
  const reminders = useUpcomingReminders();
  if (!home?.comingUp.length) return null;
  const reminded = new Set((reminders ?? []).map((r) => r.challengeId));
  return (
    <Section title="Coming up">
      {home.comingUp.map((c) => (
        <NextRow key={c.challengeId} challenge={c} reminded={reminded.has(c.challengeId)} />
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

function NextRow({ challenge, reminded }: { challenge: ChallengeCardView; reminded: boolean }) {
  const { remind, cancel } = useRemindChallenge(challenge.challengeId);
  const [local, setLocal] = useState<boolean | null>(null);
  const on = local ?? reminded;
  return (
    <Row
      title={challenge.title}
      line={challenge.startsAt ? when(challenge.startsAt) : 'Starts on stream'}
      action={on ? 'Reminded' : 'Remind me'}
      quiet={on}
      onPress={async () => {
        setLocal(!on);
        try {
          await (on ? cancel() : remind());
        } catch {
          setLocal(on);
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
