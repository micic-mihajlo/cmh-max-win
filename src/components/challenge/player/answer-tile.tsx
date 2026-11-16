import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';

import { FontFamily, Palette, Radius, Space, Type } from '@/constants/signal';
import { Duration, Ease, PressScale, useReduced } from '@/motion';

const settle = { damping: 20, stiffness: 240, mass: 0.8 };

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
  const reduced = useReduced();
  const scale = useSharedValue(1);
  const was = useRef(state);
  useEffect(() => {
    const from = was.current;
    was.current = state;
    if (reduced || from !== 'idle' || (state !== 'mine' && state !== 'team')) return;
    scale.set(withSequence(withTiming(1.02, { duration: 90, easing: Ease.out }), withSpring(1, settle)));
  }, [state, reduced, scale]);
  const onDark = state === 'mine' || state === 'team' || state === 'correct';
  const color = onDark ? Palette.ink : state === 'missed' ? Palette.paperMuted : Palette.paper;
  const committed = state === 'mine' || state === 'team';
  const ink = useAnimatedStyle(() => ({ color: committed ? color : withTiming(color, { duration: Duration.bleed, easing: Ease.out }) }));
  const animated = useAnimatedStyle(() => {
    const t = { duration: Duration.bleed, easing: Ease.out };
    return {
      backgroundColor: committed ? fill[state] : withTiming(fill[state], t),
      borderColor: committed ? border[state] : withTiming(border[state], t),
      opacity: withTiming(state === 'dim' ? 0.4 : 1, t),
      transform: [{ scale: scale.get() }],
    };
  });
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
        <Animated.Text style={[styles.label, state === 'missed' && styles.struck, ink]} numberOfLines={3} maxFontSizeMultiplier={1.4}>
          {label}
        </Animated.Text>
        {state === 'correct' ? (
          <Animated.Text style={[styles.check, ink]} accessibilityLabel="Correct answer">
            ✓
          </Animated.Text>
        ) : null}
        {note ? (
          <View style={styles.note}>
            {state === 'mine' ? <View style={styles.dot} /> : null}
            <Animated.Text style={[Type.caption, ink]} maxFontSizeMultiplier={1.4}>
              {note}
            </Animated.Text>
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
