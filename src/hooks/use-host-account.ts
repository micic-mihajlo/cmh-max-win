import { api } from '@convex/_generated/api';
import { useAction, useQuery } from 'convex/react';
import { useCallback } from 'react';

import { useDeviceToken } from '@/hooks/use-device-token';
import type { WhopSignInResult } from '@/lib/contract';
import type { UseMyHostedDrops, UseSignInToHost } from '@/lib/contract-host';
import { getDeviceToken } from '@/lib/device';
import { openWhopSignIn, whopReturnUrl } from '@/lib/whop-auth';

export const useSignInToHost: UseSignInToHost = (returnPath) => {
  const start = useAction(api.whopAuth.startSignIn);
  return useCallback(async (): Promise<WhopSignInResult> => {
    const returnUrl = whopReturnUrl(returnPath);
    const result = await start({ deviceToken: await getDeviceToken(), purpose: 'host', returnUrl });
    if (result.reason) return result.reason;
    return openWhopSignIn(result.url, returnUrl);
  }, [returnPath, start]);
};

export const useMyHostedDrops: UseMyHostedDrops = () => {
  const deviceToken = useDeviceToken();
  return useQuery(api.drops.myHostedDrops, deviceToken ? { deviceToken } : 'skip');
};
