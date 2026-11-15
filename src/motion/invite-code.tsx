import { StyleSheet, Text, View } from 'react-native';

import { Fonts } from '@/constants/theme';

import { Enter } from './enter';
import { Palette } from './palette';

type Props = { code: string; play?: boolean; size?: number };

// The four letters deal in left to right, 50ms apart, so the eye reads the code in order.
export function InviteCode({ code, play = true, size = 64 }: Props) {
  return (
    <View style={styles.row} accessible accessibilityLabel={`Room code ${code.split('').join(' ')}`}>
      {code.split('').map((ch, i) => (
        <Enter key={`${i}${ch}`} index={i} play={play} from={10} stagger={50}>
          <View style={[styles.tile, { width: size, height: size * 1.15 }]}>
            <Text allowFontScaling={false} style={[styles.letter, { fontSize: size * 0.55 }]}>
              {ch}
            </Text>
          </View>
        </Enter>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10, justifyContent: 'center' },
  tile: {
    borderRadius: 12,
    backgroundColor: Palette.panel,
    borderWidth: 1,
    borderColor: Palette.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letter: { fontFamily: Fonts.serif, fontWeight: '600', color: Palette.paper, fontVariant: ['tabular-nums'] },
});
