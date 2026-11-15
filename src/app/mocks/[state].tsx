import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { DisplaySettingsContext } from '@/components/signal/settings';
import { Txt } from '@/components/signal/txt';
import { Palette } from '@/constants/signal';
import { gallery } from '@/mocks/load';

export default function MockStateScreen() {
  const { state } = useLocalSearchParams<{ state: string }>();
  const mock = gallery?.mockById(state);
  if (!mock) {
    return (
      <View style={styles.missing}>
        <Txt variant="title">No mock named {state}</Txt>
      </View>
    );
  }
  return (
    <DisplaySettingsContext value={{ typeScale: mock.display?.typeScale ?? 1, reduceMotion: mock.display?.reduceMotion ?? null }}>
      {mock.render()}
    </DisplaySettingsContext>
  );
}

const styles = StyleSheet.create({
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Palette.ink },
});
