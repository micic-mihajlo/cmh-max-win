import { useEffect, useState } from 'react';

import { getDeviceToken } from '@/lib/device';

export function useDeviceToken(): string | null {
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    getDeviceToken().then((t) => live && setToken(t));
    return () => {
      live = false;
    };
  }, []);
  return token;
}
