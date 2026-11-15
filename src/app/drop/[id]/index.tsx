import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { DropEntryScreen } from '@/components/drops/drop-entry';
import { SquadRevealScreen } from '@/components/drops/squad-reveal';
import { WaitingRoomScreen } from '@/components/drops/waiting-room';
import { ClosedScreen } from '@/components/screens/closed';
import { NameEntryScreen } from '@/components/screens/name-entry';
import { Atmosphere } from '@/components/signal/backdrop';
import { Palette } from '@/constants/signal';
import { useDrop, useEnterDrop, useServerOffset } from '@/hooks/use-drops';
import { usePlayerName } from '@/hooks/use-player-name';
import { useMyEvidence, useRoom } from '@/hooks/use-signal';
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
  if (drop.me.squad) return <Squad drop={drop} code={drop.me.squad.code} />;
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

function Squad({ drop, code }: { drop: DropView; code: string }) {
  const room = useRoom(code);
  const pieces = useMyEvidence(code);
  if (room === undefined) return <Loading />;
  if (room === null) return <Redirect href={{ pathname: '/drop/[id]/race', params: { id: drop.dropId } }} />;
  return (
    <SquadRevealScreen
      drop={drop}
      members={room.members}
      pieces={pieces ?? undefined}
      onOpen={() => router.replace({ pathname: '/room/[code]', params: { code } })}
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
