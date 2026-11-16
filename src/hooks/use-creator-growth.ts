import { api } from '@convex/_generated/api';
import { useQuery } from 'convex-helpers/react/cache/hooks';

import { useDeviceToken } from '@/hooks/use-device-token';
import type { UseChallengeGrowth, UseCreatorStats } from '@/lib/contract';

export const useChallengeGrowth: UseChallengeGrowth = (challengeId) => {
  const deviceToken = useDeviceToken();
  return useQuery(api.creatorGrowth.challengeGrowth, deviceToken && challengeId ? { deviceToken, challengeId } : 'skip');
};

export const useCreatorStats: UseCreatorStats = () => {
  const deviceToken = useDeviceToken();
  return useQuery(api.creatorGrowth.creatorStats, deviceToken ? { deviceToken } : 'skip');
};
