import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';

import { Txt } from '@/components/signal/txt';
import { FontFamily, Palette, Radius, Space } from '@/constants/signal';
import { Duration, Ease, PressScale } from '@/motion';

export type TileState = 'idle' | 'mine' | 'team' | 'dim' | 'correct' | 'missed';

const fill: Record<TileState, string> = {
  idle: Palette.panel,
  mine: Palette.paper,
  team: Palette.paper,
  dim: Palette.panel,
  correct: Palette.paper,
  missed: Palette.paperShade,
};
const border: Record<TileState, string> = {
  idle: Palette.hairline,
  mine: Palette.paper,
  team: Palette.paper,
  dim: Palette.hairline,
  correct: Palette.paper,
  missed: Palette.paperShade,
};

// One choice. Scales on touch-down, commits on release; the fill morphs between states instead of swapping.
export function AnswerTile({ label, state, note, onPress }: { label: string; state: TileState; note?: string | null; onPress?: () => void }) {
  const animated = useAnimatedStyle(() => {
    const t = { duration: Duration.swap, easing: Ease.out };
    return {
      backgroundColor: withTiming(fill[state], t),
      borderColor: withTiming(border[state], t),
      opacity: withTiming(state === 'dim' ? 0.4 : 1, t),
    };
  });
  const onDark = state === 'mine' || state === 'team' || state === 'correct';
  const color = onDark ? Palette.ink : state === 'missed' ? Palette.paperMuted : Palette.paper;
  return (
    <PressScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !onPress, selected: state === 'mine' || state === 'team' }}
      disabled={!onPress}
      haptic={onPress ? 'thud' : undefined}
      scaleTo={0.96}
      onPress={onPress}>
      <Animated.View style={[styles.tile, animated]}>
        <Txt
          style={[styles.label, state === 'missed' && styles.struck]}
          color={color}
          numberOfLines={3}>
          {label}
        </Txt>
        {state === 'correct' ? (
          <Txt style={styles.check} color={color} accessibilityLabel="Correct answer">
            ✓
          </Txt>
        ) : null}
        {note ? (
          <View style={styles.note}>
            {state === 'mine' ? <View style={styles.dot} /> : null}
            <Txt variant="caption" color={color}>
              {note}
            </Txt>
          </View>
        ) : null}
      </Animated.View>
    </PressScale>
  );
}

const styles = StyleSheet.create({
  tile: {
    minHeight: 64,
    borderRadius: Radius.m,
    borderWidth: 1,
    paddingHorizontal: Space.l,
    paddingVertical: Space.m,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.m,
  },
  label: { flex: 1, fontFamily: FontFamily.uiMedium, fontSize: 18, lineHeight: 24 },
  struck: { textDecorationLine: 'line-through' },
  check: { fontFamily: FontFamily.uiSemi, fontSize: 18, lineHeight: 24 },
  note: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: Radius.pill, backgroundColor: Palette.ember },
});
