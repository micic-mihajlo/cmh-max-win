import { api } from '@convex/_generated/api';
<<<<<<< HEAD
import { useAction, useMutation } from 'convex/react';
import { useQuery } from 'convex-helpers/react/cache/hooks';
import { useCallback } from 'react';
=======
import { useAction, useMutation, useQuery } from 'convex/react';
import { useCallback, useEffect } from 'react';
>>>>>>> origin/main

import { useDeviceToken } from '@/hooks/use-device-token';
import type { UseLinkForClaim, UseSignInToJoin, UseSignOutWhop, UseWhopAccount, WhopSignInResult } from '@/lib/contract';
import { getDeviceToken } from '@/lib/device';
import { finishWhopRedirect, openWhopSignIn, whopReturnUrl } from '@/lib/whop-auth';

// Mobile web signs in by redirecting the tab (whop-auth.ts). Every sign-in hook finishes a pending redirect on mount;
// the first one to run takes it, and the account updates through useWhopAccount.
export function useFinishWhopRedirect() {
  const complete = useMutation(api.whopAuth.completeSignIn);
  useEffect(() => {
    void finishWhopRedirect(async (linkCode) => complete({ deviceToken: await getDeviceToken(), linkCode }));
  }, [complete]);
}

export const useWhopAccount: UseWhopAccount = () => {
  const deviceToken = useDeviceToken();
  return useQuery(api.whopAuth.account, deviceToken ? { deviceToken } : 'skip');
};

export const useLinkForClaim: UseLinkForClaim = (code, returnPath) => {
  const deviceToken = useDeviceToken();
  const start = useAction(api.whopAuth.startSignIn);
  const complete = useMutation(api.whopAuth.completeSignIn);
  useFinishWhopRedirect();
  return useCallback(async (): Promise<WhopSignInResult> => {
    if (!deviceToken || !code) return 'not_winner';
    const returnUrl = whopReturnUrl(returnPath);
    const result = await start({ deviceToken, claimCode: code, returnUrl });
    if (result.reason) return result.reason;
    return openWhopSignIn(result.url, returnUrl, (linkCode) => complete({ deviceToken, linkCode }), 'claim');
  }, [code, complete, deviceToken, returnPath, start]);
};

export const useSignInToJoin: UseSignInToJoin = (code, returnPath) => {
  const deviceToken = useDeviceToken();
  const start = useAction(api.whopAuth.startSignIn);
  const complete = useMutation(api.whopAuth.completeSignIn);
  useFinishWhopRedirect();
  return useCallback(async (): Promise<WhopSignInResult> => {
    if (!deviceToken || !code) return 'not_required';
    const returnUrl = whopReturnUrl(returnPath);
    const result = await start({ deviceToken, purpose: 'join', challengeCode: code, returnUrl });
    if (result.reason) return result.reason;
    return openWhopSignIn(result.url, returnUrl, (linkCode) => complete({ deviceToken, linkCode }), 'join');
  }, [code, complete, deviceToken, returnPath, start]);
};

export const useSignOutWhop: UseSignOutWhop = () => {
  const deviceToken = useDeviceToken();
  const signOut = useMutation(api.whopAuth.signOut);
  return useCallback(async () => {
    if (deviceToken) await signOut({ deviceToken });
  }, [deviceToken, signOut]);
};
