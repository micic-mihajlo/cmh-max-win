import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { Platform } from 'react-native';

import { CoverScreen, type JoinState } from '@/components/screens/cover';
import { NameEntryScreen } from '@/components/screens/name-entry';
import { WebHomeScreen } from '@/components/screens/web-home';
import { usePlayerName } from '@/hooks/use-player-name';
import { useActiveRoom, useCreateRoom, useJoinRoom, useReclaimRole } from '@/hooks/use-signal';
import { toSignalError } from '@/lib/signal-error';
import { gallery } from '@/mocks/load';

import { isAppClip } from '../../modules/app-clip';

export default function Index() {
  if (gallery) return <Redirect href="/mocks" />;
  if (isAppClip) return <Redirect href="/clip" />;
  if (Platform.OS === 'web') return <WebHomeScreen />;
  return <Cover />;
}

function Cover() {
  const { name, save } = usePlayerName();
  const [draft, setDraft] = useState('');
  const [pendingAction, setPendingAction] = useState<'create' | 'join' | null>(null);
  const active = useActiveRoom();
  const createRoom = useCreateRoom();
  const joinRoom = useJoinRoom();
  const [join, setJoin] = useState<JoinState | null>(null);
  const [creating, setCreating] = useState(false);
  const reclaim = useReclaimRole(join?.code ?? '');

  const go = (code: string) => router.push({ pathname: '/room/[code]', params: { code } });

  const start = async (who: string) => {
    setCreating(true);
    try {
      const { code } = await createRoom({ name: who });
      go(code);
    } finally {
      setCreating(false);
    }
  };

  const submitJoin = async (who: string, code: string) => {
    setJoin({ code, phase: 'joining' });
    try {
      const result = await joinRoom({ code, name: who });
      if (result.status === 'reclaim') {
        setJoin({ code, phase: 'reclaim', seats: result.reclaimableRoles.map((role) => ({ role })) });
        return;
      }
      setJoin(null);
      go(result.code);
    } catch (e) {
      setJoin({ code, phase: 'error', error: toSignalError(e)?.code ?? 'ROOM_NOT_FOUND' });
    }
  };

  if (name === undefined) return null;
  if (name === null || pendingAction) {
    return (
      <NameEntryScreen
        name={draft}
        onChangeName={setDraft}
        onContinue={async () => {
          const who = draft.trim();
          await save(who);
          const next = pendingAction;
          setPendingAction(null);
          if (next === 'create') start(who);
          if (next === 'join') setJoin({ code: '', phase: 'typing' });
        }}
      />
    );
  }

  return (
    <CoverScreen
      active={active}
      creating={creating}
      join={join ?? undefined}
      on={{
        onJoinDrop: () => router.push('/join'),
        onHostDrop: () => router.push('/host'),
        onStart: () => {
          setJoin(null);
          start(name);
        },
        onOpenJoin: () => setJoin({ code: '', phase: 'typing' }),
        onRejoin: () => active && go(active.code),
        onCodeChange: (code) => setJoin({ code, phase: 'typing' }),
        onJoin: () => join && join.code.length === 4 && submitJoin(name, join.code),
        onCloseJoin: () => setJoin(null),
        onTakeSeat: async (role) => {
          if (!join) return;
          try {
            await reclaim(role);
            const code = join.code;
            setJoin(null);
            go(code);
          } catch (e) {
            setJoin({ code: join.code, phase: 'error', error: toSignalError(e)?.code ?? 'CASE_STARTED' });
          }
        },
      }}
    />
  );
}
