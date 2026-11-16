import { useState } from 'react';
import { Pressable, StyleSheet, TextInput } from 'react-native';

import { Screen } from '@/components/signal/backdrop';
import { CodeCells } from '@/components/signal/code-cells';
import { Button } from '@/components/signal/primitives';
import { Txt } from '@/components/signal/txt';
import { Wordmark } from '@/components/wordmark';
import { Space } from '@/constants/signal';
import { parseJoinCode } from '@/lib/join-code';

import { isAppClip, promptFullApp } from '../../../modules/app-clip';

// The App Clip's front door when it opens without a challenge link: type the code shown on stream.
export function ClipCodeEntry({ onCode }: { onCode: (code: string) => void }) {
  const [draft, setDraft] = useState('');
  const change = (text: string) => {
    const next = text.replace(/[^a-z0-9]/gi, '').toUpperCase();
    setDraft(next);
    const code = parseJoinCode(next);
    if (code) onCode(code);
  };
  return (
    <Screen contentStyle={styles.center} footer={isAppClip ? <Button title="Get the full SIGNAL app" variant="ghost" onPress={promptFullApp} /> : null}>
      <Wordmark style={styles.brand} />
      <Txt variant="title" style={styles.text}>
        Enter the code on stream
      </Txt>
      <Pressable accessibilityLabel="Challenge code">
        <CodeCells value={draft} />
        <TextInput
          autoFocus
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={4}
          value={draft}
          onChangeText={change}
          style={styles.input}
        />
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flexGrow: 1, justifyContent: 'center', gap: Space.xl },
  brand: { alignSelf: 'center' },
  text: { textAlign: 'center' },
  input: { ...StyleSheet.absoluteFill, opacity: 0.02, color: 'transparent' },
});
