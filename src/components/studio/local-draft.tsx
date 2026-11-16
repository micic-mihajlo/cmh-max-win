import { api } from '@convex/_generated/api';
import { useMutation } from 'convex/react';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Caption, Field, G, PrimaryButton, StudioScreen, studio } from '@/components/showcase/studio-ui';
import { useChallengeTemplates, useCreateChallenge, useCreatorProfile, useSaveCreatorProfile } from '@/hooks/use-challenges';
import { useCheckHandle } from '@/hooks/use-discovery';
import type { ChallengeConfigPatch, ChallengeTemplateId } from '@/lib/contract';
import { getDeviceToken } from '@/lib/device';
import { Enter, Haptic } from '@/motion';

import { EditorView, type EditorConfig } from './editor';
import { errorMessage } from './format';
import { blankQuestion } from './quiz-config';

export const STARTS: Record<string, ChallengeConfigPatch> = {
  'quick-quiz': { templateId: 'quick-quiz', teamSize: 1, startMode: 'live', templateConfig: { questions: [blankQuestion(), blankQuestion(), blankQuestion()] } },
  'mystery-aurora': { templateId: 'mystery-aurora', teamSize: 3, startMode: 'live' },
};

// A first challenge, before the creator has a profile: built on this device, and the name and handle are asked only
// at Publish. Publish then saves the profile, creates the draft and publishes it in one go.
export function LocalDraft({ templateId }: { templateId: ChallengeTemplateId }) {
  const template = useChallengeTemplates()?.find((t) => t.id === templateId);
  const profile = useCreatorProfile();
  const saveProfile = useSaveCreatorProfile();
  const create = useCreateChallenge();
  const publish = useMutation(api.challenges.publishChallenge);
  const [cfg, setCfg] = useState<EditorConfig>(() => ({
    title: '',
    poolCents: 0,
    reward: { kind: 'placement', percents: [50, 30, 20] },
    ...(STARTS[templateId] as Omit<EditorConfig, 'title' | 'poolCents' | 'reward'>),
  }));
  const [step, setStep] = useState<'edit' | 'profile'>('edit');
  const [name, setName] = useState('');
  const [handle, setHandle] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const check = useCheckHandle(handle.trim() ? handle : null);
  const handleProblem = handle.trim() && check && !check.available ? (check.problem ?? 'That handle is taken.') : null;

  if (!template) return <StudioScreen title="">{null}</StudioScreen>;

  const finish = async (withProfile: boolean) => {
    setPublishing(true);
    setProblem(null);
    let challengeId: string | null = null;
    try {
      if (withProfile) await saveProfile({ displayName: name.trim(), handle: handle.trim() });
      challengeId = (await create({ ...STARTS[templateId], ...cfg })).challengeId;
      await publish({ deviceToken: await getDeviceToken(), challengeId });
      Haptic.success();
      router.replace({ pathname: '/studio/[id]', params: { id: challengeId } });
    } catch (e) {
      Haptic.warning();
      if (challengeId) router.replace({ pathname: '/studio/[id]', params: { id: challengeId } });
      setProblem(errorMessage(e, 'Couldn’t publish. Try again.'));
      setPublishing(false);
    }
  };

  if (step === 'profile') {
    const ready = name.trim().length > 0 && check?.available === true && !publishing;
    return (
      <StudioScreen
        title="Publish as"
        onBack={() => setStep('edit')}
        footer={<PrimaryButton variant="accent" title={publishing ? 'Publishing…' : 'Publish'} disabled={!ready} onPress={() => finish(true)} />}>
        <Enter from={8}>
          <View style={studio.gap}>
            <Field label="Name" value={name} onChange={setName} placeholder="Your name" autoFocus maxLength={40} />
            <Field label="Handle" value={handle} onChange={(t) => setHandle(t.replace(/\s/g, '').toLowerCase())} placeholder="@handle" prefix="@" maxLength={21} />
            {handleProblem || problem ? <Caption color={G.bad}>{handleProblem ?? problem}</Caption> : null}
          </View>
        </Enter>
      </StudioScreen>
    );
  }

  return (
    <EditorView
      cfg={cfg}
      template={template}
      change={(patch) => {
        setCfg((c) => ({ ...c, ...patch }));
        setProblem(null);
      }}
      onPublish={() => (profile ? finish(false) : setStep('profile'))}
      publishing={publishing}
      note={problem ? { text: problem, bad: true } : null}
    />
  );
}
