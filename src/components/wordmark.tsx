import { StyleSheet, View, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Txt } from '@/components/signal/txt';
import { FontFamily, Palette } from '@/constants/signal';

const pieces = [
  'M65.975 27.186A17 17 0 0 0 33.436 29.176',
  'M33.436 36.824A17 17 0 0 0 50 50 A17 17 0 0 1 66.564 63.176',
  'M66.564 70.824A17 17 0 0 1 34.025 72.814',
];

export function SignalMark({ size = 24 }: { size?: number; mono?: boolean }) {
  return (
    <Svg width={(size * 50) / 84} height={size} viewBox="25 8 50 84" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {pieces.map((d, i) => (
        <Path key={i} d={d} fill="none" stroke={Palette.inkOnPaper} strokeWidth={15} />
      ))}
    </Svg>
  );
}

export function Wordmark({ size = 22, style }: { size?: number; style?: ViewStyle }) {
  return (
    <View accessible accessibilityRole="header" accessibilityLabel="Signal" style={[styles.row, { gap: size * 0.3 }, style]}>
      <SignalMark size={size} />
      <Txt style={[styles.word, { fontSize: size * 0.88, lineHeight: size }]}>Signal</Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  word: { fontFamily: FontFamily.display, color: Palette.inkOnPaper },
});
