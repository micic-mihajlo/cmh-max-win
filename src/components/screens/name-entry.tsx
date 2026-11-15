import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/signal/backdrop';
import { Button, Label } from '@/components/signal/primitives';
import { Txt } from '@/components/signal/txt';
import { Palette, Radius, Space } from '@/constants/signal';

export function NameEntryScreen({ name, onContinue }: { name: string; onContinue?: () => void }) {
  return (
    <Screen footer={<Button title="Continue" disabled={!name.trim()} onPress={onContinue} />}>
      <View style={styles.top}>
        <Label color={Palette.paperMuted}>Signal</Label>
        <Txt variant="display">What should your crew call you?</Txt>
        <Txt variant="body" color={Palette.paperMuted}>
          Your crew sees this name next to your role. Nobody else does.
        </Txt>
      </View>
      <View style={styles.field}>
        <Txt variant="title" color={name ? Palette.paper : Palette.paperFaint}>
          {name || 'Your first name'}
        </Txt>
        {name ? <View style={styles.caret} /> : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { gap: Space.m, marginTop: Space.xxxl },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: Space.xl,
    paddingVertical: Space.l,
    paddingHorizontal: Space.l,
    borderRadius: Radius.m,
    borderWidth: 1,
    borderColor: Palette.ember,
    backgroundColor: Palette.panel,
  },
  caret: { width: 2, height: 26, backgroundColor: Palette.ember },
});
