import { api } from '@convex/_generated/api';
import { useMutation, useQuery } from 'convex/react';
import { useCallback } from 'react';

import { useDeviceToken } from '@/hooks/use-device-token';
import type { UseLiveView, UseLockEntries, UsePlayerAction, UseRunHostAction, UseStartLive, UseTeamSessionView } from '@/lib/contract';
import { getDeviceToken } from '@/lib/device';

const l = api.live;

export const useLiveView: UseLiveView = (code) => useQuery(l.liveView, code ? { code } : 'skip');

export const useTeamSessionView: UseTeamSessionView = (challengeId) => {
  const deviceToken = useDeviceToken();
  return useQuery(l.teamSessionView, deviceToken && challengeId ? { deviceToken, challengeId } : 'skip');
};

export const useLockEntries: UseLockEntries = (challengeId) => {
  const lock = useMutation(l.lockEntries);
  return useCallback(async () => {
    await lock({ deviceToken: await getDeviceToken(), challengeId });
  }, [lock, challengeId]);
};

export const useStartLive: UseStartLive = (challengeId) => {
  const start = useMutation(l.startLive);
  return useCallback(async () => {
    await start({ deviceToken: await getDeviceToken(), challengeId });
  }, [start, challengeId]);
};

export const useRunHostAction: UseRunHostAction = (challengeId) => {
  const run = useMutation(l.runHostAction);
  return useCallback(async (action, payload) => run({ deviceToken: await getDeviceToken(), challengeId, action, payload }), [run, challengeId]);
};

export const usePlayerAction: UsePlayerAction = (challengeId) => {
  const send = useMutation(l.playerAction);
  return useCallback(
    async (action) => {
      await send({ deviceToken: await getDeviceToken(), challengeId, action });
    },
    [send, challengeId],
  );
};
