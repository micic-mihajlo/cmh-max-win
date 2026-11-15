import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Share, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { AgreementScreen } from '@/components/screens/agreement';
import { ClosedScreen } from '@/components/screens/closed';
import { DossierScreen, type DossierUi } from '@/components/screens/dossier';
import { IntroScreen } from '@/components/screens/intro';
import { LobbyScreen } from '@/components/screens/lobby';
import { OutcomeStage } from '@/components/screens/outcome-stage';
import { RevealScreen, type RevealPage } from '@/components/screens/reveal';
import { Atmosphere } from '@/components/signal/backdrop';
import { lockedIds } from '@/components/signal/room';
import type { SheetNotice } from '@/components/signal/theory-sheet';
import { useToast } from '@/components/signal/use-toast';
import { suspectById } from '@/constants/case01';
import { Palette } from '@/constants/signal';
import { Ease } from '@/motion';
import {
  useClaimRole,
  useConnection,
  useLeaveRoom,
  useLockIn,
  useMyEvidence,
  useRestart,
  useReveal,
  useRoom,
  useSetPresence,
  useSetTheory,
  useStartCase,
} from '@/hooks/use-signal';
import type { RoomView, SuspectId } from '@/lib/contract';
import { toSignalError } from '@/lib/signal-error';

type Menu = 'menu' | 'lobby' | 'confirm-restart' | 'confirm-leave' | null;

export default function RoomRoute() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const room = useRoom(code);
  if (room === undefined) return <Loading />;
  if (room === null || !room.me) return <ClosedScreen code={code} onNewCase={() => router.replace('/')} />;
  return <LiveRoom room={room} />;
}

function Loading() {
  return (
    <View style={styles.loading}>
      <Atmosphere />
      <ActivityIndicator color={Palette.paper} />
    </View>
  );
}

function LiveRoom({ room }: { room: RoomView }) {
  const code = room.code;
  const { toast, show } = useToast();
  const [menu, setMenu] = useState<Menu>(null);
  const connection = useConnection();
  const claimRole = useClaimRole(code);
  const startCase = useStartCase(code);
  const setPresence = useSetPresence(code);
  const restart = useRestart(code);
  const leave = useLeaveRoom(code);

  const fail = (e: unknown) => {
    const err = toSignalError(e)?.code;
    if (err === 'ROLE_TAKEN') return show({ text: 'Someone just took that role. Pick another.', tone: 'warn' });
    if (err === 'ROLES_NOT_FILLED') return show({ text: 'Someone left their role. Wait for all three.', tone: 'warn' });
    if (err === 'WRONG_STATUS') return show({ text: 'That moment passed. Here’s where things are.' });
    show({ text: 'That didn’t go through. Try again.', tone: 'warn' });
  };

  const prevStatus = useRef(room.status);
  useEffect(() => {
    const before = prevStatus.current;
    prevStatus.current = room.status;
    if (room.status === 'lobby' && before !== 'lobby' && !room.isHost) {
      const hostName = room.members.find((m) => m.isHost)?.name ?? 'The host';
      show({ text: `${hostName} restarted the case.` });
    }
  }, [room.status, room.isHost, room.members, show]);

  const menuActions = {
    onClose: () => setMenu(null),
    onShare: () => Share.share({ message: `Join my SIGNAL case. Open SIGNAL, tap Join with code, and enter ${code}.` }),
    onRestart: () => setMenu('confirm-restart'),
    onConfirmRestart: () => {
      setMenu(null);
      restart({ confirm: true }).catch(fail);
    },
    onLeave: () => setMenu('confirm-leave'),
    onConfirmLeave: () => {
      setMenu(null);
      leave()
        .then(() => router.replace('/'))
        .catch(fail);
    },
  };

  if (room.status === 'lobby') {
    return (
      <LobbyScreen
        room={room}
        toast={toast ?? undefined}
        menu={menu === 'lobby' ? true : menu === 'confirm-leave' ? 'confirm-leave' : undefined}
        on={{
          onClaim: (role) => claimRole(role).catch(fail),
          onStart: () => startCase().catch(fail),
          onShare: menuActions.onShare,
          onMenu: () => setMenu('lobby'),
          menu: menuActions,
        }}
      />
    );
  }

  if (room.status === 'intro') {
    const allReady = room.members.length === room.squadSize && room.members.every((m) => m.presence === 'ready');
    return <IntroScreen room={room} opening={allReady} onReady={() => setPresence('ready').catch(fail)} />;
  }

  const banner =
    connection.everConnected && !connection.connected
      ? ({ tone: 'warn', title: 'Reconnecting…', text: 'Your place is saved.', busy: true } as const)
      : undefined;

  return (
    <OutcomeStage room={room}>
      {room.status === 'resolved' ? (
        <Resolved room={room} />
      ) : (
        <Playing room={room} toast={toast} show={show} fail={fail} banner={banner} menu={menu} setMenu={setMenu} menuActions={menuActions} />
      )}
    </OutcomeStage>
  );
}

