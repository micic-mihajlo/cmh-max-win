import { Pressable, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/signal/backdrop';
import { CodeCells } from '@/components/signal/code-cells';
import { Icon } from '@/components/signal/icon';
import { CaseMenu, type MenuActions } from '@/components/screens/case-menu';
import { Button, IconButton, Label, NextStep, Toast, TopBar } from '@/components/signal/primitives';
import { host, seated } from '@/components/signal/room';
import { Txt } from '@/components/signal/txt';
import { Palette, Radius, RoleMeta, Space } from '@/constants/signal';
import type { MemberView, Role, RoomView } from '@/lib/contract';

const roleBlurb: Record<Role, string> = {
  detective: 'Station security’s notes from the scene.',
  hacker: 'The station’s door and badge records.',
  witness: 'A crew member’s account of the evening.',
};

function nextLine(room: RoomView) {
  const claimed = room.members.filter((m) => m.role).length;
  const theHost = host(room);
  const unpicked = room.members.filter((m) => !m.role && !m.isMe);
  const myRole = room.me?.role ?? null;
  if (room.members.length === 1 && !myRole) return `Send the code ${room.code} to two friends, then pick your role.`;
  if (!myRole) return claimed === 2 ? 'Pick the last role.' : 'Pick a role.';
  if (claimed < 3) {
    if (unpicked.length > 0 && room.members.length === 3) return `Waiting for ${unpicked[0].name} to pick a role.`;
    return claimed === 2 ? 'Waiting for one more.' : `Waiting for ${3 - claimed} more players.`;
  }
  if (!room.isHost && theHost?.presence === 'offline') return `Waiting for ${theHost.name} (host) to come back.`;
  if (room.isHost) return 'Everyone’s here.';
  return `Waiting for ${theHost?.name ?? 'the host'} to start.`;
}

export type LobbyActions = {
  onClaim?: (role: Role) => void;
  onStart?: () => void;
  onShare?: () => void;
  onMenu?: () => void;
  menu?: MenuActions;
};

export function LobbyScreen({
  room,
  toast,
  menu,
  on = {},
}: {
  room: RoomView;
  toast?: { text: string; tone?: 'info' | 'warn' | 'good' };
  menu?: boolean | 'confirm-leave';
  on?: LobbyActions;
}) {
  const claimed = room.members.filter((m) => m.role).length;
  const canStart = claimed === 3;
  return (
    <Screen
      header={<TopBar right={<IconButton name="ellipsis" label="Room menu" onPress={on.onMenu} />} />}
      overlay={
        <>
          {menu ? <CaseMenu room={room} mode={menu === true ? 'lobby' : menu} actions={on.menu} /> : null}
          {toast ? <Toast text={toast.text} tone={toast.tone} /> : null}
        </>
      }
      footer={
        <>
          <NextStep>{nextLine(room)}</NextStep>
          {room.isHost ? (
            <Button title={canStart ? 'Start case' : `Start · waiting for ${3 - claimed}`} disabled={!canStart} onPress={on.onStart} />
          ) : null}
        </>
      }>
      <View style={styles.head}>
        <Label color={Palette.paperMuted}>Case 01 · The Aurora Seed</Label>
        <Txt variant="display">{room.isHost ? 'Your room' : `${host(room)?.name ?? 'Host'}’s room`}</Txt>
      </View>
      <View style={styles.codeBlock}>
        <Label>Invite code</Label>
        <CodeCells value={room.code} size="m" />
        <Txt variant="small" color={Palette.paperMuted} style={styles.center}>
          Friends open SIGNAL and tap Join with code.
        </Txt>
        <Button title="Share invite" variant="secondary" icon={<Icon name="square.and.arrow.up" size={16} />} onPress={on.onShare} />
      </View>
      <View style={styles.rolesHead}>
        <Label>Roles</Label>
        <Txt variant="smallStrong" color={Palette.paperMuted} style={styles.tabular}>
          {claimed} of 3 claimed
        </Txt>
      </View>
      <View style={styles.roles}>
        {seated(room).map(({ role, member }) => (
          <RoleCard key={role} role={role} member={member} onPress={() => on.onClaim?.(role)} />
        ))}
      </View>
    </Screen>
  );
}

function RoleCard({ role, member, onPress }: { role: Role; member: MemberView | null; onPress?: () => void }) {
  const meta = RoleMeta[role];
  const offline = member?.presence === 'offline';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={member?.isMe ? undefined : onPress}
      accessibilityLabel={`${meta.label}. ${member ? `Claimed by ${member.isMe ? 'you' : member.name}` : 'Open'}`}
      style={[styles.card, member?.isMe && { borderColor: meta.color }, offline && styles.dim]}>
      <View style={[styles.edge, { backgroundColor: meta.color }]} />
      <View style={styles.cardBody}>
        <View style={styles.cardTop}>
          <Txt variant="name" color={meta.color}>
            {meta.label}
          </Txt>
          <Txt variant="label" color={Palette.paperMuted}>
            {meta.docLabel}
          </Txt>
        </View>
        <Txt variant="small" color={Palette.paperMuted}>
          {roleBlurb[role]}
        </Txt>
        <View style={styles.claim}>
          {member ? (
            <>
              <View style={[styles.avatar, { backgroundColor: offline ? 'transparent' : meta.color }, offline && styles.avatarOff]}>
                <Txt variant="smallStrong" color={offline ? Palette.paperMuted : Palette.ink}>
                  {member.name[0]}
                </Txt>
              </View>
              <Txt variant="bodyStrong">
                {member.isMe ? 'You' : member.name}
                {member.isHost ? <Txt variant="small" color={Palette.paperMuted}> · host</Txt> : null}
              </Txt>
              <Txt variant="smallStrong" color={offline ? Palette.paperMuted : Palette.ok} style={styles.right}>
                {offline ? 'away' : '✓'}
              </Txt>
            </>
          ) : (
            <>
              <View style={[styles.avatar, styles.avatarOpen]} />
              <Txt variant="bodyStrong" color={Palette.paperMuted}>
                Open
              </Txt>
              <Txt variant="smallStrong" color={Palette.paper} style={styles.right}>
                Tap to claim
              </Txt>
            </>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tabular: { fontVariant: ['tabular-nums'] },
  center: { textAlign: 'center' },
  head: { gap: Space.s, marginTop: Space.s },
  codeBlock: {
    gap: Space.m,
    padding: Space.l,
    borderRadius: Radius.l,
    backgroundColor: Palette.panel,
    borderWidth: 1,
    borderColor: Palette.hairline,
    alignItems: 'stretch',
  },
  rolesHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Space.s },
  roles: { gap: Space.m },
  card: {
    flexDirection: 'row',
    borderRadius: Radius.m,
    overflow: 'hidden',
    backgroundColor: Palette.panel,
    borderWidth: 1,
    borderColor: Palette.hairline,
  },
  dim: { opacity: 0.6 },
  edge: { width: 5 },
  cardBody: { flex: 1, padding: Space.l, gap: 6 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: Space.s },
  claim: { flexDirection: 'row', alignItems: 'center', gap: Space.s, marginTop: Space.xs },
  avatar: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  avatarOpen: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: Palette.paperFaint },
  avatarOff: { borderWidth: 1.5, borderColor: Palette.paperFaint },
  right: { marginLeft: 'auto' },
});
