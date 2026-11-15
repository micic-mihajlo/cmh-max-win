import {
  Fraunces_400Regular,
  Fraunces_400Regular_Italic,
  Fraunces_600SemiBold,
  Fraunces_700Bold,
  useFonts as useFraunces,
} from '@expo-google-fonts/fraunces';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, useFonts as useInter } from '@expo-google-fonts/inter';
import { ConvexProvider } from 'convex/react';
import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { usePushTapRouting } from '@/components/showcase/social/push';
import { Palette } from '@/constants/signal';
import { convex } from '@/lib/convex';

SplashScreen.preventAutoHideAsync();

const theme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: Palette.ink, card: Palette.ink, text: Palette.paper, primary: Palette.ember },
};

export default function RootLayout() {
  const [frauncesLoaded] = useFraunces({ Fraunces_400Regular, Fraunces_400Regular_Italic, Fraunces_600SemiBold, Fraunces_700Bold });
  const [interLoaded] = useInter({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });
  const ready = frauncesLoaded && interLoaded;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);
  usePushTapRouting(ready);

  if (!ready) return null;

  const app = (
    <ThemeProvider value={theme}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Palette.ink } }} />
    </ThemeProvider>
  );
  return convex ? <ConvexProvider client={convex}>{app}</ConvexProvider> : app;
}
