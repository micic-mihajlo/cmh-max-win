import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { Screen } from '@/components/signal/backdrop';
import { Button } from '@/components/signal/primitives';
import { Txt } from '@/components/signal/txt';
import { FontFamily, Palette, Radius, Space, Type } from '@/constants/signal';
import type { PlayerChallengeView } from '@/lib/contract';
import { Enter } from '@/motion';

import { money } from './format';

function facts(c: PlayerChallengeView) {
  const out = [c.teamSize === 1 ? 'Solo' : `Teams of ${c.teamSize}`];
  if (c.entrantCount > 0) out.unshift(c.entrantCount === 1 ? '1 player in' : `${c.entrantCount} players in`);
  if (c.poolCents > 0) out.push(`${money(c.poolCents)} pool${c.payoutAdapter === 'concept' ? ' · concept' : ''}`);
  return out.join(' · ');
}

export function ChallengeHeading({ challenge, play = true }: { challenge: PlayerChallengeView; play?: boolean }) {
  return (
    <View style={styles.top}>
      <Enter index={0} play={play}>
        <Txt variant="label" color={Palette.paperMuted}>
          {`${challenge.creator.displayName} · ${challenge.creator.handle}`}
        </Txt>
      </Enter>
      <Enter index={1} play={play}>
        <Txt variant="title" numberOfLines={2}>
          {challenge.title}
        </Txt>
      </Enter>
      {challenge.blurb ? (
        <Enter index={2} play={play}>
          <Txt variant="small" color={Palette.paperMuted} numberOfLines={3}>
            {challenge.blurb}
          </Txt>
        </Enter>
      ) : null}
      <Enter index={3} play={play}>
        <Txt variant="caption" color={Palette.paperMuted}>
          {facts(challenge)}
        </Txt>
      </Enter>
    </View>
  );
}

export function JoinScreen({
  challenge,
  initialName,
  error,
  joining,
  onJoin,
}: {
  challenge: PlayerChallengeView;
  initialName: string;
  error: string | null;
  joining: boolean;
  onJoin: (name: string) => void;
}) {
  const [name, setName] = useState(initialName);
  const [focused, setFocused] = useState(false);
  const ready = name.trim().length > 0 && !joining;
  const submit = () => {
    if (ready) onJoin(name.trim());
  };

  return (
    <Screen footer={<Button title={joining ? 'Joining' : 'Join'} disabled={!ready} onPress={submit} />}>
      <ChallengeHeading challenge={challenge} />
      <Enter index={4} style={styles.field}>
        <TextInput
          value={name}
          onChangeText={setName}
          onSubmitEditing={submit}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          autoCapitalize="words"
          autoCorrect={false}
          autoFocus={!initialName}
          maxLength={24}
          returnKeyType="join"
          placeholder="Your name"
          placeholderTextColor={Palette.paperFaint}
          selectionColor={Palette.ember}
          accessibilityLabel="Your name"
          style={[styles.input, focused && styles.focused]}
        />
        <View style={styles.error}>
          {error ? (
            <Txt variant="small" color={Palette.danger} accessibilityRole="alert">
              {error}
            </Txt>
          ) : null}
        </View>
      </Enter>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { gap: Space.s, marginTop: Space.xxl },
  field: { marginTop: Space.xl, gap: Space.s },
  input: {
    ...Type.name,
    fontFamily: FontFamily.uiMedium,
    color: Palette.paper,
    height: 56,
    paddingHorizontal: Space.l,
    borderRadius: Radius.m,
    borderWidth: 1,
    borderColor: Palette.hairline,
    backgroundColor: Palette.panel,
    outlineWidth: 0,
  },
  focused: { borderColor: Palette.paper },
  error: { minHeight: 20 },
});
