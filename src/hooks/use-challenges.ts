import { api } from '@convex/_generated/api';
import { useAction, useMutation, useQuery } from 'convex/react';
import { useCallback } from 'react';

import { useDeviceToken } from '@/hooks/use-device-token';
import type {
  UseApprovePayouts,
  UseCancelChallenge,
  UseChallengeByCode,
  UseChallengeDraft,
  UseChallengeRecap,
  UseChallengeStandings,
  UseChallengeTemplates,
  UseClaimPayout,
  UseCloneChallenge,
  UseConfirmMixerTeam,
  UseCreateChallenge,
  UseCreatorProfile,
  UseDealTeams,
  UseEndChallenge,
  UseHostConsole,
  UseJoinChallenge,
  UseLeaveChallenge,
  UseLeaveMixerTeam,
  UseLinkPlayer,
  UseMixerStandings,
  UseMyChallenge,
  UseMyChallenges,
  UseMyPayout,
  UsePublishChallenge,
  UseSaveCreatorProfile,
  UseSubmitMixerAnswer,
  UseUpdateChallengeDraft,
} from '@/lib/contract';
import { getDeviceToken } from '@/lib/device';

const c = api.challenges;

function useTokenQuery<Args extends Record<string, unknown>, R>(fn: Parameters<typeof useQuery>[0], args: Args | null): R | undefined {
  const deviceToken = useDeviceToken();
  return useQuery(fn, deviceToken && args ? { deviceToken, ...args } : 'skip') as R | undefined;
}

export const useCreatorProfile: UseCreatorProfile = () => useTokenQuery(c.creatorProfile, {});
export const useChallengeTemplates: UseChallengeTemplates = () => useQuery(c.templates, {});
export const useMyChallenges: UseMyChallenges = () => useTokenQuery(c.myChallenges, {});
export const useChallengeDraft: UseChallengeDraft = (challengeId) => useTokenQuery(c.challengeDraft, challengeId ? { challengeId } : null);
export const useHostConsole: UseHostConsole = (challengeId) => useTokenQuery(c.hostConsole, challengeId ? { challengeId } : null);
export const useChallengeByCode: UseChallengeByCode = (code) => useTokenQuery(c.challengeByCode, code ? { code } : null);
export const useMyChallenge: UseMyChallenge = (challengeId) => useTokenQuery(c.myChallenge, challengeId ? { challengeId } : null);
export const useMyPayout: UseMyPayout = (challengeId) => useTokenQuery(c.myPayout, challengeId ? { challengeId } : null);
export const useChallengeStandings: UseChallengeStandings = (challengeId) =>
  useTokenQuery(c.challengeStandings, challengeId ? { challengeId } : null);
export const useMixerStandings: UseMixerStandings = (challengeId) => useQuery(c.mixerStandings, challengeId ? { challengeId } : 'skip');
export const useChallengeRecap: UseChallengeRecap = (challengeId) => useQuery(c.challengeRecap, challengeId ? { challengeId } : 'skip');

export const useSaveCreatorProfile: UseSaveCreatorProfile = () => {
  const save = useMutation(c.saveCreatorProfile);
  return useCallback(async (args) => save({ deviceToken: await getDeviceToken(), ...args }), [save]);
};

export const useCreateChallenge: UseCreateChallenge = () => {
  const create = useMutation(c.createChallenge);
  return useCallback(async (patch) => create({ deviceToken: await getDeviceToken(), patch }), [create]);
};

export const useJoinChallenge: UseJoinChallenge = () => {
  const join = useAction(c.joinChallenge);
  return useCallback(async (args) => join({ deviceToken: await getDeviceToken(), ...args }), [join]);
};

export const useUpdateChallengeDraft: UseUpdateChallengeDraft = (challengeId) => {
  const update = useMutation(c.updateChallengeDraft);
  return useCallback(async (patch) => update({ deviceToken: await getDeviceToken(), challengeId, patch }), [update, challengeId]);
};

export const useCancelChallenge: UseCancelChallenge = (challengeId) => {
  const cancel = useMutation(c.cancelChallenge);
  return useCallback(
    async (reason) => {
      await cancel({ deviceToken: await getDeviceToken(), challengeId, reason });
    },
    [cancel, challengeId],
  );
};

export const useLinkPlayer: UseLinkPlayer = (challengeId) => {
  const link = useMutation(c.linkPlayer);
  return useCallback(async (playerCode) => link({ deviceToken: await getDeviceToken(), challengeId, playerCode }), [link, challengeId]);
};

export const useSubmitMixerAnswer: UseSubmitMixerAnswer = (challengeId) => {
  const submit = useMutation(c.submitMixerAnswer);
  return useCallback(async (answer) => submit({ deviceToken: await getDeviceToken(), challengeId, answer }), [submit, challengeId]);
};

function useHostAction<R>(fn: Parameters<typeof useMutation>[0], challengeId: string): () => Promise<R> {
  const run = useMutation(fn);
  return useCallback(async () => (await run({ deviceToken: await getDeviceToken(), challengeId })) as R, [run, challengeId]);
}

export const usePublishChallenge: UsePublishChallenge = (challengeId) => useHostAction(c.publishChallenge, challengeId);
export const useDealTeams: UseDealTeams = (challengeId) => useHostAction(c.dealTeams, challengeId);
export const useEndChallenge: UseEndChallenge = (challengeId) => useHostAction(c.endChallenge, challengeId);
export const useApprovePayouts: UseApprovePayouts = (challengeId) => useHostAction(c.approvePayouts, challengeId);
export const useCloneChallenge: UseCloneChallenge = (challengeId) => useHostAction(c.cloneChallenge, challengeId);
export const useLeaveChallenge: UseLeaveChallenge = (challengeId) => useHostAction(c.leaveChallenge, challengeId);
export const useClaimPayout: UseClaimPayout = (challengeId) => useHostAction(c.claimPayout, challengeId);
export const useLeaveMixerTeam: UseLeaveMixerTeam = (challengeId) => useHostAction(c.leaveMixerTeam, challengeId);
export const useConfirmMixerTeam: UseConfirmMixerTeam = (challengeId) => useHostAction(c.confirmMixerTeam, challengeId);
