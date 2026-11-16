import { api } from '@convex/_generated/api';
import { useQuery } from 'convex/react';
import { useMemo } from 'react';

import { useDeviceToken } from '@/hooks/use-device-token';
import type { UseRoomPulse } from '@/lib/contract-pulse';

export const useRoomPulse: UseRoomPulse = (code) => {
  const deviceToken = useDeviceToken();
  const key = useQuery(api.live.roomPulseKey, deviceToken && code ? { code, deviceToken } : 'skip');
  const shared = useQuery(api.live.roomPulseShared, key && code ? { code, roomKey: key.roomKey } : 'skip');
  return useMemo(() => {
    if (key === undefined || key === null) return key;
    if (shared === undefined || shared === null) return shared;
    return { ...shared, myTeamId: key.myTeamId };
  }, [key, shared]);
};
