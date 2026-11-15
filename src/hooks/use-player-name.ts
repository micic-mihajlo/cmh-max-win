import { useCallback, useEffect, useState } from 'react';

import { readStored, writeStored } from '@/lib/device';

export const PLAYER_NAME_KEY = 'signal.playerName';

// The display name is local to this phone and is passed to createRoom/joinRoom. A read that fails
// or times out yields null, which shows the name-entry screen instead of a blank one.
export function usePlayerName() {
  const [name, setName] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    readStored(PLAYER_NAME_KEY).then(({ value }) => setName(value));
  }, []);
  const save = useCallback(async (value: string) => {
    await writeStored(PLAYER_NAME_KEY, value);
    setName(value);
  }, []);
  return { name, save };
}
