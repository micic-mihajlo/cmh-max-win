import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/signal/backdrop';
import { Label } from '@/components/signal/primitives';
import { Txt } from '@/components/signal/txt';
import { Palette, Radius, Space } from '@/constants/signal';
import { PressScale, Stagger } from '@/motion';

import { money, Tagline } from './ui';

export type CreatorDrop = { title: string; totalCents: number; winnerSlots: number };

// Nova's screen: one prefilled drop card and Open drop. Creating a drop is server-only today, so the prefilled
// card is a mock; the live card shows the real entrant count from useDrop.
export function CreatorSetupScreen({ drop, live, onOpen }: { drop: CreatorDrop; live?: { entrantCount: number; shareUrl: string }; onOpen?: () => void }) {
  return (
    <Screen
      footer={
        live ? (
          <Txt variant="small" color={Palette.paperMuted} style={styles.center}>
            Free to enter. The first correct squads win, no luck involved.
          </Txt>
        ) : (
          <PressScale onPress={onOpen} style={styles.cta}>
            <Txt variant="button" color={Palette.onAccent}>
              Open drop
            </Txt>
          </PressScale>
        )
      }>
      <View style={styles.head}>
        <Label>{live ? 'Your drop is live' : 'New drop'}</Label>
        <Txt variant="display">{live ? 'Share it with your followers' : 'Run a drop'}</Txt>
      </View>
      <View style={[styles.card, live && styles.cardLive]}>
        <View style={styles.row}>
          <View style={styles.art}>
            <Txt variant="title" color={Palette.paper}>
              A
            </Txt>
          </View>
          <View style={styles.flex}>
            <Txt variant="name">{drop.title}</Txt>
            <Txt variant="small" color={Palette.paperMuted}>
              {`${money(drop.totalCents)} · first ${drop.winnerSlots} squads win`}
            </Txt>
          </View>
          {live ? (
            <View style={styles.liveTag}>
              <Txt variant="label" color={Palette.onAccent}>
                Live
              </Txt>
            </View>
          ) : null}
        </View>
        {live ? (
          <Stagger>
            <View style={styles.line}>
              <Txt variant="small" color={Palette.paperMuted} numberOfLines={1} style={styles.flex}>
                {live.shareUrl}
              </Txt>
              <Txt variant="smallStrong" color={Palette.ember}>
                Share
              </Txt>
            </View>
            <View style={styles.line}>
              <Txt variant="title" style={styles.count}>
                {live.entrantCount}
              </Txt>
              <Txt variant="body" color={Palette.paperMuted}>
                joined
              </Txt>
            </View>
          </Stagger>
        ) : null}
      </View>
      <Txt variant="quote" color={Palette.paperMuted}>
        {Tagline}
      </Txt>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  head: { gap: Space.s, marginTop: Space.s },
  card: { gap: Space.m, padding: Space.l, borderRadius: 16, backgroundColor: Palette.panel, borderWidth: 1.5, borderColor: Palette.hairline },
  cardLive: { borderColor: Palette.ember },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  art: { width: 56, height: 56, borderRadius: Radius.m, backgroundColor: Palette.panelRaised, alignItems: 'center', justifyContent: 'center' },
  liveTag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.pill, backgroundColor: Palette.ember },
  line: { flexDirection: 'row', alignItems: 'baseline', gap: Space.s, paddingTop: Space.s },
  count: { fontVariant: ['tabular-nums'] },
  cta: { height: 54, borderRadius: 16, backgroundColor: Palette.ember, alignItems: 'center', justifyContent: 'center' },
});
