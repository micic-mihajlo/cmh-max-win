import { api } from '@convex/_generated/api';
import { useAction, useMutation, useQuery } from 'convex/react';
import { useCallback } from 'react';

import { useDeviceToken } from '@/hooks/use-device-token';
import { useFinishWhopRedirect } from '@/hooks/use-whop-account';
import type {
  UseConnectWhopCompany,
  UseCreatorWhop,
  UseCreatorWhopSignIn,
  UseDisconnectWhopCompany,
  WhopSignInResult,
} from '@/lib/contract';
import { openWhopSignIn, whopReturnUrl } from '@/lib/whop-auth';

export const useCreatorWhop: UseCreatorWhop = () => {
  const deviceToken = useDeviceToken();
  return useQuery(api.whopCreator.creatorWhop, deviceToken ? { deviceToken } : 'skip');
};

export const useCreatorWhopSignIn: UseCreatorWhopSignIn = () => {
  const deviceToken = useDeviceToken();
  const start = useAction(api.whopAuth.startSignIn);
  const complete = useMutation(api.whopAuth.completeSignIn);
  useFinishWhopRedirect();
  return useCallback(async (): Promise<WhopSignInResult> => {
    if (!deviceToken) return 'error';
    const returnUrl = whopReturnUrl('studio');
    const result = await start({ deviceToken, returnUrl });
    if (result.reason) return result.reason;
    return openWhopSignIn(result.url, returnUrl, (linkCode) => complete({ deviceToken, linkCode }), 'creator');
  }, [complete, deviceToken, start]);
};

export const useConnectWhopCompany: UseConnectWhopCompany = () => {
  const deviceToken = useDeviceToken();
  const connect = useAction(api.whopCreator.connectWhopCompany);
  return useCallback(
    async (companyId: string) => {
      if (!deviceToken) throw new Error('Device token not ready');
      return connect({ deviceToken, companyId });
    },
    [connect, deviceToken],
  );
};

export const useDisconnectWhopCompany: UseDisconnectWhopCompany = () => {
  const deviceToken = useDeviceToken();
  const disconnect = useMutation(api.whopCreator.disconnectWhopCompany);
  return useCallback(async () => {
    if (deviceToken) await disconnect({ deviceToken });
  }, [deviceToken, disconnect]);
};
