import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Fonts } from '@/constants/theme';
import { Palette, PressScale } from '@/motion';

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
  screen: { flex: 1, backgroundColor: Palette.ink },
  title: { fontFamily: Fonts.serif, fontSize: 34, lineHeight: 40, fontWeight: '600', color: Palette.paper },
  title2: { fontFamily: Fonts.serif, fontSize: 22, lineHeight: 28, color: Palette.paper },
  body: { fontSize: 17, lineHeight: 26, color: Palette.paper },
  callout: { fontSize: 15, lineHeight: 22, color: Palette.muted },
  section: { gap: 6, paddingVertical: 22, borderTopWidth: 1, borderTopColor: Palette.hairline },
  label: { fontSize: 12, lineHeight: 16, letterSpacing: 1.2, fontWeight: '600', textTransform: 'uppercase', color: Palette.brass },
  note: { fontSize: 15, lineHeight: 22, color: Palette.muted },
  stage: { marginTop: 12, gap: 14 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    height: 40,
    justifyContent: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Palette.hairline,
    backgroundColor: Palette.panel,
  },
  chipAction: { backgroundColor: Palette.ember, borderColor: Palette.ember },
  chipText: { fontSize: 15, fontWeight: '600', color: Palette.paper },
  chipTextAction: { color: Palette.ink },
  card: { borderRadius: 14, backgroundColor: Palette.panel, borderWidth: 1, borderColor: Palette.hairline, padding: 16, gap: 6 },
  paper: { borderRadius: 12, backgroundColor: Palette.paper, padding: 20, gap: 6 },
});
