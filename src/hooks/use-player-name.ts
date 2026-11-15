import * as SecureStore from 'expo-secure-store';
import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';

const KEY = 'signal.playerName';

async function read() {
  if (Platform.OS === 'web') return globalThis.localStorage?.getItem(KEY) ?? null;
  return SecureStore.getItemAsync(KEY);
}

// The display name is local to this phone and is passed to createRoom/joinRoom.
export function usePlayerName() {
  const [name, setName] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    read().then(setName);
  }, []);
  const save = useCallback(async (value: string) => {
    if (Platform.OS === 'web') globalThis.localStorage?.setItem(KEY, value);
    else await SecureStore.setItemAsync(KEY, value);
    setName(value);
  }, []);
  return { name, save };
}
