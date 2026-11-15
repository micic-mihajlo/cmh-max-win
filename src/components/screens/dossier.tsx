import { StyleSheet, View } from 'react-native';

import { CaseMenu, type MenuActions, type MenuMode } from '@/components/screens/case-menu';
import { Screen } from '@/components/signal/backdrop';
import { ClueCard, ClueCardSkeleton } from '@/components/signal/clue-card';
import { Banner, IconButton, Label, NextStep, PresenceLine, Segmented, Toast, TopBar } from '@/components/signal/primitives';
import { SuspectCard } from '@/components/signal/suspect-card';
import { TheorySheet, type SheetNotice } from '@/components/signal/theory-sheet';
import { Txt } from '@/components/signal/txt';
import { Suspects } from '@/constants/case01';
import { Palette, RoleMeta, Space } from '@/constants/signal';
import type { DossierView, Role, RoomView, SuspectId } from '@/lib/contract';

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
  dossier,
  ui = {},
  on = {},
}: {
  room: RoomView;
  dossier: DossierView | undefined;
  ui?: DossierUi;
  on?: DossierActions;
}) {
  const role: Role = room.me?.role ?? 'detective';
  const meta = RoleMeta[role];
  const tab = ui.tab ?? 'evidence';
  const others = room.members.filter((m) => !m.isMe);
  const nudgeForMe = room.lastNudge?.forRole === role;
  return (
    <Screen
      header={
        <TopBar
          left={<Label>Case 01 · The Aurora Seed</Label>}
          right={
            <View style={styles.actions}>
              <IconButton name="speaker.slash" label="Sound off" />
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
      <View style={styles.head}>
        <Label color={meta.color}>{`Your evidence · ${meta.label}`}</Label>
        <Txt variant="display">{tab === 'evidence' ? meta.docLabel.charAt(0) + meta.docLabel.slice(1).toLowerCase() : 'Suspects'}</Txt>
      </View>
      <PresenceLine people={others.map((m) => ({ name: m.name, role: m.role, presence: m.presence }))} />
      <Segmented
        value={tab}
        onChange={on.onTab}
        options={[
          { value: 'evidence', label: 'Your evidence' },
          { value: 'suspects', label: 'Suspects' },
        ]}
      />
      {tab === 'evidence' ? (
        <>
          {nudgeForMe ? <Banner tone="warn" title="This one’s yours." text="Read your evidence out loud." /> : null}
          {dossier ? <ClueCard dossier={dossier} highlight={ui.highlight} /> : <ClueCardSkeleton role={role} />}
          <NextStep>Read your evidence out loud. Then pick a suspect together.</NextStep>
        </>
      ) : (
        <>
          <Txt variant="small" color={Palette.paperMuted}>
            Every phone shows the same directory. Claims cover 21:30–21:50.
          </Txt>
          {Suspects.map((s) => (
            <SuspectCard key={s.id} suspect={s} />
          ))}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 200 },
  actions: { flexDirection: 'row', gap: Space.s },
  head: { gap: Space.s },
});
