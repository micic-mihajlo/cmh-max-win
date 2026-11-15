import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/signal/backdrop';
import { Icon } from '@/components/signal/icon';
import { Banner, Button, NextStep } from '@/components/signal/primitives';
import { Txt } from '@/components/signal/txt';
import { Palette, Space } from '@/constants/signal';

import { useServerNow } from './clock';
import type { DropView } from './contract';
import { clock, DropCard, Stat } from './ui';

export function DropEntryScreen({ drop, error, joining }: { drop: DropView; error?: 'DROP_CLOSED' | 'DROP_NOT_FOUND'; joining?: boolean }) {
  const now = useServerNow(drop.serverNow);
  const closed = error === 'DROP_CLOSED';
  return (
    <Screen
      footer={
        closed ? (
          <>
            <Banner tone="warn" title="This drop already started." text="Squads formed without you. You can still watch the race." />
            <Button title="Watch the leaderboard" variant="secondary" icon={<Icon name="list.number" />} />
          </>
        ) : (
          <>
            <NextStep>{`You’ll play as ${drop.me.name ?? 'you'}. Squads form when the drop opens.`}</NextStep>
            <Button title={joining ? 'Joining…' : 'Join the drop'} disabled={joining} />
          </>
        )
      }>
      <DropCard drop={drop} />
      <View style={styles.stats}>
        <Stat label={closed ? 'Started' : 'Opens in'} value={closed ? 'Live' : clock(drop.startsAt - now)} accent={closed ? Palette.ember : undefined} />
        <Stat label="Joined" value={String(drop.entrantCount)} />
      </View>
      <Txt variant="small" color={Palette.paperMuted}>
        Free to enter, no purchase needed. Winners are decided by skill and speed only, never by chance.
      </Txt>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', gap: Space.l, paddingHorizontal: Space.xs },
});
