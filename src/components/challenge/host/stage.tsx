import { useEffect, useState, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, useWindowDimensions, View, type ViewStyle } from 'react-native';
import Animated, { FadeIn, FadeOut, interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { ordinal } from '@/components/drops/ui';
import { joinNames } from '@/components/signal/room';
import { Txt } from '@/components/signal/txt';
import { FontFamily, Palette } from '@/constants/signal';
import type { RoomPulse, RoomPulseTeam } from '@/lib/contract-pulse';
import { teamIndexFromLabel, teamStyle } from '@/lib/teams';
import { Ease } from '@/motion';

import { useServerNow } from './use-server-now';

const THINKING = '#D3D1CC';
// The host's controls sit in a strip under the 1920x1080 canvas, so a capture cropped to the canvas never shows them.
const STRIP = 88;
const MISSED = '#E7E6E2';
const SHAPE: Record<number, [number, number][]> = {
  1: [[0, 0]],
  2: [
    [-0.5, 0],
    [0.5, 0],
  ],
  3: [
    [0, -0.577],
    [-0.5, 0.289],
    [0.5, 0.289],
  ],
  4: [
    [-0.5, -0.5],
    [0.5, -0.5],
    [-0.5, 0.5],
    [0.5, 0.5],
  ],
};

// Fills the browser window outside the app's column, so a streaming tool can capture it at 1920x1080.
const fill: ViewStyle = Platform.OS === 'web' ? ({ position: 'fixed', inset: 0, zIndex: 10 } as unknown as ViewStyle) : StyleSheet.absoluteFill;

type Round = { prompt: string | null; index: number | null; questionCount: number; opensAt: number | null; correctText: string | null };

const nameOf = (t: RoomPulseTeam) => teamStyle(t.label, teamIndexFromLabel(t.label)).name;

// The host's stream view of an open question: every team is a cluster of dots that lights in its team's colour as its
// members lock, with the clock, the locked count, the newest locks and, with a bounty, the paid spots as they're taken.
export function Stage({ pulse, round, controls }: { pulse: RoomPulse; round: Round; controls: ReactNode }) {
  const { width, height } = useWindowDimensions();
  const u = Math.min(width / 1920, (height - STRIP) / 1080);
  const open = pulse.phase === 'question';
  const { now } = useServerNow(pulse.serverNow, open);
  const [hover, setHover] = useState<string | null>(null);

  const locked = pulse.teams.filter((t) => t.lockedAt !== null).sort((a, b) => a.lockedAt! - b.lockedAt!);
  const left = open && pulse.deadline ? Math.max(0, Math.ceil((pulse.deadline - now) / 1000)) : 0;
  const spots = open && pulse.spotsLeft ? Math.min(3, pulse.spotsLeft) : 0;
  const top = spots ? 120 : 0;

  const field = { x: 120, y: 330 + top, w: 1160, h: 680 - top };
  const n = Math.max(1, pulse.teams.length);
  const cols = Math.min(n, Math.max(1, Math.ceil(Math.sqrt((n * field.w) / field.h))));
  const rows = Math.ceil(n / cols);
  const pitch = Math.min(field.w / cols, field.h / rows);
  const d = Math.min(52, pitch * 0.3);
  const at = (i: number) => {
    const row = Math.floor(i / cols);
    return { x: field.x + field.w / 2 + ((i % cols) - (cols - 1) / 2) * pitch, y: field.y + field.h / 2 + (row - (rows - 1) / 2) * pitch };
  };
  const hovered = pulse.teams.findIndex((t) => t.id === hover);
  // Past 24 teams the field reads as a crowd; names stay one hover or hold away.
  const labelled = pulse.teams.length <= 24;

  return (
    <View style={[fill, styles.root]}>
      <View style={{ width: 1920 * u, height: 1080 * u }}>
        {open ? <Drain opensAt={round.opensAt} deadline={pulse.deadline} now={now} u={u} /> : null}
        {spots ? <Bounty spots={spots} locked={locked} opensAt={round.opensAt} u={u} /> : null}
        <View style={[styles.abs, { left: 120 * u, top: (72 + top) * u, width: 1180 * u, gap: 14 * u }]}>
          <Txt style={[styles.muted, { fontSize: 28 * u, lineHeight: 36 * u }]}>
            {round.index !== null ? 'Question ' + (round.index + 1) + ' of ' + round.questionCount : ''}
          </Txt>
          {round.prompt ? (
            <Txt style={[styles.display, { fontSize: 72 * u, lineHeight: 80 * u, letterSpacing: -2.4 * u }]} numberOfLines={2}>
              {round.prompt}
            </Txt>
          ) : null}
        </View>
        <View style={[styles.abs, styles.right, { right: 120 * u, top: 56 * u }]}>
          {open ? (
            <>
              <Txt style={[styles.display, styles.num, { fontSize: 200 * u, lineHeight: 200 * u, letterSpacing: -8 * u }]}>{left}</Txt>
              <Txt style={[styles.muted, { fontSize: 28 * u, lineHeight: 36 * u }]}>seconds left</Txt>
            </>
          ) : round.correctText ? (
            <Animated.View entering={FadeIn.duration(220)} style={styles.right}>
              <Txt style={[styles.muted, { fontSize: 28 * u, lineHeight: 36 * u }]}>The answer</Txt>
              <Txt style={[styles.display, { fontSize: 120 * u, lineHeight: 132 * u, letterSpacing: -4.5 * u }]}>{round.correctText}</Txt>
            </Animated.View>
          ) : null}
        </View>
        <View style={[styles.abs, { left: 1400 * u, top: (420 + top) * u, width: 400 * u }]}>
          <Txt style={[styles.display, styles.num, { fontSize: 160 * u, lineHeight: 160 * u, letterSpacing: -6 * u }]}>
            {open ? locked.length : pulse.teams.filter((t) => t.correct).length}
          </Txt>
          <Txt style={[styles.sub, { fontSize: 32 * u, lineHeight: 40 * u, marginTop: 6 * u }]}>
            {'of ' + pulse.teams.length + (open ? ' teams locked' : ' teams got it')}
          </Txt>
        </View>
        {open ? <Readout locked={locked} u={u} top={(700 + top) * u} /> : null}
        {pulse.teams.map((t, i) => {
          const c = at(i);
          const size = t.memberFirstNames.length || 1;
          const lit = !open ? (t.correct ? size : 0) : t.lockedAt !== null ? size : (t.lockedCount ?? 0);
          const on = teamStyle(t.label, teamIndexFromLabel(t.label)).ink;
          const off = open ? THINKING : MISSED;
          return (
            <Pressable
              key={t.id}
              accessibilityLabel={nameOf(t) + ': ' + joinNames(t.memberFirstNames)}
              onHoverIn={() => setHover(t.id)}
              onHoverOut={() => setHover((h) => (h === t.id ? null : h))}
              onPressIn={() => setHover(t.id)}
              onPressOut={() => setHover(null)}
              style={[styles.abs, { left: c.x * u - (pitch / 2) * u, top: c.y * u - (pitch / 2) * u, width: pitch * u, height: pitch * u }]}>
              {labelled ? (
                <Txt
                  numberOfLines={1}
                  style={[
                    styles.muted,
                    styles.label,
                    { top: (pitch / 2 + 0.75 * d) * u, fontSize: Math.min(22, d * 0.45) * u, lineHeight: Math.min(28, d * 0.6) * u },
                  ]}>
                  {nameOf(t).replace(/^Team /, '')}
                </Txt>
              ) : null}
              {Array.from({ length: size }, (_, m) => {
                const [ox, oy] = offsetOf(size, m);
                return (
                  <Dot
                    key={m}
                    lit={m < lit}
                    on={on}
                    off={off}
                    style={{
                      left: (pitch / 2 + ox * d * 1.2 - d / 2) * u,
                      top: (pitch / 2 + oy * d * 1.2 - d / 2 - 0.25 * d) * u,
                      width: d * u,
                      height: d * u,
                      borderRadius: (d / 2) * u,
                    }}
                  />
                );
              })}
            </Pressable>
          );
        })}
        {hovered >= 0 ? (
          <Animated.View
            entering={FadeIn.duration(120)}
            exiting={FadeOut.duration(120)}
            pointerEvents="none"
            style={[
              styles.abs,
              styles.tip,
              {
                left: at(hovered).x * u,
                top: (at(hovered).y - pitch / 2) * u,
                paddingHorizontal: 18 * u,
                paddingVertical: 12 * u,
                borderRadius: 14 * u,
              },
            ]}>
            <Txt style={[styles.strong, { fontSize: 24 * u, lineHeight: 30 * u }]}>{nameOf(pulse.teams[hovered])}</Txt>
            <Txt style={[styles.muted, { fontSize: 24 * u, lineHeight: 30 * u }]}>{joinNames(pulse.teams[hovered].memberFirstNames)}</Txt>
          </Animated.View>
        ) : null}
      </View>
      <View style={[styles.strip, { width: 1920 * u, height: STRIP }]}>
        <Txt variant="caption" color={Palette.paperMuted} style={styles.flex}>
          Host only. Crop this strip out of your stream capture.
        </Txt>
        <View style={styles.controls}>{controls}</View>
      </View>
    </View>
  );
}

function offsetOf(size: number, m: number): [number, number] {
  if (SHAPE[size]) return SHAPE[size][m];
  const a = (m / size) * Math.PI * 2 - Math.PI / 2;
  return [Math.cos(a) * 0.8, Math.sin(a) * 0.8];
}

// A dot fills in one 180 ms beat when its member locks. It's a colour change, so Reduce Motion keeps it.
function Dot({ lit, on, off, style }: { lit: boolean; on: string; off: string; style: ViewStyle }) {
  const p = useSharedValue(lit ? 1 : 0);
  useEffect(() => {
    p.set(withTiming(lit ? 1 : 0, { duration: 180, easing: Ease.out }));
  }, [lit, p]);
  const color = useAnimatedStyle(() => ({ backgroundColor: interpolateColor(p.get(), [0, 1], [off, on]) }));
  return <Animated.View style={[styles.abs, style, color]} />;
}

function Drain({ opensAt, deadline, now, u }: { opensAt: number | null; deadline: number | null; now: number; u: number }) {
  const span = deadline && opensAt ? Math.max(1, deadline - opensAt) : 1;
  const share = deadline ? Math.max(0, Math.min(1, (deadline - now) / span)) : 0;
  return (
    <View style={[styles.abs, styles.track, { left: 0, right: 0, top: 0, height: 8 * u }]}>
      <View style={[styles.drain, { width: share * 1920 * u }]} />
    </View>
  );
}

// Newest lock first: "Team Rose locked. 5th." with its names, the one before it muted under it.
function Readout({ locked, u, top }: { locked: RoomPulseTeam[]; u: number; top: number }) {
  const newest = locked.slice(-2).reverse();
  return (
    <View style={[styles.abs, { left: 1400 * u, top, width: 420 * u, gap: 18 * u }]}>
      {newest.map((t, i) => (
        <Animated.View key={t.id} entering={FadeIn.duration(200)}>
          <Txt style={[i ? styles.mutedStrong : styles.strong, { fontSize: 30 * u, lineHeight: 38 * u }]} numberOfLines={1}>
            {nameOf(t) + ' locked. ' + ordinal(locked.indexOf(t) + 1) + '.'}
          </Txt>
          {i === 0 ? (
            <Txt style={[styles.muted, { fontSize: 22 * u, lineHeight: 28 * u }]} numberOfLines={1}>
              {joinNames(t.memberFirstNames)}
            </Txt>
          ) : null}
        </Animated.View>
      ))}
    </View>
  );
}

// With a bounty, the paid spots across the top: empty until a team takes one, then its name and lock time.
function Bounty({ spots, locked, opensAt, u }: { spots: number; locked: RoomPulseTeam[]; opensAt: number | null; u: number }) {
  return (
    <View style={[styles.abs, styles.bounty, { left: 120 * u, top: 40 * u, gap: 48 * u }]}>
      {Array.from({ length: spots }, (_, i) => {
        const t = locked[i];
        return (
          <View
            key={i}
            style={{ width: 340 * u, gap: 4 * u, borderTopWidth: 2 * u, borderColor: t ? Palette.paper : Palette.hairline, paddingTop: 12 * u }}>
            <Txt style={[styles.muted, { fontSize: 22 * u, lineHeight: 28 * u }]}>{ordinal(i + 1)}</Txt>
            {t ? (
              <Animated.View entering={FadeIn.duration(180)} style={[styles.baseline, { gap: 12 * u }]}>
                <Txt style={[styles.strong, { fontSize: 30 * u, lineHeight: 38 * u }]} numberOfLines={1}>
                  {nameOf(t)}
                </Txt>
                {opensAt ? (
                  <Txt style={[styles.muted, styles.num, { fontSize: 22 * u, lineHeight: 38 * u }]}>
                    {((t.lockedAt! - opensAt) / 1000).toFixed(1) + 's'}
                  </Txt>
                ) : null}
              </Animated.View>
            ) : (
              <Txt style={[styles.mutedStrong, { fontSize: 30 * u, lineHeight: 38 * u }]}>Open</Txt>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: Palette.ink, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  strip: { flexDirection: 'row', alignItems: 'center', gap: 24, paddingHorizontal: 24, borderTopWidth: 1, borderColor: Palette.hairline },
  label: { position: 'absolute', left: 0, right: 0, textAlign: 'center' },
  abs: { position: 'absolute' },
  right: { alignItems: 'flex-end' },
  baseline: { flexDirection: 'row', alignItems: 'baseline' },
  bounty: { flexDirection: 'row' },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 24, width: 420 },
  num: { fontVariant: ['tabular-nums'] },
  display: { fontFamily: FontFamily.uiSemi, color: Palette.paper },
  strong: { fontFamily: FontFamily.uiSemi, color: Palette.paper },
  mutedStrong: { fontFamily: FontFamily.uiMedium, color: Palette.paperMuted },
  sub: { fontFamily: FontFamily.uiMedium, color: Palette.paperMuted },
  muted: { fontFamily: FontFamily.ui, color: Palette.paperMuted },
  track: { backgroundColor: Palette.hairline, overflow: 'hidden' },
  drain: { height: '100%', backgroundColor: Palette.paper },
  tip: {
    backgroundColor: Palette.card,
    transform: [{ translateX: '-50%' }, { translateY: '-100%' }],
    boxShadow: '0 0 0 1px #00000026, 0 8px 40px rgba(0,0,0,.05)',
  },
});
