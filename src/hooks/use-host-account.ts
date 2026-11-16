import { api } from '@convex/_generated/api';
import { useAction, useMutation, useQuery } from 'convex/react';
import { useCallback } from 'react';

import { useDeviceToken } from '@/hooks/use-device-token';
import type { WhopSignInResult } from '@/lib/contract';
import type { UseMyHostedDrops, UseSignInToHost } from '@/lib/contract-host';
import { useFinishWhopRedirect } from '@/hooks/use-whop-account';
import { getDeviceToken } from '@/lib/device';
import { openWhopSignIn, whopReturnUrl } from '@/lib/whop-auth';

export const useSignInToHost: UseSignInToHost = (returnPath) => {
  const start = useAction(api.whopAuth.startSignIn);
  const complete = useMutation(api.whopAuth.completeSignIn);
  useFinishWhopRedirect();
  return useCallback(async (): Promise<WhopSignInResult> => {
    const deviceToken = await getDeviceToken();
    const returnUrl = whopReturnUrl(returnPath);
    const result = await start({ deviceToken, purpose: 'host', returnUrl });
    if (result.reason) return result.reason;
    return openWhopSignIn(result.url, returnUrl, (linkCode) => complete({ deviceToken, linkCode }), 'host');
  }, [complete, returnPath, start]);
};

export const useMyHostedDrops: UseMyHostedDrops = () => {
  const deviceToken = useDeviceToken();
  return useQuery(api.drops.myHostedDrops, deviceToken ? { deviceToken } : 'skip');
};
