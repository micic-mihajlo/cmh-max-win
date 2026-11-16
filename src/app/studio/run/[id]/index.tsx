import { useLocalSearchParams, type ErrorBoundaryProps } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';

import { HostConsole } from '@/components/challenge/host/console';
import { Screen } from '@/components/signal/backdrop';
import { Txt } from '@/components/signal/txt';
import { Palette, Space } from '@/constants/signal';
import { PressScale } from '@/motion';

// A render error, or a stale connection after the tab sat idle, used to leave the console blank. The game keeps
// running on the server, so this offers a quiet way back, and on web it tries again as soon as the tab is visible.
export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  const again = () => (process.env.EXPO_OS === 'web' ? window.location.reload() : retry());
  useEffect(() => {
    if (process.env.EXPO_OS !== 'web') return;
    const onShow = () => document.visibilityState === 'visible' && window.location.reload();
    document.addEventListener('visibilitychange', onShow);
    return () => document.removeEventListener('visibilitychange', onShow);
  }, []);
  return (
    <Screen scroll={false} contentStyle={styles.centered}>
      <Txt variant="bodyStrong">The console lost its place.</Txt>
      <Txt variant="small" color={Palette.paperMuted}>
        Your game is still running.
      </Txt>
      <PressScale accessibilityRole="button" haptic="tap" hitSlop={12} onPress={again} style={styles.retry}>
        <Txt variant="label">Try again</Txt>
      </PressScale>
    </Screen>
  );
}

export default function HostConsoleRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <HostConsole challengeId={id ?? null} />;
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Space.s },
  retry: { minHeight: 44, justifyContent: 'center', paddingHorizontal: Space.m },
});
