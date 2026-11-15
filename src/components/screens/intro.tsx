import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/signal/backdrop';
import { Button, Label, NextStep } from '@/components/signal/primitives';
import { joinNames, seated } from '@/components/signal/room';
import { Seal } from '@/components/signal/seal';
import { Txt } from '@/components/signal/txt';
import { Palette, Space } from '@/constants/signal';
import { Case01 } from '@/constants/case01';
import type { RoomView } from '@/mocks/contract';

export function IntroScreen({ room, opening }: { room: RoomView; opening?: boolean }) {
  const ready = room.members.filter((m) => m.presence === 'ready');
  const meReady = room.members.some((m) => m.isMe && m.presence === 'ready');
  const away = room.members.find((m) => !m.isMe && m.presence === 'offline');
  const waiting = room.members.filter((m) => !m.isMe && m.presence !== 'ready').map((m) => m.name);
  return (
    <Screen
      footer={
        <>
          <View style={styles.seals}>
            {seated(room).map(({ role, member }) => (
              <View key={role} style={styles.sealCol}>
                <Seal role={role} filled={member?.presence === 'ready'} size={40} broken={member?.presence === 'offline'} />
                <Txt variant="small" color={Palette.paperMuted}>
                  {member?.isMe ? 'You' : member?.name}
                </Txt>
              </View>
            ))}
          </View>
          {opening ? (
            <NextStep>Opening your file…</NextStep>
          ) : away ? (
            <NextStep>{`Waiting for ${away.name} to come back.`}</NextStep>
          ) : meReady ? (
            <NextStep>{`${ready.length} of 3 ready. Waiting for ${joinNames(waiting)}.`}</NextStep>
          ) : (
            <NextStep>Read the briefing. Tap when you’re done.</NextStep>
          )}
          <Button title={meReady ? 'Ready ✓' : 'I’ve read it'} variant={meReady ? 'secondary' : 'primary'} disabled={opening} />
        </>
      }>
      <View style={styles.head}>
        <Label color={Palette.paperMuted}>Case 01 · Shared briefing</Label>
        <Txt variant="display">{Case01.title}</Txt>
        <Txt variant="small" color={Palette.paperMuted}>
          Everyone sees this page. Read it out loud if you like.
        </Txt>
      </View>
      <View style={styles.rule} />
      {Case01.intro.map((p, i) => (
        <Txt key={i} variant="serif" style={i === 0 ? styles.lead : undefined}>
          {p}
        </Txt>
      ))}
      <View style={styles.question}>
        <Label>The question</Label>
        <Txt variant="title">{Case01.question}</Txt>
        <Txt variant="body" color={Palette.paperMuted}>
          {Case01.rule}
        </Txt>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { gap: Space.s, marginTop: Space.s },
  rule: { height: 1, backgroundColor: Palette.hairline, marginVertical: Space.xs },
  lead: { fontSize: 21, lineHeight: 31 },
  question: { gap: Space.s, borderLeftWidth: 2, borderLeftColor: Palette.paper, paddingLeft: Space.l, marginTop: Space.s },
  seals: { flexDirection: 'row', justifyContent: 'space-around' },
  sealCol: { alignItems: 'center', gap: 4, width: 80 },
});
