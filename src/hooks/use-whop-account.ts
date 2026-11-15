import { api } from '@convex/_generated/api';
import { useAction, useMutation, useQuery } from 'convex/react';
import { useCallback } from 'react';

import { useDeviceToken } from '@/hooks/use-device-token';
import type { UseLinkForClaim, UseSignInWithWhop, UseSignOutWhop, UseWhopAccount, WhopSignInResult } from '@/lib/contract';
import { openWhopSignIn, whopReturnUrl } from '@/lib/whop-auth';

export const useWhopAccount: UseWhopAccount = () => {
  const deviceToken = useDeviceToken();
  return useQuery(api.whopAuth.account, deviceToken ? { deviceToken } : 'skip');
};

function useWhopSignIn(path?: string) {
  const deviceToken = useDeviceToken();
  const start = useAction(api.whopAuth.startSignIn);
  return useCallback(async (): Promise<WhopSignInResult> => {
    if (!deviceToken) return 'error';
    const returnUrl = whopReturnUrl(path);
    const { url } = await start({ deviceToken, returnUrl });
    if (!url) return 'unavailable';
    return openWhopSignIn(url, returnUrl);
  }, [deviceToken, path, start]);
}

export const useSignInWithWhop: UseSignInWithWhop = () => useWhopSignIn();

export const useLinkForClaim: UseLinkForClaim = (returnPath) => useWhopSignIn(returnPath);

export const useSignOutWhop: UseSignOutWhop = () => {
  const deviceToken = useDeviceToken();
  const signOut = useMutation(api.whopAuth.signOut);
  return useCallback(async () => {
    if (deviceToken) await signOut({ deviceToken });
  }, [deviceToken, signOut]);
};
