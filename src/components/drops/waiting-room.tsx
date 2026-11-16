import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/signal/backdrop';
import { Banner, Button, Label } from '@/components/signal/primitives';
import { Txt } from '@/components/signal/txt';
import { FontFamily, Palette, RoleColors, Space } from '@/constants/signal';
import { Enter } from '@/motion';

import { useServerClock } from './clock';
import type { DropView } from '@/lib/contract';
import { clock } from './ui';

const avatarColors = [Palette.paper, RoleColors.witness, RoleColors.hacker, RoleColors.detective];

export function WaitingRoomScreen({ drop, offset, onBack }: { drop: DropView; offset: number | null; onBack?: () => void }) {
  const now = useServerClock(offset);
  const left = drop.startsAt - now;
  const unmatched = drop.me.unmatched;
  const creator = drop.creatorName.replace('@', '');
  const display = creator.charAt(0).toUpperCase() + creator.slice(1);
  const named = drop.entrants.filter((p) => !p.isMe).slice(0, 2).map((p) => p.name);
  const others = drop.entrantCount - named.length - (drop.me.entered ? 1 : 0);
  const hereLine = !named.length && others <= 0 ? 'You’re the first one here' : others > 0 ? `${named.length ? `${named.join(', ')} and ` : ''}${others} ${others === 1 ? 'other' : 'others'}` : named.join(' and ');
  return (
    <Screen
      footer={
        unmatched ? (
          <>
            <Banner tone="info" title="Nobody left to pair with." text="You were the only one in the room, so no squad formed. No bounty this time." />
            <Button title="Back to drops" variant="secondary" onPress={onBack} />
          </>
        ) : (
          <Txt variant="small" color={Palette.paperMuted} style={styles.center}>
            You’re in. Keep this screen open.
          </Txt>
        )
      }>
      <Enter from={8}>
        <View style={styles.creator}>
          <View style={styles.pfp}>
            <Txt variant="name">{display.charAt(0)}</Txt>
          </View>
          <View style={styles.flex}>
            <Txt variant="bodyStrong">{display}</Txt>
            <Txt variant="small" color={Palette.paperMuted}>
              is hosting
            </Txt>
          </View>
        </View>
        <Txt variant="display" style={styles.title}>
          {drop.title}
        </Txt>
      </Enter>

      {unmatched ? (
        <View style={styles.countBox}>
          <Label>Room opened</Label>
          <Txt style={styles.count}>1</Txt>
          <Txt variant="small" color={Palette.paperMuted}>
            joined
          </Txt>
        </View>
      ) : (
        <View style={styles.countBox}>
          {drop.hosted ? (
            <Txt variant="title" style={styles.center}>{`Waiting for ${display} to deal`}</Txt>
          ) : (
            <>
              <Label>{left <= 3000 ? 'Get your squad ready' : 'Room opens in'}</Label>
              <Txt style={styles.count}>{clock(left)}</Txt>
            </>
          )}
          <View style={styles.joined}>
            <View style={styles.stack}>
              {drop.entrants.slice(0, 4).map((p, i) => (
                <View key={p.name + i} style={[styles.avatar, { backgroundColor: avatarColors[i % 4] }]}>
                  <Txt variant="smallStrong" color={i % 4 === 0 ? Palette.onAccent : Palette.ink}>
                    {p.name.charAt(0)}
                  </Txt>
                </View>
              ))}
            </View>
            <Txt variant="small" color={Palette.paperMuted} numberOfLines={1} style={styles.flexShrink}>
              {hereLine}
            </Txt>
          </View>
        </View>
      )}

      <Txt variant="bodyStrong" style={styles.center}>
        {`${display}’s about to put you with ${drop.squadSize === 2 ? 'one other' : 'two others'}.`}
      </Txt>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  flexShrink: { flexShrink: 1 },
  center: { textAlign: 'center' },
  creator: { flexDirection: 'row', alignItems: 'center', gap: Space.m },
  pfp: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: Palette.hairline,
    backgroundColor: Palette.panelRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { marginTop: Space.l },
  countBox: { alignItems: 'center', gap: 4, marginTop: Space.s },
  count: { fontFamily: FontFamily.uiMedium, fontSize: 76, lineHeight: 84, letterSpacing: -2, color: Palette.paper, fontVariant: ['tabular-nums'] },
  joined: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stack: { flexDirection: 'row', marginLeft: 8 },
  avatar: { width: 28, height: 28, borderRadius: 14, marginLeft: -8, borderWidth: 2, borderColor: Palette.ink, alignItems: 'center', justifyContent: 'center' },
  card: { borderRadius: 16, backgroundColor: Palette.panel, borderWidth: StyleSheet.hairlineWidth, borderColor: Palette.hairline },
  stats: { flexDirection: 'row', paddingVertical: 14 },
  stat: { flex: 1, alignItems: 'center' },
  how: { padding: Space.l, gap: 10 },
  rule: { flexDirection: 'row', gap: Space.m },
  ruleN: { width: 12, lineHeight: 25 },
});
