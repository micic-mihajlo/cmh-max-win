import { useCameraPermissions } from 'expo-camera';
import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { Linking, View } from 'react-native';

import { ManualCode, ScanCamera } from '@/components/share/scan';
import { Palette } from '@/constants/signal';
import { Haptic } from '@/motion';

// Scan to join: a Signal QR (share URL, cmhmaxwin://c/<CODE> or a bare code) lands in /c/<CODE>.
// The camera is asked for only when the player taps Allow; a denied camera keeps manual entry one tap away.
export default function ScanRoute() {
  const [permission, requestPermission] = useCameraPermissions();
  const [manual, setManual] = useState(false);

  const join = (code: string) => {
    Haptic.success();
    router.replace(`/c/${code}` as Href);
  };
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  if (!permission) return <View style={{ flex: 1, backgroundColor: Palette.ink }} />;
  if (permission.granted && !manual) return <ScanCamera onCode={join} onClose={close} onManual={() => setManual(true)} />;

  const camera = permission.granted ? 'manual' : permission.canAskAgain ? 'ask' : process.env.EXPO_OS === 'web' ? 'off' : 'denied';
  return (
    <ManualCode
      camera={camera}
      onCode={join}
      onClose={close}
      onAllow={requestPermission}
      onSettings={() => Linking.openSettings()}
      onScan={() => setManual(false)}
    />
  );
}
