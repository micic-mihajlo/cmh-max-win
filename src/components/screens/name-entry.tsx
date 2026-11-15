import { StyleSheet, TextInput, View } from 'react-native';

import { Screen } from '@/components/signal/backdrop';
import { Button, Label } from '@/components/signal/primitives';
import { Txt } from '@/components/signal/txt';
import { FontFamily, Palette, Radius, Space, Type } from '@/constants/signal';

export function NameEntryScreen({
  name,
  onChangeName,
  onContinue,
}: {
  name: string;
  onChangeName?: (name: string) => void;
  onContinue?: () => void;
}) {
  return (
    <Screen footer={<Button title="Continue" disabled={!name.trim()} onPress={onContinue} />}>
      <View style={styles.top}>
        <Label color={Palette.paperMuted}>Signal</Label>
        <Txt variant="display">What should your squad call you?</Txt>
      </View>
      <TextInput
        value={name}
        onChangeText={onChangeName}
        onSubmitEditing={name.trim() ? onContinue : undefined}
        editable={!!onChangeName}
        autoFocus={!!onChangeName}
        autoCapitalize="words"
        autoCorrect={false}
        maxLength={16}
        returnKeyType="done"
        placeholder="Your first name"
        placeholderTextColor={Palette.paperFaint}
        selectionColor={Palette.ember}
        style={styles.field}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { gap: Space.m, marginTop: Space.xxxl },
  field: {
    ...Type.title,
    fontFamily: FontFamily.display,
    color: Palette.paper,
    marginTop: Space.xl,
    paddingVertical: Space.l,
    paddingHorizontal: Space.l,
    borderRadius: Radius.m,
    borderWidth: 2,
    borderColor: Palette.paper,
    backgroundColor: Palette.panel,
  },
});
