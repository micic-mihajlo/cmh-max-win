import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/signal/backdrop';
import { Button, Label, NextStep } from '@/components/signal/primitives';
import { Seal } from '@/components/signal/seal';
import { Txt } from '@/components/signal/txt';
import { Palette, Radius, RoleColors, Space } from '@/constants/signal';
import { Enter, Stagger } from '@/motion';

import type { DropView, SquadMemberView } from './contract';
import { names, PieceLabel, Tagline } from './ui';

export function SquadRevealScreen({ drop, members }: { drop: DropView; members: SquadMemberView[] }) {
  const squad = drop.me.squad;
  const others = members.filter((m) => !m.isMe).map((m) => m.name);
  return (
    <Screen
      footer={
        <>
          <NextStep>Everyone locks in the same name. Then the server checks.</NextStep>
          <Button title="Open the case" />
        </>
      }>
      <View style={styles.head}>
        <Label color={Palette.ember}>{drop.title} · squads formed</Label>
        <Enter>
          <Txt variant="hero">{squad?.label ?? 'Your squad'}</Txt>
        </Enter>
        <Txt variant="title">{`You’re in ${squad?.label ?? 'a squad'} with ${names(others)}.`}</Txt>
      </View>
      <View style={styles.seals}>{members.map((m) => (m.role ? <Seal key={m.memberId} role={m.role} filled size={56} /> : null))}</View>
      <View style={styles.list}>
        <Stagger>
          {members.map((m) => (
            <View key={m.memberId} style={[styles.member, m.isMe && styles.memberMe]}>
              <View style={styles.memberHead}>
                <Txt variant="name">{m.isMe ? `${m.name} (you)` : m.name}</Txt>
                <Txt variant="smallStrong" color={Palette.paperMuted}>
                  {m.roles.length} {m.roles.length === 1 ? 'piece' : 'pieces'}
                </Txt>
              </View>
              <View style={styles.pieces}>
                {m.roles.map((r) => (
                  <View key={r} style={[styles.piece, { borderColor: RoleColors[r] }]}>
                    <Txt variant="small" color={RoleColors[r]}>
                      {m.isMe ? PieceLabel[r] : 'Sealed'}
                    </Txt>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </Stagger>
      </View>
      <Txt variant="small" color={Palette.paperMuted}>
        {`3 pieces between ${members.length} phones. Only the holder can see a piece, so read yours out.`}
      </Txt>
      <Txt variant="quote" color={Palette.paperMuted}>
        {Tagline}
      </Txt>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { gap: Space.s, marginTop: Space.s },
  seals: { flexDirection: 'row', gap: Space.m },
  list: { gap: Space.s },
  member: {
    gap: Space.s,
    padding: Space.l,
    borderRadius: Radius.m,
    backgroundColor: Palette.panel,
    borderWidth: 1,
    borderColor: Palette.hairline,
  },
  memberMe: { borderColor: Palette.ember },
  memberHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pieces: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  piece: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
});
