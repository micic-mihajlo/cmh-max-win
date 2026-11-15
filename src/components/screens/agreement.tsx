import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/signal/backdrop';
import { Banner, Button, Label } from '@/components/signal/primitives';
import { seals } from '@/components/signal/room';
import { Seal } from '@/components/signal/seal';
import { Txt } from '@/components/signal/txt';
import { suspectById } from '@/constants/case01';
import { Palette, Radius, RoleMeta, Space } from '@/constants/signal';
import type { RoomView } from '@/lib/contract';

// 'checking' is the shared seal beat every phone plays when a check lands (and the third phone's pending lock-in).
export function AgreementScreen({ room, phase }: { room: RoomView; phase: 'checking' | 'wrong' }) {
  const nudge = room.lastNudge;
  const pick = (phase === 'wrong' || room.lastCheck?.result === 'wrong') && nudge ? nudge.wrongPick : room.theory.culprit;
  const guessed = pick ? suspectById(pick) : null;
  const nudged = nudge ? room.members.find((m) => m.role === nudge.forRole) : null;
  const forMe = !!nudge && room.me?.role === nudge.forRole;
  return (
    <Screen
      scroll={phase === 'wrong'}
      contentStyle={phase === 'checking' ? styles.centerContent : undefined}
      footer={phase === 'wrong' ? <Button title="Back to the evidence" /> : null}>
      {phase === 'checking' ? (
        <>
          <Label color={Palette.paper}>{`Shared theory · v${nudge?.revision ?? room.theory.revision}`}</Label>
          <View style={styles.sealsBig}>
            {seals(room).map(({ role, member }, i) => (
              <View key={role} style={styles.sealCol}>
                <Seal role={role} filled size={84} delay={i * 260} />
                <Txt variant="smallStrong" color={RoleMeta[role].color}>
                  {member?.isMe ? 'You' : member?.name}
                </Txt>
                <Txt variant="label" color={Palette.paperMuted}>
                  {RoleMeta[role].label}
                </Txt>
              </View>
            ))}
          </View>
          <Txt variant="display" style={styles.center}>
            {room.members.length} of {room.members.length} agree.
          </Txt>
          {guessed ? (
            <Txt variant="serif" color={Palette.paperMuted} style={styles.center}>
              {guessed.name} took the Aurora Seed.
            </Txt>
          ) : null}
          <View style={styles.checking}>
            <ActivityIndicator color={Palette.paper} />
            <Txt variant="bodyStrong">Checking…</Txt>
          </View>
        </>
      ) : nudge && guessed ? (
        <>
          <View style={styles.wrongHead}>
            <Label color={Palette.paperMuted}>{`Attempt ${room.attempts}`}</Label>
            <Txt variant="hero">Not {guessed.first}.</Txt>
          </View>
          <View style={styles.sealsRow}>
            {seals(room).map(({ role }) => (
              <Seal key={role} role={role} filled={false} broken size={40} />
            ))}
            <Txt variant="small" color={Palette.paperMuted} style={styles.flex}>
              Lock-ins cleared. Change the theory, then agree again.
            </Txt>
          </View>
          <View style={[styles.nudge, { borderLeftColor: RoleMeta[nudge.forRole].color }]}>
            <Txt variant="title">{nudge.text}</Txt>
            {nudged ? (
              <View style={[styles.chip, { borderColor: RoleMeta[nudge.forRole].color }]}>
                <View style={[styles.dot, { backgroundColor: RoleMeta[nudge.forRole].color }]} />
                <Txt variant="smallStrong">
                  {nudged.isMe ? 'You' : nudged.name} · {RoleMeta[nudge.forRole].label}
                </Txt>
              </View>
            ) : null}
          </View>
          {forMe ? <Banner tone="warn" title="This one’s yours." text="Read your evidence out loud." /> : null}
          <Txt variant="small" color={Palette.paperMuted}>
            The answer stays sealed. Nothing here says who did it.
          </Txt>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  centerContent: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', gap: Space.xl },
  sealsBig: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: Space.l, marginVertical: Space.l },
  sealCol: { alignItems: 'center', gap: 4 },
  checking: { flexDirection: 'row', alignItems: 'center', gap: Space.s, marginTop: Space.s },
  wrongHead: { gap: Space.s, marginTop: Space.xl },
  sealsRow: { flexDirection: 'row', alignItems: 'center', gap: Space.s },
  nudge: { borderLeftWidth: 4, backgroundColor: Palette.panel, borderRadius: Radius.m, padding: Space.l, gap: Space.m },
  chip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
