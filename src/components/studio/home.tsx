import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Txt } from '@/components/signal/txt';
import { Caption, Card, Field, G, Hairline, PrimaryButton, Section, StudioScreen, studio } from '@/components/showcase/studio-ui';
import { Space } from '@/constants/signal';
import { useCreatorProfile, useMyChallenges, useSaveCreatorProfile } from '@/hooks/use-challenges';
import { useCheckHandle } from '@/hooks/use-discovery';
import type { ChallengeSummaryView } from '@/lib/contract';
import { PressScale, Stagger } from '@/motion';

import { at, errorMessage, statusName, templateName } from './format';

export function StudioHome() {
  const profile = useCreatorProfile();
  if (profile === undefined) return <StudioScreen title="Studio">{null}</StudioScreen>;
  if (profile === null) return <ProfileSetup />;
  return <Challenges name={profile.displayName} handle={profile.handle} />;
}

function Challenges({ name, handle }: { name: string; handle: string }) {
  const mine = useMyChallenges();
  const running = mine?.filter((c) => c.status === 'published' || c.status === 'live') ?? [];
  const drafts = mine?.filter((c) => c.status === 'draft') ?? [];
  const past = mine?.filter((c) => c.status === 'ended' || c.status === 'cancelled') ?? [];

  return (
    <StudioScreen kicker={at(handle)} title={name} footer={<PrimaryButton title="New challenge" onPress={() => router.push('/studio/new')} />}>
      {mine?.length === 0 ? <Caption>No challenges yet.</Caption> : null}
      <List title="Running" items={running} />
      <List title="Drafts" items={drafts} />
      <List title="Past" items={past} />
    </StudioScreen>
  );
}

function List({ title, items }: { title: string; items: ChallengeSummaryView[] }) {
  if (!items.length) return null;
  return (
    <Section title={title}>
      <Card style={styles.list}>
        <Stagger from={6}>
          {items.map((c, i) => (
            <View key={c.challengeId}>
              {i > 0 ? <Hairline /> : null}
              <Row c={c} />
            </View>
          ))}
        </Stagger>
      </Card>
    </Section>
  );
}

function Row({ c }: { c: ChallengeSummaryView }) {
  const meta = [templateName(c.config.templateId), statusName[c.status], c.joinCode, c.status === 'draft' ? null : `${c.entrantCount} joined`]
    .filter(Boolean)
    .join(' · ');
  return (
    <PressScale
      accessibilityRole="button"
      haptic="tap"
      scaleTo={0.98}
      onPress={() => router.push(hrefFor(c))}>
      <View style={styles.row}>
        <View style={styles.flex}>
          <Txt variant="bodyStrong" color={c.config.title ? G.ink : G.inkSoft} numberOfLines={1}>
            {c.config.title || 'Untitled'}
          </Txt>
          <Txt variant="small" color={G.inkSoft}>
            {meta}
          </Txt>
        </View>
        <Txt variant="name" color={G.inkSoft}>
          ›
        </Txt>
      </View>
    </PressScale>
  );
}

// Drafts open in the editor, running challenges in the host console, finished ones in the recap.
function hrefFor(c: ChallengeSummaryView): Href {
  if (c.status === 'draft') return { pathname: '/studio/[id]', params: { id: c.challengeId } };
  if (c.status === 'ended' || c.status === 'cancelled') return `/studio/recap/${c.challengeId}` as Href;
  return `/studio/run/${c.challengeId}` as Href;
}

function ProfileSetup() {
  const save = useSaveCreatorProfile();
  const [name, setName] = useState('');
  const [handle, setHandle] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const check = useCheckHandle(handle.trim() ? handle : null);
  const problem = handle.trim() && check && !check.available ? (check.problem ?? 'That handle is taken.') : null;
  const ready = name.trim().length > 0 && check?.available === true && !saving;

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      await save({ displayName: name.trim(), handle: handle.trim() });
    } catch (e) {
      setError(errorMessage(e, 'That didn’t save. Try again.'));
      setSaving(false);
    }
  };

  return (
    <StudioScreen title="Your studio" footer={<PrimaryButton title={saving ? 'Saving…' : 'Continue'} disabled={!ready} onPress={submit} />}>
      <View style={studio.gap}>
        <Field label="Name" value={name} onChange={setName} placeholder="Danny" autoFocus maxLength={40} />
        <Field
          label="Handle"
          value={handle}
          onChange={(t) => setHandle(t.replace(/\s/g, '').toLowerCase())}
          placeholder="@danny"
          prefix="@"
          maxLength={21}
        />
        {problem || error ? <Caption color={G.bad}>{problem ?? error}</Caption> : null}
      </View>
    </StudioScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  list: { paddingVertical: Space.s, gap: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.m,
    minHeight: 64,
    paddingVertical: Space.s,
  },
});
