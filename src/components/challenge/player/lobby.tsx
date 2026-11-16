import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/signal/backdrop';
import { Button } from '@/components/signal/primitives';
import { Txt } from '@/components/signal/txt';
import { Palette, Radius, Space } from '@/constants/signal';
import type { PlayerChallengeView } from '@/lib/contract';
import { Enter } from '@/motion';

import { ChallengeHeading } from './join';

export function LobbyScreen({ challenge, onLeave, leaving }: { challenge: PlayerChallengeView; onLeave?: () => void; leaving?: boolean }) {
  const waitingNext = challenge.me.waitingNextRound;
  const status = waitingNext
    ? 'Teams are set. You play the next round.'
    : challenge.status === 'live'
      ? 'Starting'
      : `Waiting for ${challenge.creator.displayName} to start`;
  return (
    <Screen
      scroll={false}
      footer={onLeave ? <Button title={leaving ? 'Leaving' : 'Leave'} variant="secondary" disabled={leaving} onPress={onLeave} /> : undefined}>
      <ChallengeHeading challenge={challenge} play={false} />
      <View style={styles.center}>
        <Enter index={0} style={styles.me}>
          <View style={styles.dot} />
          <Txt variant="name">{`You're in as ${challenge.me.name ?? 'you'}`}</Txt>
        </Enter>
        <Enter index={1}>
          <Txt variant="small" color={Palette.paperMuted} accessibilityLiveRegion="polite">
            {status}
          </Txt>
        </Enter>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', gap: Space.s, paddingBottom: Space.xxxl },
  me: { flexDirection: 'row', alignItems: 'center', gap: Space.s },
  dot: { width: 10, height: 10, borderRadius: Radius.pill, backgroundColor: Palette.ember },
});
