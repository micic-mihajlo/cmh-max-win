import { router, useLocalSearchParams } from 'expo-router';

import { LeaderboardScreen } from '@/components/drops/leaderboard';
import { Arrive, Pending } from '@/components/signal/backdrop';
import { lockedIds } from '@/components/signal/room';
import { suspectById } from '@/constants/case01';
import { useDrop, useLeaderboard, useServerOffset } from '@/hooks/use-drops';
import { useRoom } from '@/hooks/use-signal';

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
