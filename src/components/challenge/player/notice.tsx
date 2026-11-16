import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/signal/backdrop';
import { Button } from '@/components/signal/primitives';
import { Txt } from '@/components/signal/txt';
import { Palette, Space } from '@/constants/signal';
import { Enter } from '@/motion';

// A full-screen state with one line of context and a way home: not found, closed, cancelled, members only.
export function NoticeScreen({ eyebrow, title, text, footer }: { eyebrow?: string; title: string; text?: string; footer?: ReactNode }) {
  return (
    <Screen scroll={false} footer={footer ?? <Button title="Home" variant="secondary" onPress={() => router.replace('/')} />}>
      <View style={styles.body}>
        {eyebrow ? (
          <Enter index={0}>
            <Txt variant="label" color={Palette.paperMuted}>
              {eyebrow}
            </Txt>
          </Enter>
        ) : null}
        <Enter index={1}>
          <Txt variant="title">{title}</Txt>
        </Enter>
        {text ? (
          <Enter index={2}>
            <Txt variant="body" color={Palette.paperMuted}>
              {text}
            </Txt>
          </Enter>
        ) : null}
      </View>
    </Screen>
  );
}

export function BlankScreen() {
  return <Screen scroll={false}>{null}</Screen>;
}

const styles = StyleSheet.create({
  body: { flex: 1, justifyContent: 'center', gap: Space.s, paddingBottom: Space.xxxl },
});
