import { api } from '@convex/_generated/api';
import { useMutation, useQuery } from 'convex/react';
import { useCallback, useEffect, useState } from 'react';

import { useDeviceToken } from '@/hooks/use-device-token';
import type {
  UseDrop,
  UseDrops,
  UseEnterDrop,
  UseLeaderboard,
  UseLeaveDrop,
  UseMyAward,
  UseServerOffset,
} from '@/lib/contract';
import { getDeviceToken } from '@/lib/device';

export const useDrops: UseDrops = () => useQuery(api.drops.listDrops, {});

export const useDrop: UseDrop = (dropId) => {
  const deviceToken = useDeviceToken();
  return useQuery(api.drops.drop, deviceToken && dropId ? { deviceToken, dropId } : 'skip');
};

export const useLeaderboard: UseLeaderboard = (dropId) => {
  const deviceToken = useDeviceToken();
  return useQuery(api.drops.leaderboard, deviceToken && dropId ? { deviceToken, dropId } : 'skip');
};

export const useMyAward: UseMyAward = (code) => {
  const deviceToken = useDeviceToken();
  return useQuery(api.drops.myAward, deviceToken && code ? { deviceToken, code } : 'skip');
};

export const useServerOffset: UseServerOffset = () => {
  const serverTime = useMutation(api.drops.serverTime);
  const [offset, setOffset] = useState<number | null>(null);
  useEffect(() => {
    const sent = Date.now();
    serverTime({})
      .then((server) => {
        const received = Date.now();
        setOffset(server - (sent + received) / 2);
      })
      .catch(() => {});
  }, [serverTime]);
  return offset;
};

export const useEnterDrop: UseEnterDrop = (dropId) => {
  const enter = useMutation(api.drops.enterDrop);
  return useCallback(
    async ({ name }) => {
      await enter({ deviceToken: await getDeviceToken(), dropId, name });
    },
    [enter, dropId],
  );
};

export const useLeaveDrop: UseLeaveDrop = (dropId) => {
  const leave = useMutation(api.drops.leaveDrop);
  return useCallback(async () => {
    await leave({ deviceToken: await getDeviceToken(), dropId });
  }, [leave, dropId]);
};
