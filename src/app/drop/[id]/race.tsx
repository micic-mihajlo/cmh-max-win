import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { LeaderboardScreen } from '@/components/drops/leaderboard';
import { Atmosphere } from '@/components/signal/backdrop';
import { suspectById } from '@/constants/case01';
import { Palette } from '@/constants/signal';
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
    return (
      <View style={styles.loading}>
        <Atmosphere />
        <ActivityIndicator color={Palette.paper} />
      </View>
    );
  }
  const solving = room && room.status !== 'resolved';
  return (
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
            }
          : undefined
      }
      roles={room?.members.flatMap((m) => m.roles)}
      on={{
        onCase: () => code && router.push({ pathname: '/room/[code]', params: { code } }),
        onShare: () => router.push({ pathname: '/drop/[id]/win', params: { id } }),
        onReveal: () => code && router.push({ pathname: '/room/[code]', params: { code, reveal: '1' } }),
      }}
    />
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Palette.ink },
});