function Playing({
  room,
  toast,
  show,
  fail,
  banner,
  menu,
  setMenu,
  menuActions,
}: {
  room: RoomView;
  toast: ReturnType<typeof useToast>['toast'];
  show: ReturnType<typeof useToast>['show'];
  fail: (e: unknown) => void;
  banner: DossierUi['banner'];
  menu: Menu;
  setMenu: (m: Menu) => void;
  menuActions: NonNullable<Parameters<typeof DossierScreen>[0]['on']>['menu'];
}) {
  const code = room.code;
  const evidence = useMyEvidence(code);
  const setTheory = useSetTheory(code);
  const lockIn = useLockIn(code);
  const [tab, setTab] = useState<'evidence' | 'suspects'>('evidence');
  const [expanded, setExpanded] = useState(false);
  const [notice, setNotice] = useState<SheetNotice | undefined>(undefined);
  const [pendingPick, setPendingPick] = useState<SuspectId | undefined>(undefined);
  const [checking, setChecking] = useState(false);
  const [seenNudge, setSeenNudge] = useState<number | null>(null);

  const prev = useRef(room);
  useEffect(() => {
    const before = prev.current;
    prev.current = room;
    if (room.theory.revision > before.theory.revision && room.theory.lastEditedBy && room.theory.lastEditedBy.memberId !== room.me?.memberId) {
      const who = room.theory.lastEditedBy.name;
      const pick = room.theory.culprit ? suspectById(room.theory.culprit).first : 'nobody';
      const cleared = lockedIds(before).size > 0;
      show({ text: `${who} changed it to ${pick}${cleared ? ' · lock-ins cleared' : ''}` });
      setNotice(undefined);
    }
    for (const m of room.members) {
      const was = before.members.find((b) => b.memberId === m.memberId);
      if (!m.isMe && was?.presence === 'offline' && m.presence !== 'offline') show({ text: `${m.name} is back.`, tone: 'good' });
    }
  }, [room, show]);

  const away = room.members.find((m) => !m.isMe && m.presence === 'offline');
  const nudge = room.lastNudge;
  const showWrong = !!nudge && room.checkedRevision === room.theory.revision && seenNudge !== nudge.revision;

  if (checking) return <AgreementScreen room={room} phase="checking" />;
  if (showWrong) return <AgreementScreen room={room} phase="wrong" onBack={() => setSeenNudge(nudge.revision)} />;

  const pick = async (id: SuspectId) => {
    if (id === room.theory.culprit) return;
    setPendingPick(id);
    setNotice(undefined);
    try {
      await setTheory(id);
    } catch (e) {
      fail(e);
    } finally {
      setPendingPick(undefined);
    }
  };

  const lock = async () => {
    const third = lockedIds(room).size === 2;
    if (third) setChecking(true);
    try {
      await lockIn(room.theory.revision);
      setNotice(undefined);
    } catch (e) {
      const err = toSignalError(e)?.code;
      if (err === 'STALE_REVISION') setNotice({ tone: 'warn', title: 'The theory changed as you tapped.', text: 'Check it, then lock in again.' });
      else if (err === 'COOLDOWN') setNotice({ tone: 'warn', title: 'Not yet.', text: 'Lock-in reopens a few seconds after a wrong check.' });
      else if (err === 'ALREADY_CHECKED') setNotice({ tone: 'warn', title: 'Already checked.', text: 'Change the theory to try again.' });
      else fail(e);
    } finally {
      setChecking(false);
    }
  };

  const myRole = room.me?.role;
  const highlight = nudge && myRole === nudge.forRole ? 0 : undefined;

  return (
    <DossierScreen
      room={room}
      pieces={evidence ?? undefined}
      ui={{
        tab,
        sheet: { expanded, notice, pendingPick },
        banner: banner ?? (away ? { tone: 'info', title: `${away.name} stepped away.`, text: 'The case waits for all three.' } : undefined),
        toast: toast ?? undefined,
        menu: menu === 'menu' || menu === 'confirm-restart' || menu === 'confirm-leave' ? menu : undefined,
        highlight,
      }}
      on={{
        onTab: setTab,
        onToggleSheet: () => setExpanded((x) => !x),
        onPick: pick,
        onLockIn: lock,
        onMenu: () => setMenu('menu'),
        menu: { ...menuActions, onSuspects: () => (setMenu(null), setTab('suspects')) },
      }}
    />
  );
}

function Resolved({ room }: { room: RoomView }) {
  const reveal = useReveal(room.code);
  const [page, setPage] = useState<RevealPage>('reconstruction');
  const [choice, setChoice] = useState<'report' | 'informant' | undefined>(undefined);
  const { reveal: showReveal } = useLocalSearchParams<{ reveal?: string }>();
  if (!reveal) return <AgreementScreen room={room} phase="checking" />;
  if (room.drop && !showReveal) return <DropHandoff room={room} dropId={room.drop.dropId} />;
  const crew = room.members.map((m) => m.name);
  return (
    <RevealScreen
      room={room}
      reveal={reveal}
      page={page}
      choice={choice}
      on={{
        onPage: setPage,
        onChoice: setChoice,
        onSeason: () => router.push({ pathname: '/shelf', params: { attempts: String(room.attempts), crew: crew.join(',') } }),
        onNewCase: () => router.replace('/'),
      }}
    />
  );
}

const HANDOFF_HOLD_MS = 900;
const HANDOFF_FADE_MS = 240;

// A solved drop squad holds on "All three agree" before fading to the race board, so the last lock-in still lands.
function DropHandoff({ room, dropId }: { room: RoomView; dropId: string }) {
  const opacity = useSharedValue(1);
  useEffect(() => {
    const fade = setTimeout(() => opacity.set(withTiming(0, { duration: HANDOFF_FADE_MS, easing: Ease.out })), HANDOFF_HOLD_MS);
    const go = setTimeout(() => router.replace({ pathname: '/drop/[id]/race', params: { id: dropId } }), HANDOFF_HOLD_MS + HANDOFF_FADE_MS);
    return () => {
      clearTimeout(fade);
      clearTimeout(go);
    };
  }, [dropId, opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  return (
    <Animated.View style={[styles.flex, style]}>
      <AgreementScreen room={room} phase="checking" />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  loading: { flex: 1, backgroundColor: Palette.ink, alignItems: 'center', justifyContent: 'center' },
});

