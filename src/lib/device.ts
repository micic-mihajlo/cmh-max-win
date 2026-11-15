import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// The device token is this phone's identity in SIGNAL. Storage lives behind these two
// functions so the strategy can change (e.g. to survive reinstalls) without touching callers.
const KEY = 'signal.deviceToken';

async function readStored(): Promise<string | null> {
  if (Platform.OS === 'web') return globalThis.localStorage?.getItem(KEY) ?? null;
  return SecureStore.getItemAsync(KEY);
}

async function writeStored(token: string): Promise<void> {
  if (Platform.OS === 'web') {
    globalThis.localStorage?.setItem(KEY, token);
    return;
  }
  await SecureStore.setItemAsync(KEY, token);
}

let pending: Promise<string> | null = null;

export function getDeviceToken(): Promise<string> {
  pending ??= (async () => {
    const stored = await readStored();
    if (stored) return stored;
    const token = Crypto.randomUUID();
    await writeStored(token);
    return token;
  })();
  return pending;
}
