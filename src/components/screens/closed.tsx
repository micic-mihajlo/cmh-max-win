import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/signal/backdrop';
import { Icon } from '@/components/signal/icon';
import { Button, Label } from '@/components/signal/primitives';
import { Txt } from '@/components/signal/txt';
import { Palette, Space } from '@/constants/signal';

export function ClosedScreen({ code, onNewCase }: { code: string; onNewCase?: () => void }) {
  return (
    <Screen contentStyle={styles.content} footer={<Button title="Start a new case" onPress={onNewCase} />}>
      <Icon name="archivebox" size={40} color={Palette.paperMuted} />
      <Label>{`Room ${code}`}</Label>
      <Txt variant="display" style={styles.center}>
        This case has closed.
      </Txt>
      <Txt variant="body" color={Palette.paperMuted} style={styles.center}>
        The room isn’t around anymore. Start a new one and invite your crew again.
      </Txt>
      <View />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: Space.m },
  center: { textAlign: 'center' },
});
