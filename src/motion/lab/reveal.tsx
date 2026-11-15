import { router, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { SeasonPackState } from '@/lib/contract';
import { labReveal } from '@/mocks/motion-fixtures';
import { Enter, Haptic, PackButton, Palette, PressScale, RoleColor, RoleLabel, Stagger } from '@/motion';

import { ui } from './ui';

// Reveal: headline settles, then credits stagger in one per player, then the season shelf.
export default function LabReveal() {
  const insets = useSafeAreaInsets();
  const [pack, setPack] = useState<SeasonPackState>('locked');
  useEffect(() => Haptic.success(), []);

  const buy = () => {
    setPack('checkout');
    setTimeout(() => setPack('verifying'), 900);
    setTimeout(() => setPack('owned'), 4900);
  };

  return (
    <View style={ui.screen}>
      <Stack.Screen options={{ animation: 'fade', gestureEnabled: false }} />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 24, paddingBottom: insets.bottom + 32, paddingHorizontal: 20, gap: 18 }}>
        <Enter from={12}>
          <Text style={ui.label}>Solved on attempt 2</Text>
          <Text style={[ui.title, { marginTop: 8 }]}>Lab fixture: the crew got it.</Text>
          <Text style={[ui.callout, { marginTop: 8 }]}>{labReveal.why}</Text>
        </Enter>
        <View style={{ gap: 10 }}>
          <Stagger delay={350} stagger={90} from={24}>
            {labReveal.credits.map((c) => (
              <View key={c.role} style={[ui.paper, { borderLeftWidth: 4, borderLeftColor: RoleColor[c.role] }]}>
                <Text style={[ui.label, { color: '#51504F' }]}>{RoleLabel[c.role]} · {c.memberName}</Text>
                <Text style={styles.creditLine}>{c.line}</Text>
              </View>
            ))}
          </Stagger>
        </View>
        <Enter delay={700} from={16} style={[ui.card, { gap: 12 }]}>
          <Text style={ui.label}>{labReveal.teaser.title}</Text>
          <Text style={ui.callout}>{labReveal.teaser.text}</Text>
          <PackButton state={pack} onBuy={buy} price="$4.99" sandbox />
        </Enter>
        <PressScale onPress={() => router.dismissTo('/lab')} accessibilityRole="button" style={styles.back}>
          <Text style={styles.backText}>Back to the lab</Text>
        </PressScale>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  creditLine: { fontSize: 17, lineHeight: 24, color: '#3B3A3B' },
  back: { height: 48, alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 15, color: Palette.muted },
});
