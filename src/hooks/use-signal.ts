import { api } from '@convex/_generated/api';
import { usePresence } from '@convex-dev/presence/react-native';
import { useConvex, useConvexConnectionState, useMutation, useQuery } from 'convex/react';
import { useCallback } from 'react';

import { useDeviceToken } from '@/hooks/use-device-token';
import type {
  UseActiveRoom,
  UseClaimRole,
  UseConnection,
  UseCreateRoom,
  UseJoinRoom,
  UseLeaveRoom,
  UseLockIn,
  UseMyDossier,
  UseMyEvidence,
  UseReclaimRole,
  UseReveal,
  UseRestart,
  UseRoom,
  UseSetPresence,
  UseSetTheory,
  UseStartCase,
} from '@/lib/contract';
import { getDeviceToken } from '@/lib/device';
import { toSignalError } from '@/lib/signal-error';

export const useActiveRoom: UseActiveRoom = () => {
  const deviceToken = useDeviceToken();
  return useQuery(api.signal.activeRoom, deviceToken ? { deviceToken } : 'skip');
};

export const useRoom: UseRoom = (code) => {
  const deviceToken = useDeviceToken();
  usePresence(api.presence, code ?? '', deviceToken ?? '');
  return useQuery(api.signal.room, deviceToken && code ? { deviceToken, code } : 'skip');
};

export const useConnection: UseConnection = () => {
  const { isWebSocketConnected, hasEverConnected } = useConvexConnectionState();
  return { connected: isWebSocketConnected, everConnected: hasEverConnected };
};

export const useMyDossier: UseMyDossier = (code) => {
  const deviceToken = useDeviceToken();
  return useQuery(api.signal.myDossier, deviceToken && code ? { deviceToken, code } : 'skip');
};

export const useMyEvidence: UseMyEvidence = (code) => {
  const deviceToken = useDeviceToken();
  return useQuery(api.signal.myEvidence, deviceToken && code ? { deviceToken, code } : 'skip');
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

export const useReclaimRole: UseReclaimRole = (code) => {
  const reclaim = useMutation(api.signal.reclaimRole);
  return useCallback(
    async (role) => {
      await reclaim({ deviceToken: await getDeviceToken(), code, role });
    },
    [reclaim, code],
  );
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
  const convex = useConvex();
  return useCallback(
    async (revision) => {
      const deviceToken = await getDeviceToken();
      try {
        return await lock({ deviceToken, code, revision });
      } catch (error) {
        const reason = toSignalError(error)?.code;
        if (reason !== 'WRONG_STATUS' && reason !== 'ALREADY_CHECKED') throw error;
        const room = await convex.query(api.signal.room, { deviceToken, code });
        if (room?.status === 'resolved') return { outcome: 'resolved' } as const;
        throw error;
      }
    },
    [lock, convex, code],
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
