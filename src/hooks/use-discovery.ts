import { api } from '@convex/_generated/api';
import { useMutation } from 'convex/react';
import { useQuery } from 'convex-helpers/react/cache/hooks';
import { useCallback, useMemo } from 'react';

import { useDeviceToken } from '@/hooks/use-device-token';
import type {
  UseCheckHandle,
  UseCreatorPage,
  UseDiscoveryHome,
  UseFollowCreator,
  UseRemindChallenge,
  UseResolveCode,
  UseShareLink,
  UseUpcomingReminders,
} from '@/lib/contract';
import { getDeviceToken } from '@/lib/device';

const d = api.discovery;

export const useCreatorPage: UseCreatorPage = (handle) => {
  const deviceToken = useDeviceToken();
  return useQuery(d.creatorPage, handle ? { handle, ...(deviceToken ? { deviceToken } : {}) } : 'skip');
};

export const useShareLink: UseShareLink = (ref) => useQuery(d.shareLink, ref ? { ref } : 'skip');

export const useCheckHandle: UseCheckHandle = (handle) => {
  const deviceToken = useDeviceToken();
  return useQuery(api.handles.checkHandle, handle ? { handle, ...(deviceToken ? { deviceToken } : {}) } : 'skip');
};

export const useFollowCreator: UseFollowCreator = (handle) => {
  const followM = useMutation(d.followCreator);
  const unfollowM = useMutation(d.unfollowCreator);
  const follow = useCallback(async () => followM({ deviceToken: await getDeviceToken(), handle }), [followM, handle]);
  const unfollow = useCallback(async () => unfollowM({ deviceToken: await getDeviceToken(), handle }), [unfollowM, handle]);
  return useMemo(() => ({ follow, unfollow }), [follow, unfollow]);
};

export const useRemindChallenge: UseRemindChallenge = (challengeId) => {
  const remindM = useMutation(d.remindChallenge);
  const cancelM = useMutation(d.cancelChallengeReminder);
  const remind = useCallback(async () => {
    await remindM({ deviceToken: await getDeviceToken(), challengeId });
  }, [remindM, challengeId]);
  const cancel = useCallback(async () => {
    await cancelM({ deviceToken: await getDeviceToken(), challengeId });
  }, [cancelM, challengeId]);
  return useMemo(() => ({ remind, cancel }), [remind, cancel]);
};

export const useUpcomingReminders: UseUpcomingReminders = () => {
  const deviceToken = useDeviceToken();
  return useQuery(d.upcomingReminders, deviceToken ? { deviceToken } : 'skip');
};

export const useResolveCode: UseResolveCode = (code) => useQuery(d.resolveCode, code ? { code } : 'skip');

export const useDiscoveryHome: UseDiscoveryHome = () => {
  const deviceToken = useDeviceToken();
  return useQuery(d.home, deviceToken ? { deviceToken } : 'skip');
};
