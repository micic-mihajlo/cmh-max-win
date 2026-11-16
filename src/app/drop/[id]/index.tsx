import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { DropEntryScreen } from '@/components/drops/drop-entry';
import { PassphraseScreen } from '@/components/drops/passphrase';
import { SquadRevealScreen } from '@/components/drops/squad-reveal';
import { WaitingRoomScreen } from '@/components/drops/waiting-room';
import { ClosedScreen } from '@/components/screens/closed';
import { NameEntryScreen } from '@/components/screens/name-entry';
import { Atmosphere } from '@/components/signal/backdrop';
import { Palette } from '@/constants/signal';
import { useDrop, useEnterDrop, useServerOffset } from '@/hooks/use-drops';
import { useConfirmPassphrase, usePassphrase, useSubmitPassphrase } from '@/hooks/use-passphrase';
import { usePlayerName } from '@/hooks/use-player-name';
import { useMyEvidence, useRoom, useSetPresence } from '@/hooks/use-signal';
import type { DropView } from '@/lib/contract';
import { toSignalError } from '@/lib/signal-error';

export default function DropRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const drop = useDrop(id);
  const offset = useServerOffset();
  const { name, save } = usePlayerName();
  const [draft, setDraft] = useState('');
  const enter = useEnterDrop(id);
  const [joining, setJoining] = useState(false);
  const [closed, setClosed] = useState(false);

  if (drop === undefined || name === undefined) return <Loading />;
  if (drop === null) return <ClosedScreen code={id} onNewCase={() => router.replace('/')} />;
  if (drop.me.squad) {
    const Play = drop.template === 'split-passphrase' ? PassphraseSquad : Squad;
    return <Play drop={drop} code={drop.me.squad.code} />;
  }
  if (drop.me.entered) return <WaitingRoomScreen drop={drop} offset={offset} onBack={() => router.replace('/')} />;
  if (name === null) return <NameEntryScreen name={draft} onChangeName={setDraft} onContinue={() => save(draft.trim())} />;

  const join = async () => {
    setJoining(true);
    try {
      await enter({ name });
    } catch (e) {
      if (toSignalError(e)?.code === 'DROP_CLOSED') setClosed(true);
    } finally {
      setJoining(false);
    }
  };
  return (
    <DropEntryScreen
      drop={drop}
      offset={offset}
      joining={joining}
      error={closed || drop.status !== 'scheduled' ? 'DROP_CLOSED' : undefined}
      on={{ onJoin: join, onWatch: () => router.push({ pathname: '/drop/[id]/race', params: { id } }) }}
    />
  );
}

function PassphraseSquad({ drop, code }: { drop: DropView; code: string }) {
  const piece = usePassphrase(code);
  const offset = useServerOffset();
  const submit = useSubmitPassphrase(code);
  const confirm = useConfirmPassphrase(code);
  const [busy, setBusy] = useState(false);
  const [opened, setOpened] = useState(false);
  if (piece === undefined) return <Loading />;
  if (piece === null || piece.squad.status === 'solved') return <Redirect href={{ pathname: '/drop/[id]/race', params: { id: drop.dropId } }} />;
  if (!opened) {
    const members = piece.teammates.map((t) => ({ memberId: t.name + t.position, name: t.name, role: null, roles: [], isMe: t.isMe }));
    return <SquadRevealScreen drop={drop} members={members} pieces={undefined} cta="See your word" onOpen={() => setOpened(true)} />;
  }
  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await action();
    } catch {
    } finally {
      setBusy(false);
    }
  };
  return (
    <PassphraseScreen
      piece={piece}
      offset={offset ?? 0}
      busy={busy}
      onPropose={(answer) => run(() => submit(answer))}
      onConfirm={(revision) => run(() => confirm(revision))}
    />
  );
}

function Squad({ drop, code }: { drop: DropView; code: string }) {
  const room = useRoom(code);
  const pieces = useMyEvidence(code);
  const setPresence = useSetPresence(code);
  if (room === undefined) return <Loading />;
  if (room === null) return <Redirect href={{ pathname: '/drop/[id]/race', params: { id: drop.dropId } }} />;
  return (
    <SquadRevealScreen
      drop={drop}
      members={room.members}
      pieces={pieces ?? undefined}
      onOpen={() => {
        setPresence('ready').catch(() => {});
        router.replace({ pathname: '/room/[code]', params: { code } });
      }}
    />
  );
}

function Loading() {
  return (
    <View style={styles.loading}>
      <Atmosphere />
      <ActivityIndicator color={Palette.paper} />
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Palette.ink },
});
