import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Fonts } from '@/constants/theme';
import { PaperColors, PressScale } from '@/motion';

// The lab renders in Paper & Type (DIRECTION.md). Primitives take colors from MotionColorsProvider.
export const C = PaperColors;

export function Section({ title, note, children }: { title: string; note: string; children: ReactNode }) {
  return (
    <View style={ui.section}>
      <Text style={ui.label}>{title}</Text>
      <Text style={ui.note}>{note}</Text>
      <View style={ui.stage}>{children}</View>
    </View>
  );
}

export function Chip({ label, onPress, tone = 'quiet' }: { label: string; onPress: () => void; tone?: 'quiet' | 'action' }) {
  return (
    <PressScale onPress={onPress} accessibilityRole="button" style={[ui.chip, tone === 'action' && ui.chipAction]}>
      <Text style={[ui.chipText, tone === 'action' && ui.chipTextAction]}>{label}</Text>
    </PressScale>
  );
}

export function Row({ children }: { children: ReactNode }) {
  return <View style={ui.row}>{children}</View>;
}

export const ui = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.canvas },
  title: { fontFamily: Fonts.serif, fontSize: 34, lineHeight: 40, fontWeight: '700', color: C.ink },
  title2: { fontFamily: Fonts.serif, fontSize: 22, lineHeight: 28, fontWeight: '600', color: C.ink },
  body: { fontSize: 17, lineHeight: 26, color: C.ink },
  callout: { fontSize: 15, lineHeight: 22, color: C.muted },
  section: { gap: 8, paddingVertical: 24, borderTopWidth: 1, borderTopColor: C.hairline },
  label: { fontSize: 15, lineHeight: 20, fontWeight: '600', color: C.ink },
  note: { fontSize: 15, lineHeight: 22, color: C.muted },
  stage: { marginTop: 16, gap: 16 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 16,
    height: 44,
    justifyContent: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.hairline,
    backgroundColor: C.card,
  },
  chipAction: { backgroundColor: C.accent, borderColor: C.accent },
  chipText: { fontSize: 15, fontWeight: '600', color: C.ink },
  chipTextAction: { color: C.onAccent },
  card: { borderRadius: 16, backgroundColor: C.card, borderWidth: 1, borderColor: C.hairline, padding: 16, gap: 8 },
  paper: { borderRadius: 16, backgroundColor: C.card, borderWidth: 1, borderColor: C.hairline, padding: 20, gap: 8 },
});
