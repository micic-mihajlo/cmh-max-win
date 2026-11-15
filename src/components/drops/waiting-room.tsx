import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/signal/backdrop';
import { Banner, Button, Label, NextStep } from '@/components/signal/primitives';
import { Txt } from '@/components/signal/txt';
import { Palette, Radius, Space } from '@/constants/signal';

import type { DropView } from './contract';
import { BountyLine, clock, Stat, Tagline } from './ui';

export function WaitingRoomScreen({ drop, now, forming }: { drop: DropView; now: number; forming?: boolean }) {
  const shown = drop.entrants.slice(-18);
  const more = drop.entrantCount - shown.length;
  const unmatched = drop.me.unmatched;
  return (
    <Screen
      footer={
        unmatched ? (
          <>
            <Banner tone="info" title="Nobody left to pair with." text="You were the only one waiting, so no squad formed. Catch the next drop." />
            <Button title="Back to drops" variant="secondary" />
          </>
        ) : (
          <>
            <NextStep>{forming ? 'Forming squads…' : 'Squads form when the drop opens.'}</NextStep>
            <Button title="Leave the waiting room" variant="ghost" disabled={forming} />
          </>
        )
      }>
      <View style={styles.head}>
        <Label color={Palette.ember}>Waiting room · {drop.creatorName}</Label>
        <Txt variant="display">{drop.title}</Txt>
        <BountyLine bounty={drop.bounty} />
      </View>
      <View style={styles.stats}>
        <Stat
          label={unmatched ? 'Drop' : forming ? 'Opening' : 'Opens in'}
          value={unmatched ? 'Live' : clock(drop.startsAt - now)}
          accent={forming ? Palette.ember : undefined}
        />
        <Stat label="Joined" value={String(drop.entrantCount)} />
      </View>
      <View style={styles.crowd}>
        <Label>In the room</Label>
        <View style={styles.chips}>
          {shown.map((e, i) => (
            <View key={`${e.name}-${i}`} style={[styles.chip, e.isMe && styles.chipMe]}>
              <Txt variant="smallStrong" color={e.isMe ? Palette.ink : Palette.paper}>
                {e.isMe ? `${e.name} (you)` : e.name}
              </Txt>
            </View>
          ))}
          {more > 0 ? (
            <View style={styles.chip}>
              <Txt variant="smallStrong" color={Palette.paperMuted}>
                +{more} more
              </Txt>
            </View>
          ) : null}
        </View>
      </View>
      <Txt variant="quote" color={Palette.paperMuted}>
        {Tagline}
      </Txt>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { gap: Space.s, marginTop: Space.s },
  stats: { flexDirection: 'row', gap: Space.l },
  crowd: { gap: Space.s },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    backgroundColor: Palette.panel,
    borderWidth: 1,
    borderColor: Palette.hairline,
  },
  chipMe: { backgroundColor: Palette.ember, borderColor: Palette.ember },
});
