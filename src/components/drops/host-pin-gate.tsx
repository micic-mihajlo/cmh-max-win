import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { Screen } from '@/components/signal/backdrop';
import { InkInput } from '@/components/signal/ink-input';
import { Button } from '@/components/signal/primitives';
import { Txt } from '@/components/signal/txt';
import { FontFamily, Palette, Radius, Space } from '@/constants/signal';

export const HOST_PIN = '8888';
export const HOST_UNLOCKED_KEY = 'signal.hostUnlocked';

// A stage convenience, not auth: keeps audience phones that wander onto /host out of the host flow.
export function HostPinGate({ onUnlock }: { onUnlock: () => void }) {
  const [pin, setPin] = useState('');
  const [wrong, setWrong] = useState(false);
  const submit = (value: string) => {
    if (value === HOST_PIN) return onUnlock();
    setWrong(true);
    setPin('');
  };
  return (
    <Screen footer={<Button title="Unlock" variant="primary" disabled={pin.length !== 4} onPress={() => submit(pin)} />}>
      <Txt style={styles.title}>Host PIN</Txt>
      <InkInput
        value={pin}
        onChangeText={(t) => {
          const next = t.replace(/\D/g, '').slice(0, 4);
          setWrong(false);
          setPin(next);
          if (next.length === 4) submit(next);
        }}
        onSubmitEditing={pin.length === 4 ? () => submit(pin) : undefined}
        keyboardType="number-pad"
        secureTextEntry
        autoFocus
        maxLength={4}
        accessibilityLabel="Host PIN"
        style={styles.input}
      />
      {wrong ? (
        <Txt variant="small" color={Palette.paperMuted}>
          That PIN doesn’t match.
        </Txt>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: FontFamily.uiSemi, fontSize: 32, lineHeight: 40, color: Palette.paper },
  input: {
    height: 72,
    paddingHorizontal: Space.l,
    borderRadius: Radius.m,
    borderWidth: 1.5,
    borderColor: Palette.paper,
    backgroundColor: Palette.card,
    fontFamily: FontFamily.uiSemi,
    fontSize: 32,
    letterSpacing: 12,
    color: Palette.paper,
  },
});
