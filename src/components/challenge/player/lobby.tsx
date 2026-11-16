import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/signal/backdrop';
import { Button } from '@/components/signal/primitives';
import { Txt } from '@/components/signal/txt';
import { Palette, Radius, Space } from '@/constants/signal';
import type { PlayerChallengeView } from '@/lib/contract';
import { Enter } from '@/motion';

import { ChallengeHeading } from './join';
import { RoomPulseField } from './pulse';
import type { RoomPulse } from '@/lib/contract-pulse';

export function LobbyScreen({
  challenge,
  pulse,
  onLeave,
  leaving,
}: {
  challenge: PlayerChallengeView;
  pulse: RoomPulse | null;
  onLeave?: () => void;
  leaving?: boolean;
}) {
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
      {pulse ? (
        <Enter index={2} style={styles.field}>
          <RoomPulseField pulse={pulse} myName={challenge.me.name ?? null} meLocked={false} solo={challenge.teamSize === 1} />
        </Enter>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { justifyContent: 'center', gap: Space.s, paddingTop: Space.xxl },
  field: { flex: 1, minHeight: 0, paddingVertical: Space.xl },
  me: { flexDirection: 'row', alignItems: 'center', gap: Space.s },
  dot: { width: 10, height: 10, borderRadius: Radius.pill, backgroundColor: Palette.ember },
});
