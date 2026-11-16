import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/signal/backdrop';
import { Icon } from '@/components/signal/icon';
import { Button } from '@/components/signal/primitives';
import { Txt } from '@/components/signal/txt';
import { JoinQR } from '@/components/share/JoinQR';
import { Palette, Space } from '@/constants/signal';
import { useShareChallenge } from '@/hooks/use-share-challenge';
import { normalizeCode } from '@/lib/share-link';

// A host's invite for one challenge: the join QR, the native share sheet, and a big-screen view to put on stream.
export default function ShareChallengeRoute() {
  const params = useLocalSearchParams<{ code: string; view?: string }>();
  const code = normalizeCode(params.code ?? '') ?? (params.code ?? '').toUpperCase();
  const [stage, setStage] = useState(params.view === 'stage');
  const { share, label } = useShareChallenge(code);

  return (
    <Screen
      contentStyle={styles.content}
      footer={
        <>
          <Button title={label} icon={<Icon name="square.and.arrow.up" size={16} color={Palette.ink} />} onPress={share} />
          <Button title={stage ? 'Show phone card' : 'Show on big screen'} variant="secondary" onPress={() => setStage((s) => !s)} />
        </>
      }>
      <View style={styles.copy}>
        <Txt variant="title" style={styles.center}>
          {stage ? 'Put this on stream' : 'Invite players'}
        </Txt>
        <Txt variant="body" color={Palette.paperMuted} style={styles.center}>
          {stage ? 'Viewers point their camera at it and land in your challenge.' : 'Share the link, or let them scan from your phone.'}
        </Txt>
      </View>
      <JoinQR code={code} variant={stage ? 'stage' : 'card'} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: 'center', gap: Space.xxl },
  copy: { gap: Space.s },
  center: { textAlign: 'center' },
});
