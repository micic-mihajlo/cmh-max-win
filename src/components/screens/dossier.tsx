import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { CaseMenu, type MenuActions, type MenuMode } from '@/components/screens/case-menu';
import { Screen } from '@/components/signal/backdrop';
import { ClueCard, ClueCardSkeleton } from '@/components/signal/clue-card';
import { Avatar, Banner, IconButton, PresenceLine, Toast, TopBar } from '@/components/signal/primitives';
import { SuspectList } from '@/components/signal/suspect-card';
import { TheorySheet, type SheetNotice } from '@/components/signal/theory-sheet';
import { Txt } from '@/components/signal/txt';
import { Suspects } from '@/constants/case01';
import { Palette, Space } from '@/constants/signal';
import type { DossierView, MemberView, Role, RoomView, SuspectId } from '@/lib/contract';

function useNewestPresence(members: MemberView[], skipOffline: boolean) {
  const [newestId, setNewestId] = useState<string | null>(null);
  const before = useRef(members);
  useEffect(() => {
    const changed = members.find((m) => !m.isMe && before.current.find((b) => b.memberId === m.memberId)?.presence !== m.presence);
    before.current = members;
    if (changed) setNewestId(changed.memberId);
  }, [members]);
  const others = members.filter((m) => !m.isMe && !(skipOffline && m.presence === 'offline'));
  return others.find((m) => m.memberId === newestId) ?? others[0] ?? null;
}

export type DossierUi = {
  tab?: 'evidence' | 'suspects';
  sheet?: { expanded?: boolean; notice?: SheetNotice; fullHeight?: boolean; pendingPick?: SuspectId };
  banner?: { tone: 'info' | 'warn' | 'good'; title: string; text?: string; busy?: boolean };
  toast?: { text: string; tone?: 'info' | 'warn' | 'good' };
  menu?: MenuMode;
  highlight?: number;
};

export type DossierActions = {
  onTab?: (tab: 'evidence' | 'suspects') => void;
  onToggleSheet?: () => void;
  onPick?: (id: SuspectId) => void;
  onLockIn?: () => void;
  onMenu?: () => void;
  menu?: MenuActions;
};

export function DossierScreen({
  room,
  pieces,
  ui = {},
  on = {},
}: {
  room: RoomView;
  pieces: DossierView[] | undefined;
  ui?: DossierUi;
  on?: DossierActions;
}) {
  const role: Role = room.me?.role ?? 'detective';
  const roles = pieces?.length ? pieces.map((p) => p.role) : [role];
  const presence = useNewestPresence(room.members, !!ui.banner);
  const nudgeForMe = room.lastNudge?.holder ? room.lastNudge.holder.memberId === room.me?.memberId : !!room.lastNudge && roles.includes(room.lastNudge.forRole);
  return (
    <Screen
      header={
        <TopBar
          left={
            <Txt variant="small" color={Palette.paperMuted}>
              {room.me ? `Your piece, ${room.me.name}` : room.drop ? room.drop.squadLabel : `Room ${room.code}`}
            </Txt>
          }
          right={
            <View style={styles.actions}>
              <View style={styles.avatars}>
                {room.members.map((m, i) => (
                  <View key={m.memberId} style={i > 0 ? styles.overlap : undefined}>
                    <Avatar name={m.name} size={32} filled={m.isMe} />
                  </View>
                ))}
              </View>
              <IconButton name="ellipsis" label="Case menu" onPress={on.onMenu} />
            </View>
          }
        />
      }
      contentStyle={styles.content}
      overlay={
        <>
          <TheorySheet
            room={room}
            expanded={ui.sheet?.expanded ?? false}
            notice={ui.sheet?.notice}
            fullHeight={ui.sheet?.fullHeight}
            pendingPick={ui.sheet?.pendingPick}
            onToggle={on.onToggleSheet}
            onPick={on.onPick}
            onLockIn={on.onLockIn}
          />
          {ui.menu ? <CaseMenu room={room} mode={ui.menu} actions={on.menu} /> : null}
          {ui.toast ? <Toast text={ui.toast.text} tone={ui.toast.tone} /> : null}
        </>
      }>
      {ui.banner ? <Banner {...ui.banner} /> : null}
      <PresenceLine person={presence} />
      <Txt variant="bodyStrong">Every piece is true and puts one suspect somewhere else. Whoever’s left is the thief.</Txt>
      {nudgeForMe ? <Banner tone="warn" title="This one’s yours." text="Read your piece out loud." /> : null}
      {pieces ? pieces.map((p) => <ClueCard key={p.role} dossier={p} highlight={p.role === room.lastNudge?.forRole ? ui.highlight : undefined} />) : <ClueCardSkeleton role={role} />}
      <SuspectList suspects={Suspects} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 200 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: Space.s },
  avatars: { flexDirection: 'row' },
  overlap: { marginLeft: -8 },
});
