import { StyleSheet, View } from 'react-native';

import { FontFamily, Palette, Radius } from '@/constants/signal';

import { Txt } from './txt';

export function CodeCells({ value, length = 4, error, size = 'l' }: { value: string; length?: number; error?: boolean; size?: 'l' | 'm' }) {
  const box = size === 'l' ? 68 : 56;
  return (
    <View style={styles.row} accessible accessibilityLabel={`Invite code ${value.split('').join(' ') || 'empty'}`}>
      {Array.from({ length }, (_, i) => {
        const ch = value[i];
        const active = i === value.length && !error;
        return (
          <View
            key={i}
            style={[
              styles.cell,
              { width: box, height: box + 12 },
              ch ? styles.filled : null,
              active && styles.active,
              error && styles.error,
            ]}>
            {ch ? (
              <Txt style={{ fontFamily: FontFamily.display, fontSize: box * 0.52, lineHeight: box * 0.72, color: Palette.paper }}>{ch}</Txt>
            ) : active ? (
              <View style={styles.caret} />
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10, justifyContent: 'center' },
  cell: {
    borderRadius: Radius.m,
    borderWidth: 1,
    borderColor: Palette.hairline,
    backgroundColor: Palette.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filled: { borderColor: '#3A3E4B', backgroundColor: Palette.panelRaised },
  active: { borderColor: Palette.ember },
  error: { borderColor: Palette.danger },
  caret: { width: 2, height: 30, backgroundColor: Palette.ember, borderRadius: 1 },
});
