import { api } from '@convex/_generated/api';
import { useAction, useMutation, useQuery } from 'convex/react';
import { useCallback } from 'react';

import { useDeviceToken } from '@/hooks/use-device-token';
import type { UseLinkForClaim, UseSignOutWhop, UseWhopAccount, WhopSignInResult } from '@/lib/contract';
import { openWhopSignIn, whopReturnUrl } from '@/lib/whop-auth';

export const useWhopAccount: UseWhopAccount = () => {
  const deviceToken = useDeviceToken();
  return useQuery(api.whopAuth.account, deviceToken ? { deviceToken } : 'skip');
};

export const useLinkForClaim: UseLinkForClaim = (code, returnPath) => {
  const deviceToken = useDeviceToken();
  const start = useAction(api.whopAuth.startSignIn);
  return useCallback(async (): Promise<WhopSignInResult> => {
    if (!deviceToken || !code) return 'not_winner';
    const returnUrl = whopReturnUrl(returnPath);
    const result = await start({ deviceToken, claimCode: code, returnUrl });
    if (result.reason) return result.reason;
    return openWhopSignIn(result.url, returnUrl);
  }, [code, deviceToken, returnPath, start]);
};

export const useSignOutWhop: UseSignOutWhop = () => {
  const deviceToken = useDeviceToken();
  const signOut = useMutation(api.whopAuth.signOut);
  return useCallback(async () => {
    if (deviceToken) await signOut({ deviceToken });
  }, [deviceToken, signOut]);
};
