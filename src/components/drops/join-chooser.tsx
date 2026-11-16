import { router } from 'expo-router';
import { Linking, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/signal/backdrop';
import { Button } from '@/components/signal/primitives';
import { Txt } from '@/components/signal/txt';
import { Wordmark } from '@/components/wordmark';
import { FontFamily, Palette, Radius, Space } from '@/constants/signal';

// Expo Go only loads this project's updates for members of the owning Expo account, so it's a team-only path.
const EXPO_GO_URL = 'exp://u.expo.dev/e7418053-b72f-4c96-9d50-d13174da4c76/--/join';
// Turn on once TestFlight Beta Review approves the public link.
const TESTFLIGHT_URL: string | null = null;

// Web landing for the host QR: the code big, the browser as the way in.
export function JoinChooser({ code }: { code: string }) {
  return (
    <Screen
      contentStyle={styles.center}
      footer={
        <View style={styles.footer}>
          <Button title="Play in the browser" onPress={() => router.replace({ pathname: '/join', params: { code } })} />
          {TESTFLIGHT_URL ? <Button title="Get the SIGNAL app (TestFlight)" variant="secondary" onPress={() => Linking.openURL(TESTFLIGHT_URL)} /> : null}
          <Txt variant="small" color={Palette.paperMuted} style={styles.text} onPress={() => Linking.openURL(`${EXPO_GO_URL}/${code}?channel-name=expo-go`)}>
            Team: open in Expo Go
          </Txt>
        </View>
      }>
      <Wordmark style={styles.brand} />
      <Txt variant="body" color={Palette.paperMuted} style={styles.text}>
        Your code
      </Txt>
      <View style={styles.tiles}>
        {code.split('').map((ch, i) => (
          <View key={i} style={styles.tile}>
            <Txt style={styles.letter}>{ch}</Txt>
          </View>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flexGrow: 1, justifyContent: 'center', gap: Space.l },
  brand: { alignSelf: 'center' },
  text: { textAlign: 'center' },
  footer: { gap: Space.m },
  tiles: { flexDirection: 'row', gap: 10, alignSelf: 'center' },
  tile: {
    width: 64,
    height: 80,
    borderRadius: Radius.m,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.hairline,
    backgroundColor: Palette.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letter: { fontFamily: FontFamily.uiBold, fontSize: 44, lineHeight: 52, color: Palette.paper },
});
