import { api } from '@convex/_generated/api';
import { useMutation, useQuery } from 'convex/react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useDeviceToken } from '@/hooks/use-device-token';
import type {
  UseActiveRoom,
  UseClaimRole,
  UseCreateRoom,
  UseJoinRoom,
  UseLeaveRoom,
  UseLockIn,
  UseMyDossier,
  UseReveal,
  UseRestart,
  UseRoom,
  UseSetPresence,
  UseSetTheory,
  UseStartCase,
} from '@/lib/contract';
import { getDeviceToken } from '@/lib/device';

const HEARTBEAT_MS = 15_000;
const OFFLINE_AFTER_MS = 45_000;

export const useActiveRoom: UseActiveRoom = () => {
  const deviceToken = useDeviceToken();
  return useQuery(api.signal.activeRoom, deviceToken ? { deviceToken } : 'skip');
};

export const useRoom: UseRoom = (code) => {
  const deviceToken = useDeviceToken();
  const raw = useQuery(api.signal.room, deviceToken && code ? { deviceToken, code } : 'skip');
  const heartbeat = useMutation(api.signal.heartbeat);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!deviceToken || !code) return;
    const beat = () => {
      setNow(Date.now());
      heartbeat({ deviceToken, code }).catch(() => {});
    };
    beat();
    const id = setInterval(beat, HEARTBEAT_MS);
    return () => clearInterval(id);
  }, [deviceToken, code, heartbeat]);

  return useMemo(() => {
    if (!raw) return raw;
    return {
      ...raw,
      members: raw.members.map(({ lastSeenAt, ...m }) => ({
        ...m,
        presence: !m.isMe && now - lastSeenAt > OFFLINE_AFTER_MS ? 'offline' : m.presence,
      })),
    };
  }, [raw, now]);
};

export const useMyDossier: UseMyDossier = (code) => {
  const deviceToken = useDeviceToken();
  return useQuery(api.signal.myDossier, deviceToken && code ? { deviceToken, code } : 'skip');
};

export const useReveal: UseReveal = (code) => {
  const deviceToken = useDeviceToken();
  return useQuery(api.signal.reveal, deviceToken && code ? { deviceToken, code } : 'skip');
};

export const useCreateRoom: UseCreateRoom = () => {
  const create = useMutation(api.signal.createRoom);
  return useCallback(async ({ name }) => create({ deviceToken: await getDeviceToken(), name }), [create]);
};

export const useJoinRoom: UseJoinRoom = () => {
  const join = useMutation(api.signal.joinRoom);
  return useCallback(
    async ({ code, name }) => join({ deviceToken: await getDeviceToken(), code, name }),
    [join],
  );
};

export const useClaimRole: UseClaimRole = (code) => {
  const claim = useMutation(api.signal.claimRole);
  return useCallback(async (role) => {
      await claim({ deviceToken: await getDeviceToken(), code, role });
    }, [claim, code]);
};

export const useStartCase: UseStartCase = (code) => {
  const start = useMutation(api.signal.startCase);
  return useCallback(async () => {
      await start({ deviceToken: await getDeviceToken(), code });
    }, [start, code]);
};

export const useSetPresence: UseSetPresence = (code) => {
  const set = useMutation(api.signal.setPresence);
  return useCallback(
    async (presence) => {
      await set({ deviceToken: await getDeviceToken(), code, presence });
    },
    [set, code],
  );
};

export const useSetTheory: UseSetTheory = (code) => {
  const set = useMutation(api.signal.setTheory);
  return useCallback(
    async (culprit) => set({ deviceToken: await getDeviceToken(), code, culprit }),
    [set, code],
  );
};

export const useLockIn: UseLockIn = (code) => {
  const lock = useMutation(api.signal.lockIn);
  return useCallback(
    async (revision) => lock({ deviceToken: await getDeviceToken(), code, revision }),
    [lock, code],
  );
};

export const useRestart: UseRestart = (code) => {
  const restart = useMutation(api.signal.restart);
  return useCallback(
    async ({ confirm }) => {
      await restart({ deviceToken: await getDeviceToken(), code, confirm });
    },
    [restart, code],
  );
};

export const useLeaveRoom: UseLeaveRoom = (code) => {
  const leave = useMutation(api.signal.leaveRoom);
  return useCallback(async () => {
      await leave({ deviceToken: await getDeviceToken(), code });
    }, [leave, code]);
};
