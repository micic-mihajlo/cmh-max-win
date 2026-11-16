import { api } from '@convex/_generated/api';
import { useAction } from 'convex/react';
import { useQuery } from 'convex-helpers/react/cache/hooks';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useState } from 'react';

import { useDeviceToken } from '@/hooks/use-device-token';
import type { SeasonPackState, UseSeasonPack } from '@/lib/contract';

export const useSeasonPack: UseSeasonPack = () => {
  const deviceToken = useDeviceToken();
  const entitlements = useQuery(api.whop.myEntitlements, deviceToken ? { deviceToken } : 'skip');
  const createCheckout = useAction(api.whop.createCheckout);
  const [phase, setPhase] = useState<Exclude<SeasonPackState, 'owned'>>('locked');
  const [error, setError] = useState<string | null>(null);

  const buy = useCallback(async () => {
    if (!deviceToken) return;
    setError(null);
    setPhase('checkout');
    try {
      const { purchaseUrl } = await createCheckout({ deviceToken, pack: 'season01' });
      const result = await WebBrowser.openAuthSessionAsync(purchaseUrl, Linking.createURL('season'));
      setPhase(result.type === 'success' ? 'verifying' : 'locked');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Checkout failed');
      setPhase('locked');
    }
  }, [createCheckout, deviceToken]);

  if (entitlements === undefined) return { view: undefined, buy };
  const owned = entitlements.find((e) => e.pack === 'season01');
  return {
    view: {
      pack: 'season01',
      state: owned ? 'owned' : phase,
      real: true,
      environment: owned?.environment ?? null,
      error,
    },
    buy,
  };
};
