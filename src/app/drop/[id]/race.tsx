import { router, useLocalSearchParams, type ErrorBoundaryProps } from 'expo-router';

import { LeaderboardScreen } from '@/components/drops/leaderboard';
import { Arrive, Pending, Screen } from '@/components/signal/backdrop';
import { Button } from '@/components/signal/primitives';
import { lockedIds } from '@/components/signal/room';
import { Txt } from '@/components/signal/txt';
import { suspectById } from '@/constants/case01';
import { Palette } from '@/constants/signal';
import { useDrop, useLeaderboard, useServerOffset } from '@/hooks/use-drops';
import { useRoom } from '@/hooks/use-signal';

// A render error on the race used to leave a blank white page on web until a manual reload.
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <Screen footer={<Button title="Tap to reload" onPress={() => (process.env.EXPO_OS === 'web' ? window.location.reload() : retry())} />}>
      <Txt variant="title">The race didn’t load.</Txt>
      <Txt variant="small" color={Palette.paperMuted}>
        {error.message}
      </Txt>
    </Screen>
  );
}

export default function RaceRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const drop = useDrop(id);
  const board = useLeaderboard(id);
  const offset = useServerOffset();
  const code = drop?.me.squad?.code ?? null;
  const room = useRoom(code);
  if (!drop || !board) {
    return <Pending />;
  }
  const solving = !drop.template && room && room.status !== 'resolved';
  return (
    <Arrive>
      <LeaderboardScreen
        drop={drop}
        board={board}
        offset={offset}
        racing={
          solving
            ? {
                pick: room.theory.culprit ? suspectById(room.theory.culprit).name : null,
                locked: room.lockIns.length,
                size: room.squadSize,
                nudge: room.lastNudge?.text ?? null,
                cooldownUntil: room.cooldownUntil,
                agreed: room.members.filter((m) => !m.isMe && lockedIds(room).has(m.memberId)).map((m) => m.name),
                meLocked: !!room.me && lockedIds(room).has(room.me.memberId),
              }
            : undefined
        }
        roles={room?.members.map((m) => m.role ?? m.roles[0]).filter((r) => r !== undefined)}
        on={{
          onCase: () => code && (drop.template ? router.replace({ pathname: '/drop/[id]', params: { id } }) : router.push({ pathname: '/room/[code]', params: { code } })),
          onShare: () => router.push({ pathname: '/drop/[id]/win', params: { id } }),
          onReveal: () => code && router.push({ pathname: '/room/[code]', params: { code, reveal: '1' } }),
        }}
      />
    </Arrive>
  );
}
