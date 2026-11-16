import { Inter_400Regular, Inter_400Regular_Italic, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, useFonts } from '@expo-google-fonts/inter';
import { ConvexProvider } from 'convex/react';
import { DefaultTheme, Stack, ThemeProvider, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { usePushTapRouting } from '@/components/showcase/social/push';
import { Palette } from '@/constants/signal';
import { convex } from '@/lib/convex';

SplashScreen.preventAutoHideAsync();

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
  const projected = /^\/drop\/[^/]+\/host$|^\/mocks\/2\d-host/.test(usePathname());

  if (!ready) return null;

  const stack = <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Palette.ink } }} />;
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
  return convex ? <ConvexProvider client={convex}>{app}</ConvexProvider> : app;
}

const styles = StyleSheet.create({
  page: { flex: 1, alignItems: 'center', backgroundColor: Palette.inkDeep },
  column: { flex: 1, width: '100%', maxWidth: 440, backgroundColor: Palette.ink },
  wide: { maxWidth: '100%' },
});
