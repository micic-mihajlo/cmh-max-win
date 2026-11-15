import * as SecureStore from 'expo-secure-store';
import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';

const KEY = 'signal.playerName';

async function read(): Promise<string | null> {
  if (Platform.OS === 'web') return globalThis.localStorage?.getItem(KEY) ?? null;
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500));
  return Promise.race([SecureStore.getItemAsync(KEY).catch(() => null), timeout]);
}

// The display name is local to this phone and is passed to createRoom/joinRoom.
export function usePlayerName() {
  const [name, setName] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    read().then(setName);
  }, []);
  const save = useCallback(async (value: string) => {
    if (Platform.OS === 'web') globalThis.localStorage?.setItem(KEY, value);
    else await SecureStore.setItemAsync(KEY, value).catch(() => {});
    setName(value);
  }, []);
  return { name, save };
}
