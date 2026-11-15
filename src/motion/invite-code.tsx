import { StyleSheet, Text, View } from 'react-native';

import { FontFamily } from '@/constants/signal';

import { Enter } from './enter';
import { useMotionColors } from './palette';

type Props = { code: string; play?: boolean; size?: number; tileColor?: string; borderColor?: string; letterColor?: string };

// Wordle-style tiles: one big letter each, thin border. They deal in left to right, 45ms apart,
// so the eye reads the code in order.
export function InviteCode({ code, play = true, size = 64, tileColor, borderColor, letterColor }: Props) {
  const colors = useMotionColors();
  return (
    <View style={styles.row} accessible accessibilityLabel={`Room code ${code.split('').join(' ')}`}>
      {code.split('').map((ch, i) => (
        <Enter key={`${i}${ch}`} index={i} play={play} from={8} stagger={45}>
          <View
            style={[
              styles.tile,
              { width: size, height: size, backgroundColor: tileColor ?? colors.card, borderColor: borderColor ?? colors.hairline },
            ]}>
            <Text allowFontScaling={false} style={[styles.letter, { fontSize: size * 0.56, color: letterColor ?? colors.ink }]}>
              {ch}
            </Text>
          </View>
        </Enter>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  tile: { borderRadius: 10, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  letter: { fontFamily: FontFamily.displayBold, fontVariant: ['tabular-nums'] },
});
