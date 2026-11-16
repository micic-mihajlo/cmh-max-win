import { router, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Txt } from '@/components/signal/txt';
import { Palette, Space } from '@/constants/signal';
import { useMyChallenges } from '@/hooks/use-challenges';
import type { ChallengeSummaryView } from '@/lib/contract';
import { PressScale } from '@/motion';

const SHOWN = 3;

// The creator's own challenges on home, only once they have some: drafts open the editor, running ones the host
// console, finished ones the recap.
export function YourChallenges() {
  const mine = useMyChallenges();
  if (!mine?.length) return null;
  return (
    <View style={styles.section}>
      <Txt variant="label" color={Palette.paperMuted}>
        Your challenges
      </Txt>
      {mine.slice(0, SHOWN).map((c) => (
        <PressScale
          key={c.challengeId}
          accessibilityRole="button"
          haptic="tap"
          scaleTo={0.98}
          onPress={() => router.push(hrefFor(c))}
          style={styles.row}>
          <View style={styles.flex}>
            <Txt variant="bodyStrong" numberOfLines={1}>
              {c.config.title || 'Untitled'}
            </Txt>
            <Txt variant="small" color={Palette.paperMuted}>
              {statusLine(c)}
            </Txt>
          </View>
          {c.status === 'live' ? <View style={styles.liveDot} /> : null}
        </PressScale>
      ))}
      {mine.length > SHOWN ? <QuietLink title="See all" onPress={() => router.push('/studio')} /> : null}
    </View>
  );
}

export function QuietLink({ title, onPress, disabled }: { title: string; onPress?: () => void; disabled?: boolean }) {
  return (
    <PressScale accessibilityRole="link" haptic="tap" disabled={disabled} onPress={onPress} style={styles.link}>
      <Txt variant="label" color={disabled ? Palette.disabledText : Palette.paper}>
        {title}
      </Txt>
    </PressScale>
  );
}

function statusLine(c: ChallengeSummaryView) {
  if (c.status === 'draft') return 'Draft';
  if (c.status === 'live') return 'Running';
  if (c.status === 'published') return 'Open';
  const when = c.endedAt ? ' · ' + new Date(c.endedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
  return (c.status === 'cancelled' ? 'Cancelled' : 'Ended') + when;
}

function hrefFor(c: ChallengeSummaryView): Href {
  if (c.status === 'draft') return { pathname: '/studio/[id]', params: { id: c.challengeId } };
  if (c.status === 'ended' || c.status === 'cancelled') return ('/studio/recap/' + c.challengeId) as Href;
  return ('/studio/run/' + c.challengeId) as Href;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  section: { gap: Space.xs, paddingTop: Space.m },
  row: { flexDirection: 'row', alignItems: 'center', gap: Space.m, minHeight: 52, paddingVertical: Space.s },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Palette.ember },
  link: { minHeight: 36, alignItems: 'center', justifyContent: 'center' },
});
