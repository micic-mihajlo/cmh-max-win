import { useKeepAwake } from 'expo-keep-awake';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { HostScreen } from '@/components/drops/host';
import { ClosedScreen } from '@/components/screens/closed';
import { Toast } from '@/components/signal/primitives';
import { Palette } from '@/constants/signal';
import { useDealSquads, useHostView } from '@/hooks/use-drops';
import { usePlayerName } from '@/hooks/use-player-name';
import { toSignalError } from '@/lib/signal-error';

export default function HostRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  useKeepAwake();
  const view = useHostView(id);
  const { name } = usePlayerName();
  const deal = useDealSquads(id);
  const [dealing, setDealing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (view === undefined) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={Palette.paper} />
      </View>
    );
  }
  if (view === null) return <ClosedScreen code={id} />;
  return (
    <View style={styles.flex}>
      <HostScreen
        view={view}
        hostName={name ?? 'Host'}
        dealing={dealing}
        onDeal={async () => {
          setDealing(true);
          setError(null);
          try {
            await deal();
          } catch (e) {
            setError(toSignalError(e)?.code === 'NOT_ENOUGH_PLAYERS' ? 'Wait for 4 players.' : 'That didn’t go through. Try again.');
          } finally {
            setDealing(false);
          }
        }}
      />
      {error ? <Toast text={error} tone="warn" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Palette.ink },
});
