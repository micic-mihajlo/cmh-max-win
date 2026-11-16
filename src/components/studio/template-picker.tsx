import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Txt } from '@/components/signal/txt';
import { Caption, G, StudioScreen } from '@/components/showcase/studio-ui';
import { FontFamily, Space } from '@/constants/signal';
import { useChallengeTemplates, useCreateChallenge, useCreatorProfile } from '@/hooks/use-challenges';
import type { ChallengeTemplateId } from '@/lib/contract';
import { PressScale, Stagger } from '@/motion';

import { errorMessage, STUDIO_TEMPLATES, templateName } from './format';
import { STARTS } from './local-draft';

export function TemplatePicker() {
  const templates = useChallengeTemplates()?.filter((t) => STUDIO_TEMPLATES.includes(t.id));
  const create = useCreateChallenge();
  const profile = useCreatorProfile();
  const [busy, setBusy] = useState<ChallengeTemplateId | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pick = async (id: ChallengeTemplateId) => {
    if (busy) return;
    setBusy(id);
    setError(null);
    if (!profile) {
      router.replace(`/studio/draft?template=${id}` as Href);
      return;
    }
    try {
      const { challengeId } = await create(STARTS[id]);
      router.replace({ pathname: '/studio/[id]', params: { id: challengeId } });
    } catch (e) {
      setError(errorMessage(e, 'Couldn’t start a draft. Try again.'));
      setBusy(null);
    }
  };

  return (
    <StudioScreen title="New challenge">
      <View style={styles.list}>
        <Stagger from={8}>
          {(templates ?? []).map((t) => (
            <PressScale key={t.id} accessibilityRole="button" haptic="tap" scaleTo={0.98} disabled={!!busy} onPress={() => pick(t.id)}>
              <View style={[styles.card, busy && busy !== t.id && styles.dim]}>
                <View style={styles.head}>
                  <Txt style={styles.name}>{templateName(t.id)}</Txt>
                  {busy === t.id ? <ActivityIndicator color={G.inkSoft} /> : null}
                </View>
                <Txt variant="small" color={G.inkSoft}>
                  {t.blurb}
                </Txt>
              </View>
            </PressScale>
          ))}
        </Stagger>
      </View>
      {error ? <Caption color={G.bad}>{error}</Caption> : null}
    </StudioScreen>
  );
}

const styles = StyleSheet.create({
  list: { gap: Space.m, marginTop: Space.s },
  card: {
    backgroundColor: G.surface,
    borderRadius: 16,
    padding: Space.xl,
    gap: Space.s,
    minHeight: 120,
    justifyContent: 'flex-end',
  },
  dim: { opacity: 0.5 },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  name: {
    fontFamily: FontFamily.uiSemi,
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: -0.4,
    color: G.ink,
  },
});
