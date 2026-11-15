import Constants, { ExecutionEnvironment } from 'expo-constants';
import { router, type Href } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import type { FeedPushData, PushPlatform } from '@/lib/contract';

// Real push needs a native build that carries expo-notifications (TestFlight build 3+). Expo Go and web never load
// the module, so they keep the in-app banner only.
export const pushAvailable = Platform.OS !== 'web' && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;

type Notifications = typeof import('expo-notifications');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const load = (): Notifications | null => (pushAvailable ? require('expo-notifications') : null);

async function token(N: Notifications) {
  const { data } = await N.getExpoPushTokenAsync();
  return { token: data, platform: Platform.OS as PushPlatform };
}

// After the person taps "Turn on": asks the OS once, then returns the Expo push token, or null when declined or unavailable.
export async function requestPushToken() {
  const N = load();
  if (!N) return null;
  const { granted } = await N.requestPermissionsAsync();
  return granted ? token(N) : null;
}

// On launch: refreshes the token only when permission was already granted, so it never prompts.
export async function existingPushToken() {
  const N = load();
  if (!N) return null;
  const { granted } = await N.getPermissionsAsync();
  return granted ? token(N) : null;
}

// Tapping a going-live or room-starting push opens that drop, from a cold start or while running.
export function usePushTapRouting(ready: boolean) {
  useEffect(() => {
    const N = load();
    if (!N || !ready) return;
    const open = (response: import('expo-notifications').NotificationResponse | null) => {
      const data = response?.notification.request.content.data as Partial<FeedPushData> | undefined;
      if (typeof data?.dropId !== 'string') return;
      router.push({ pathname: '/drop/[id]', params: { id: data.dropId } } as unknown as Href);
      N.clearLastNotificationResponseAsync().catch(() => {});
    };
    open(N.getLastNotificationResponse());
    const sub = N.addNotificationResponseReceivedListener(open);
    return () => sub.remove();
  }, [ready]);
}
