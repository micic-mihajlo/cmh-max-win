import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// The device token is this phone's identity in SIGNAL. Storage lives behind these functions so the
// strategy can change (e.g. to survive reinstalls) without touching callers.
const KEY = 'signal.deviceToken';
const TIMEOUT_MS = 1500;

// SecureStore calls can hang forever on some simulators, so every read and write is raced
// against a timeout. A read that timed out is not a miss: the stored value may still exist.
export async function readStored(key: string): Promise<{ value: string | null; timedOut: boolean }> {
  try {
    if (Platform.OS === 'web') return { value: globalThis.localStorage?.getItem(key) ?? null, timedOut: false };
    const timeout = new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), TIMEOUT_MS));
    const result = await Promise.race([SecureStore.getItemAsync(key), timeout]);
    return result === 'timeout' ? { value: null, timedOut: true } : { value: result, timedOut: false };
  } catch {
    return { value: null, timedOut: false };
  }
}

export async function writeStored(key: string, value: string): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      globalThis.localStorage?.setItem(key, value);
      return;
    }
    const timeout = new Promise<void>((resolve) => setTimeout(resolve, TIMEOUT_MS));
    await Promise.race([SecureStore.setItemAsync(key, value), timeout]);
  } catch {}
}

let current: string | null = null;
let pending: Promise<void> | null = null;
let retry: Promise<void> | null = null;

// After a timed-out read the generated token lives only in memory and is never written, so a
// slow keychain can't overwrite this player's real token. One background retry switches to the
// stored token if it turns up; every call waits for that retry before returning.
export async function getDeviceToken(): Promise<string> {
  pending ??= (async () => {
    const { value, timedOut } = await readStored(KEY);
    if (value) {
      current = value;
      return;
    }
    current = Crypto.randomUUID();
    if (timedOut) {
      retry = readStored(KEY).then(({ value: late }) => {
        if (late) current = late;
      });
      return;
    }
    await writeStored(KEY, current);
  })();
  await pending;
  if (retry) await retry;
  return current!;
}
