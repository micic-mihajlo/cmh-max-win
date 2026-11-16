import { Inter_400Regular, Inter_400Regular_Italic, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, useFonts } from '@expo-google-fonts/inter';
import { ConvexProvider } from 'convex/react';
import { ConvexQueryCacheProvider } from 'convex-helpers/react/cache/provider';
import { DefaultTheme, Stack, ThemeProvider, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { usePushTapRouting } from '@/components/showcase/social/push';
import { Palette } from '@/constants/signal';
import { convex } from '@/lib/convex';
import { useReduced } from '@/motion';

SplashScreen.preventAutoHideAsync();
SystemUI.setBackgroundColorAsync(Palette.ink).catch(() => {});

const theme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: Palette.ink, card: Palette.ink, text: Palette.paper, primary: Palette.ember },
};

export default function RootLayout() {
  const [ready] = useFonts({ Inter_400Regular, Inter_400Regular_Italic, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);
  usePushTapRouting(ready);
  const reduced = useReduced();
  const projected = /^\/drop\/[^/]+\/host$|^\/mocks\/2\d-host/.test(usePathname());

  if (!ready) return null;

  // iOS slide on both platforms (Android's default is a fade-up); Reduce Motion crossfades instead.
  // The root view shares the page colour, so nothing white shows behind a screen mid-transition.
  const stack = (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Palette.ink },
        animation: reduced ? 'fade' : 'ios_from_right',
      }}
    />
  );
  const app = (
    <ThemeProvider value={theme}>
      <StatusBar style="dark" />
      {Platform.OS === 'web' ? (
        <View style={styles.page}>
          <View style={[styles.column, projected && styles.wide]}>{stack}</View>
        </View>
      ) : (
        stack
      )}
    </ThemeProvider>
  );
  // Queries stay subscribed for 2 minutes after their screen unmounts, so a revisit renders the last
  // result at once and keeps updating live; a subscription only ends once nothing reads it for that long.
  return convex ? (
    <ConvexProvider client={convex}>
      <ConvexQueryCacheProvider expiration={120_000} maxIdleEntries={40}>
        {app}
      </ConvexQueryCacheProvider>
    </ConvexProvider>
  ) : (
    app
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, alignItems: 'center', backgroundColor: Palette.inkDeep },
  column: { flex: 1, width: '100%', maxWidth: 440, backgroundColor: Palette.ink },
  wide: { maxWidth: '100%' },
});
