import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/signal/backdrop';
import { Avatar, Button } from '@/components/signal/primitives';
import { seals } from '@/components/signal/room';
import { Seal } from '@/components/signal/seal';
import { useSecondsUntil } from '@/components/signal/theory-sheet';
import { Txt } from '@/components/signal/txt';
import { suspectById } from '@/constants/case01';
import { FontFamily, Palette, Radius, Space } from '@/constants/signal';
import type { RoomView } from '@/lib/contract';
import { NudgeEntrance } from '@/motion';

export function AgreementScreen({ room, phase, onBack }: { room: RoomView; phase: 'checking' | 'wrong'; onBack?: () => void }) {
  const nudge = room.lastNudge;
  const pick = (phase === 'wrong' || room.lastCheck?.result === 'wrong') && nudge ? nudge.wrongPick : room.theory.culprit;
  const guessed = pick ? suspectById(pick) : null;
  const nudged = nudge ? room.members.find((m) => (nudge.holder ? m.memberId === nudge.holder.memberId : m.roles.includes(nudge.forRole))) : null;
  const cooldown = useSecondsUntil(room.cooldownUntil, 0);
  const n = room.members.length;
  const agree = n === 2 ? 'Both agree.' : n === 3 ? 'All three agree.' : `All ${n} agree.`;
  const prefix = guessed ? `Not ${guessed.first}.` : '';
  const ask = nudge && nudge.text.startsWith(prefix) ? nudge.text.slice(prefix.length).trim() : '';
  return (
    <Screen
      scroll={phase === 'wrong'}
      contentStyle={phase === 'checking' ? styles.centerContent : styles.centerBlock}
      footer={
        phase === 'wrong' ? (
          cooldown > 0 ? (
            <Button title={`Try again in 0:${String(cooldown).padStart(2, '0')}`} disabled />
          ) : (
            <Button title="Back to the case" onPress={onBack} />
          )
        ) : null
      }>
      {phase === 'checking' ? (
        <>
          <View style={styles.sealsBig}>
            {seals(room).map(({ role, member }) => (
              <View key={member.memberId} style={styles.sealCol}>
                <Seal role={role} filled size={72} initial={member.name.charAt(0).toUpperCase()} />
                <Txt variant="small" color={Palette.paperMuted}>
                  {member.isMe ? 'You' : member.name}
                </Txt>
              </View>
            ))}
          </View>
          <Txt variant="display" style={styles.center}>
            {agree}
          </Txt>
          {guessed ? (
            <Txt variant="serif" color={Palette.paperMuted} style={[styles.center, styles.italic]}>
              {guessed.name}
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
            <Txt variant="hero">Not {guessed.first}.</Txt>
          </View>
          <NudgeEntrance style={styles.nudge}>
            {nudged ? <Avatar name={nudged.name} size={48} filled={nudged.isMe} /> : null}
            <Txt style={styles.ask}>{ask || nudge.text}</Txt>
          </NudgeEntrance>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  italic: { fontFamily: FontFamily.serifItalic },
  centerContent: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', gap: Space.xl },
  sealsBig: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: Space.l, marginVertical: Space.l },
  sealCol: { alignItems: 'center', gap: Space.s },
  checking: { flexDirection: 'row', alignItems: 'center', gap: Space.s, marginTop: Space.s },
  centerBlock: { flexGrow: 1, justifyContent: 'center' },
  wrongHead: { gap: Space.s },
  nudge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.l,
    backgroundColor: Palette.card,
    borderRadius: Radius.l,
    borderWidth: 1,
    borderColor: Palette.hairline,
    padding: Space.xl,
  },
  ask: { flex: 1, fontFamily: FontFamily.display, fontSize: 22, lineHeight: 28, color: Palette.paper },
});
