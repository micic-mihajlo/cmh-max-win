import { router, type Href } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Txt } from '@/components/signal/txt';
import { Palette, Space } from '@/constants/signal';
import { useDiscoveryHome, useRemindChallenge, useUpcomingReminders } from '@/hooks/use-discovery';
import type { ChallengeCardView } from '@/lib/contract';
import { PressScale } from '@/motion';

const SHOWN = 3;

// What's on now and next, followed creators first. Both lists come from one discovery query. Home shows three of
// each; `all` (the See all page) shows every row. A game needs two players to count as on.
export function OnNow({ all }: { all?: boolean }) {
  const home = useDiscoveryHome();
  const on = (home?.onNow ?? []).filter((c) => c.entrantCount >= 2);
  if (!on.length) return null;
  return (
    <Section title="On now" more={!all && on.length > SHOWN}>
      {(all ? on : on.slice(0, SHOWN)).map((c) => (
        <Row
          key={c.challengeId}
          title={c.title}
          line={byline(c, c.entrantCount + ' in')}
          action="Join"
          onPress={() => router.push(('/c/' + (c.joinCode ?? c.slug)) as Href)}
        />
      ))}
    </Section>
  );
}

export function ComingUp({ all }: { all?: boolean }) {
  const home = useDiscoveryHome();
  const reminders = useUpcomingReminders();
  const next = home?.comingUp ?? [];
  if (!next.length) return null;
  const reminded = new Set((reminders ?? []).map((r) => r.challengeId));
  return (
    <Section title="Coming up" more={!all && next.length > SHOWN}>
      {(all ? next : next.slice(0, SHOWN)).map((c) => (
        <NextRow key={c.challengeId} challenge={c} reminded={reminded.has(c.challengeId)} />
      ))}
    </Section>
  );
}

function Section({ title, more, children }: { title: string; more: boolean; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.head}>
        <Txt variant="label" color={Palette.paperMuted} style={styles.flex}>
          {title}
        </Txt>
        {more ? (
          <PressScale accessibilityRole="link" haptic="tap" hitSlop={12} onPress={() => router.push('/discover' as Href)}>
            <Txt variant="label">See all</Txt>
          </PressScale>
        ) : null}
      </View>
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
      line={byline(challenge, challenge.startsAt ? when(challenge.startsAt) : 'Starts on stream')}
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

function byline(c: ChallengeCardView, detail: string) {
  return c.creator.displayName + ' · ' + detail;
}

// 'Fri 9 pm', or 'Fri 9:30 pm' off the hour.
function when(at: number) {
  const d = new Date(at);
  const day = d.toLocaleDateString('en-US', { weekday: 'short' });
  const h = d.getHours() % 12 || 12;
  const m = d.getMinutes() ? ':' + String(d.getMinutes()).padStart(2, '0') : '';
  return day + ' ' + h + m + (d.getHours() < 12 ? ' am' : ' pm');
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  section: { gap: Space.xs, paddingTop: Space.m },
  head: { flexDirection: 'row', alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Space.m, minHeight: 56, paddingVertical: Space.s },
});
