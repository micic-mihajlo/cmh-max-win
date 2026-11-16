import { router } from 'expo-router';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { Screen } from '@/components/signal/backdrop';
import { Button } from '@/components/signal/primitives';
import { Txt } from '@/components/signal/txt';
import { Wordmark } from '@/components/wordmark';
import { Palette, Radius, Space } from '@/constants/signal';

const EXPO_PAGE = 'https://signal-app-wine.vercel.app/expo';

// Web landing: two actions, no name prompt, plus a way back in while this browser holds a squad seat. /expo is a static page outside the app bundle, so it needs a full page load.
export function WebHomeScreen({ onResume }: { onResume?: () => void }) {
  const { width } = useWindowDimensions();
  return (
    <Screen
      footer={
        <>
          {onResume ? <Button title="Back to your squad" onPress={onResume} /> : null}
          <Button title="Start a game" variant={onResume ? 'secondary' : undefined} onPress={() => router.push('/host')} />
          <Button title="Open in Expo Go" variant="secondary" onPress={() => window.location.assign('/expo')} />
        </>
      }>
      <View style={styles.top}>
        <Wordmark size={32} />
        <Txt variant="display">Everyone holds a piece. Nobody solves it alone.</Txt>
      </View>
      {width >= 768 ? (
        <View style={styles.qr}>
          <View style={styles.code}>
            <QRCode value={EXPO_PAGE} size={128} color={Palette.paper} backgroundColor={Palette.card} />
          </View>
          <Txt variant="small" color={Palette.paperMuted} style={styles.flex}>
            Scan with your phone camera to play in Expo Go.
          </Txt>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { gap: Space.xl, marginTop: Space.xxxl },
  qr: { flexDirection: 'row', alignItems: 'center', gap: Space.l, marginTop: Space.xl },
  code: { padding: Space.m, borderRadius: Radius.m, backgroundColor: Palette.card, borderWidth: 1, borderColor: Palette.hairline },
  flex: { flex: 1 },
});
