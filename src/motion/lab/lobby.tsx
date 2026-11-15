import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LAB_ROOM_CODE, labCrew } from '@/mocks/motion-fixtures';
import { Enter, InviteCode, Palette, PressScale, RoleColor, RoleInitial, RoleLabel, Seal } from '@/motion';

import { ui } from './ui';

// Lobby: the code deals in, then Ravi and Lena claim their seats on a timer (mock backend).
export default function LabLobby() {
  const insets = useSafeAreaInsets();
  const [claimed, setClaimed] = useState(1);

  useEffect(() => {
    const a = setTimeout(() => setClaimed(2), 1400);
    const b = setTimeout(() => setClaimed(3), 2600);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, []);

  const ready = claimed === 3;
  return (
    <View style={[ui.screen, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 20, paddingHorizontal: 20 }]}>
      <Text style={ui.label}>Case 01 · The Aurora Seed</Text>
      <Text style={[ui.title, { marginTop: 6 }]}>Your crew</Text>
      <Text style={[ui.callout, { marginTop: 6, marginBottom: 22 }]}>Send this code to two friends.</Text>
      <InviteCode code={LAB_ROOM_CODE} />
      <View style={styles.seats}>
        {labCrew.map((m, i) => (
          <Enter key={m.memberId} index={i} delay={300} style={styles.seat}>
            <Seal locked={i < claimed} color={RoleColor[m.role!]} initial={RoleInitial[m.role!]} size={44} haptic={m.isMe} />
            <View style={{ flex: 1 }}>
              <Text style={ui.body}>{i < claimed ? (m.isMe ? `${m.name} (you)` : m.name) : 'Open seat'}</Text>
              <Text style={[ui.label, { color: RoleColor[m.role!] }]}>{RoleLabel[m.role!]}</Text>
            </View>
          </Enter>
        ))}
      </View>
      <View style={{ flex: 1 }} />
      <Text style={[ui.callout, styles.next]}>{ready ? "Everyone's here." : `Waiting for ${3 - claimed} more.`}</Text>
      <PressScale
        disabled={!ready}
        haptic="tap"
        onPress={() => router.push('/lab/case')}
        accessibilityRole="button"
        accessibilityState={{ disabled: !ready }}
        style={[styles.primary, !ready && styles.primaryOff, { transitionProperty: ['backgroundColor', 'borderColor'], transitionDuration: 200 }]}>
        <Text style={[styles.primaryText, !ready && styles.primaryTextOff]}>Start case</Text>
      </PressScale>
    </View>
  );
}

const styles = StyleSheet.create({
  seats: { marginTop: 28, gap: 12 },
  seat: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 14, backgroundColor: Palette.panel, borderWidth: 1, borderColor: Palette.hairline },
  next: { textAlign: 'center', marginBottom: 12 },
  primary: { height: 56, borderRadius: 14, borderWidth: 1, borderColor: Palette.ember, backgroundColor: Palette.ember, alignItems: 'center', justifyContent: 'center' },
  primaryOff: { backgroundColor: Palette.panel, borderColor: Palette.hairline },
  primaryTextOff: { color: Palette.faint },
  primaryText: { fontSize: 17, fontWeight: '600', color: Palette.ink },
});
