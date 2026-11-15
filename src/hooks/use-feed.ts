import { api } from '@convex/_generated/api';
import { useMutation, useQuery } from 'convex/react';
import { useCallback, useMemo } from 'react';

import { useDeviceToken } from '@/hooks/use-device-token';
import type {
  UseFollowingFeed,
  UseFollowStreamer,
  UseRegisterPushToken,
  UseRemindMe,
  UseRemovePushToken,
  UseStreamerForDrop,
  UseStreamerPage,
  UseStreamers,
} from '@/lib/contract';
import { getDeviceToken } from '@/lib/device';

const f = api.feed;

export const useFollowingFeed: UseFollowingFeed = () => {
  const deviceToken = useDeviceToken();
  return useQuery(f.followingFeed, deviceToken ? { deviceToken } : 'skip');
};

export const useStreamers: UseStreamers = () => {
  const deviceToken = useDeviceToken();
  return useQuery(f.streamers, deviceToken ? { deviceToken } : 'skip');
};

export const useStreamerPage: UseStreamerPage = (streamerId) => {
  const deviceToken = useDeviceToken();
  return useQuery(f.streamerPage, deviceToken && streamerId ? { deviceToken, streamerId } : 'skip');
};

export const useStreamerForDrop: UseStreamerForDrop = (dropId) => {
  const deviceToken = useDeviceToken();
  return useQuery(f.streamerForDrop, deviceToken && dropId ? { deviceToken, dropId } : 'skip');
};

export const useFollowStreamer: UseFollowStreamer = (streamerId) => {
  const followM = useMutation(f.followStreamer);
  const unfollowM = useMutation(f.unfollowStreamer);
  const follow = useCallback(async () => followM({ deviceToken: await getDeviceToken(), streamerId }), [followM, streamerId]);
  const unfollow = useCallback(async () => unfollowM({ deviceToken: await getDeviceToken(), streamerId }), [unfollowM, streamerId]);
  return useMemo(() => ({ follow, unfollow }), [follow, unfollow]);
};

export const useRemindMe: UseRemindMe = (dropId) => {
  const remindM = useMutation(f.remindMe);
  const cancelM = useMutation(f.cancelReminder);
  const remind = useCallback(async () => {
    await remindM({ deviceToken: await getDeviceToken(), dropId });
  }, [remindM, dropId]);
  const cancel = useCallback(async () => {
    await cancelM({ deviceToken: await getDeviceToken(), dropId });
  }, [cancelM, dropId]);
  return useMemo(() => ({ remind, cancel }), [remind, cancel]);
};

export const useRegisterPushToken: UseRegisterPushToken = () => {
  const register = useMutation(api.push.registerPushToken);
  return useCallback(async ({ token, platform }) => {
    await register({ deviceToken: await getDeviceToken(), token, platform });
  }, [register]);
};

export const useRemovePushToken: UseRemovePushToken = () => {
  const remove = useMutation(api.push.removePushToken);
  return useCallback(async () => {
    await remove({ deviceToken: await getDeviceToken() });
  }, [remove]);
};
