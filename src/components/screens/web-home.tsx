import { router, type Href } from 'expo-router';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { QuietLink, YourChallenges } from '@/components/home/your-challenges';
import { Screen } from '@/components/signal/backdrop';
import { Button } from '@/components/signal/primitives';
import { Txt } from '@/components/signal/txt';
import { Wordmark } from '@/components/wordmark';
import { Palette, Radius, Space } from '@/constants/signal';

const APP_URL = 'https://signal-app-wine.vercel.app/';

// Web landing: host or join in the browser, no name prompt. The QR opens this page on a phone, so nothing to install.
export function WebHomeScreen() {
  const { width } = useWindowDimensions();
  return (
    <Screen
      footer={
        <>
          <Button title="Start a game" onPress={() => router.push('/host')} />
          <QuietLink title="Join with a code" onPress={() => router.push('/join')} />
          <QuietLink title="Create a challenge" onPress={() => router.push('/studio')} />
          <QuietLink title="Streamers" onPress={() => router.push('/showcase/streamers' as Href)} />
        </>
      }>
      <View style={styles.top}>
        <Wordmark size={32} />
        <Txt variant="display">Everyone holds a piece. Nobody solves it alone.</Txt>
      </View>
      <YourChallenges />
      {width >= 768 ? (
        <View style={styles.qr}>
          <View style={styles.code}>
            <QRCode value={APP_URL} size={128} color={Palette.paper} backgroundColor={Palette.card} />
          </View>
          <Txt variant="small" color={Palette.paperMuted} style={styles.flex}>
            Scan with your phone camera to play in the browser. Nothing to install.
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
