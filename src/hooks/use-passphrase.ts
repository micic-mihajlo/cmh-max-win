import { api } from '@convex/_generated/api';
import { useMutation, useQuery } from 'convex/react';
import { useCallback } from 'react';

import { useDeviceToken } from '@/hooks/use-device-token';
import type { UseConfirmPassphrase, UsePassphrase, UseSubmitPassphrase } from '@/lib/contract';
import { getDeviceToken } from '@/lib/device';

export const usePassphrase: UsePassphrase = (code) => {
  const deviceToken = useDeviceToken();
  return useQuery(api.passphrase.piece, deviceToken && code ? { deviceToken, code } : 'skip');
};

export const useSubmitPassphrase: UseSubmitPassphrase = (code) => {
  const submit = useMutation(api.passphrase.submitPassphrase);
  return useCallback(async (answer: string) => submit({ deviceToken: await getDeviceToken(), code, answer }), [submit, code]);
};

export const useConfirmPassphrase: UseConfirmPassphrase = (code) => {
  const confirm = useMutation(api.passphrase.confirmPassphrase);
  return useCallback(async (revision: number) => confirm({ deviceToken: await getDeviceToken(), code, revision }), [confirm, code]);
};
