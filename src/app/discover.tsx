import { router } from 'expo-router';
import { StyleSheet } from 'react-native';

import { ComingUp, OnNow } from '@/components/home/streams';
import { Screen } from '@/components/signal/backdrop';
import { TopBar } from '@/components/signal/primitives';
import { Txt } from '@/components/signal/txt';
import { PressScale } from '@/motion';

// See all from home: every game on now and coming up.
export default function DiscoverRoute() {
  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));
  return (
    <Screen
      header={
        <TopBar
          left={
            <PressScale accessibilityRole="link" haptic="tap" hitSlop={12} onPress={back} style={styles.back}>
              <Txt variant="label">Home</Txt>
            </PressScale>
          }
        />
      }>
      <OnNow all />
      <ComingUp all />
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { alignSelf: 'flex-start', minHeight: 36, justifyContent: 'center' },
});
