import { useEffect, useMemo, useRef, useState } from 'react';
import { type LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Txt } from '@/components/signal/txt';
import { FontFamily, Palette, Space } from '@/constants/signal';
import type { RoomPulse, RoomPulseTeam } from '@/lib/contract-pulse';
import { THINKING, teamIndexFromLabel, teamStyle } from '@/lib/teams';
import { Haptic, useReduced } from '@/motion';

const TIP_H = 44;
const styleOf = (t: RoomPulseTeam) => teamStyle(t.label, teamIndexFromLabel(t.label));
const SHAPE: Record<number, [number, number][]> = {
  1: [[0, 0]],
  2: [[-0.5, 0], [0.5, 0]],
  3: [[0, -0.577], [-0.5, 0.289], [0.5, 0.289]],
  4: [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]],
};
function shape(n: number): [number, number][] {
  if (SHAPE[n]) return SHAPE[n];
  const cols = Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / cols);
  return Array.from({ length: n }, (_, i) => [(i % cols) - (cols - 1) / 2, Math.floor(i / cols) - (rows - 1) / 2]);
}
const ordinal = (n: number) => n + (['th', 'st', 'nd', 'rd'][((n % 100) - 20) % 10] || ['th', 'st', 'nd', 'rd'][n % 100] || 'th');
const list = (a: string[]) => (a.length < 2 ? a.join('') : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`);
const size = (t: RoomPulseTeam) => Math.max(1, t.memberCount ?? t.memberFirstNames.length);
// Dots lit one by one as members lock; the whole cluster once the team has.
const litCount = (t: RoomPulseTeam) => (t.lockedAt !== null ? size(t) : Math.min(size(t), t.lockedCount ?? 0));

type Spot = { key: string; x: number; y: number; d: number; base: string; color: string; lit: boolean; dim: boolean; letter?: string };
type Hit = { team: RoomPulseTeam; names: string; x: number; y: number; r: number };

function Dot({ spot }: { spot: Spot }) {
  const reduced = useReduced();
  const lit = useSharedValue(spot.lit ? 1 : 0);
  const dim = useSharedValue(spot.dim ? 0.4 : 1);
  const x = useSharedValue(spot.x);
  const y = useSharedValue(spot.y);
  useEffect(() => {
    lit.set(withTiming(spot.lit ? 1 : 0, { duration: 180 }));
    dim.set(withTiming(spot.dim ? 0.4 : 1, { duration: 200 }));
    x.set(reduced ? spot.x : withTiming(spot.x, { duration: 240 }));
    y.set(reduced ? spot.y : withTiming(spot.y, { duration: 240 }));
  }, [spot.lit, spot.dim, spot.x, spot.y, reduced, lit, dim, x, y]);
  const place = useAnimatedStyle(() => ({ opacity: dim.get(), transform: [{ translateX: x.get() - spot.d / 2 }, { translateY: y.get() - spot.d / 2 }] }));
  const fill = useAnimatedStyle(() => ({ opacity: lit.get() }));
  const round = { width: spot.d, height: spot.d, borderRadius: spot.d / 2 };
  return (
    <Animated.View entering={FadeIn.duration(180)} style={[styles.dot, round, { backgroundColor: spot.base }, place]}>
      <Animated.View style={[StyleSheet.absoluteFill, round, { backgroundColor: spot.color }, fill]} />
      {spot.letter ? (
        <Text maxFontSizeMultiplier={1} style={[styles.letter, { fontSize: spot.d * 0.42 }]}>
          {spot.letter}
        </Text>
      ) : null}
    </Animated.View>
  );
}

// The room around you, from live:roomPulse (prototype A): every team a tight cluster of dots, yours pinned left in
// orange with initials. Thinking is stone, a lock lights the team's colour in one beat, and after the reveal the
// teams that missed dim. One whisper line, at most every 3 s. Hold a cluster for its names.
export function RoomPulseField({
  pulse,
  myName,
  meLocked,
  solo,
  showCount = true,
}: {
  pulse: RoomPulse;
  myName: string | null;
  meLocked: boolean;
  solo: boolean;
  showCount?: boolean;
}) {
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const [held, setHeld] = useState<Hit | null>(null);
  const unit = solo ? 'players' : 'teams';
  const reveal = pulse.phase === 'reveal' || pulse.phase === 'finished';
  const mine = pulse.teams.find((t) => t.id === pulse.myTeamId) ?? null;
  const crowd = pulse.teams.filter((t) => t !== mine);
  const total = pulse.teams.length;
  const locked = pulse.teams.filter((t) => t.lockedAt !== null).length;
  const got = pulse.teams.filter((t) => t.correct).length;

  const whisper = useWhisper(pulse, mine, solo);
  useBountyHaptic(pulse.spotsLeft);

  const { spots, hits, capTop } = useMemo(() => {
    const spots: Spot[] = [];
    const hits: Hit[] = [];
    let capTop: number | null = null;
    if (!box || box.w < 40 || box.h < 24) return { spots, hits, capTop };
    if (total === 0) {
      const n = Math.max(1, pulse.joined);
      const cols = Math.max(1, Math.ceil(Math.sqrt((n * box.w) / box.h)));
      const pitch = Math.min(box.w / cols, box.h / Math.ceil(n / cols));
      const d = Math.min(16, pitch * 0.46);
      const rows = Math.ceil(n / cols);
      const x0 = (box.w - cols * pitch) / 2 + pitch / 2;
      const y0 = (box.h - rows * pitch) / 2 + pitch / 2;
      for (let k = 0; k < n; k++) {
        const color = k === 0 ? Palette.ember : Palette.paper;
        spots.push({ key: `seat-${k}`, x: x0 + (k % cols) * pitch, y: y0 + Math.floor(k / cols) * pitch, d, base: color, color, lit: true, dim: false });
      }
      return { spots, hits, capTop };
    }
    const pinW = mine ? Math.min(96, box.w * 0.28) : 0;
    if (mine) {
      const d = Math.max(10, Math.min(30, box.h * 0.22, pinW * 0.3));
      const names = [myName ?? mine.memberFirstNames[0] ?? 'You', ...mine.memberFirstNames.filter((n) => n !== myName)].slice(0, size(mine));
      const lit = litCount(mine);
      const px = pinW / 2;
      const py = box.h / 2;
      shape(size(mine)).forEach(([ox, oy], i) => {
        const me = i === 0;
        spots.push({
          key: `mine-${i}`,
          x: px + ox * d * 1.2,
          y: py + oy * d * 1.2,
          d,
          base: THINKING,
          color: Palette.ember,
          lit: me ? meLocked : i <= lit - (meLocked ? 1 : 0),
          dim: reveal && mine.correct === false,
          letter: names[i]?.[0]?.toUpperCase(),
        });
      });
      hits.push({ team: mine, names: list(names.filter(Boolean)), x: px, y: py, r: d * 1.4 });
      capTop = Math.min(box.h - 17, py + Math.max(...shape(size(mine)).map(([, oy]) => oy)) * d * 1.2 + d / 2 + Space.s);
    }
    const w = box.w - pinW - (mine ? Space.m : 0);
    const left = box.w - w;
    const n = Math.max(1, crowd.length);
    const cols = Math.min(n, Math.max(1, Math.ceil(Math.sqrt((n * w) / box.h))));
    const rows = Math.ceil(n / cols);
    const pitch = Math.min(w / cols, box.h / rows);
    const d = Math.max(4, Math.min(13, pitch * 0.3));
    crowd.forEach((t, i) => {
      const row = Math.floor(i / cols);
      const inRow = row === rows - 1 ? n - row * cols : cols;
      const cx = left + w / 2 + ((i % cols) - (inRow - 1) / 2) * pitch;
      const cy = box.h / 2 + (row - (rows - 1) / 2) * pitch;
      const tint = styleOf(t).ink;
      const lit = litCount(t);
      shape(size(t)).forEach(([ox, oy], m) => {
        spots.push({ key: `${t.id}-${m}`, x: cx + ox * d * 1.2, y: cy + oy * d * 1.2, d, base: THINKING, color: tint, lit: m < lit, dim: reveal && !t.correct });
      });
      hits.push({ team: t, names: list(t.memberFirstNames), x: cx, y: cy, r: Math.max(22, pitch / 2) });
    });
    return { spots, hits, capTop };
  }, [box, total, pulse.joined, mine, crowd, myName, meLocked, reveal]);

  const count =
    total === 0
      ? `${pulse.joined} here`
      : reveal
        ? `${got} of ${total} ${unit} got it`
        : pulse.phase === 'question'
          ? `${locked} of ${total} ${unit} locked`
          : `${total} ${unit} · ${pulse.joined} here`;
  const team = mine && !solo ? styleOf(mine).name : null;

  return (
    <View style={styles.wrap}>
      {showCount ? (
        <Txt variant="label" color={Palette.paperMuted} accessibilityLiveRegion="polite">
          {count}
        </Txt>
      ) : null}
      <View style={styles.field} onLayout={(e: LayoutChangeEvent) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
        {spots.map((s) => (
          <Dot key={s.key} spot={s} />
        ))}
        {hits.map((h) => (
          <Pressable
            key={`hit-${h.team.id}`}
            accessibilityRole="text"
            accessibilityLabel={`${styleOf(h.team).name}: ${h.names}`}
            delayLongPress={250}
            onLongPress={() => setHeld(h)}
            onPressOut={() => setHeld(null)}
            onHoverIn={() => setHeld(h)}
            onHoverOut={() => setHeld(null)}
            style={[styles.hit, { left: h.x - h.r, top: h.y - h.r, width: h.r * 2, height: h.r * 2, borderRadius: h.r }]}
          />
        ))}
        {team && capTop !== null ? (
          <Txt variant="caption" color={Palette.paperMuted} numberOfLines={1} style={[styles.pinCap, { top: capTop, width: Math.min(96, (box?.w ?? 0) * 0.28) }]}>
            {team}
          </Txt>
        ) : null}
        {held && box ? (
          <Animated.View
            entering={FadeIn.duration(120)}
            exiting={FadeOut.duration(120)}
            pointerEvents="none"
            style={[
              styles.tip,
              {
                left: Math.max(0, Math.min(box.w - 240, held.x - 120)),
                top: held.y + held.r + TIP_H + 4 <= box.h ? held.y + held.r + 4 : Math.max(0, held.y - held.r - TIP_H - 4),
              },
            ]}>
            <Txt variant="caption" color={Palette.paper} numberOfLines={2} style={styles.tipText}>
              {solo ? held.names : `${styleOf(held.team).name} · ${held.names}`}
            </Txt>
          </Animated.View>
        ) : null}
      </View>
      <View style={styles.whisper}>
        {whisper ? (
          <Animated.View key={whisper} entering={FadeIn.duration(150)} exiting={FadeOut.duration(150)} style={StyleSheet.absoluteFill}>
            <Txt variant="caption" color={Palette.paperMuted} numberOfLines={1}>
              {whisper}
            </Txt>
          </Animated.View>
        ) : null}
      </View>
    </View>
  );
}

// "Team Sage locked. 11 still thinking." Other teams' locks, newest wins, at most one line every 3 s.
function useWhisper(pulse: RoomPulse, mine: RoomPulseTeam | null, solo: boolean) {
  const [line, setLine] = useState<{ q: number | null; text: string } | null>(null);
  const prev = useRef<{ q: number | null; locks: Map<string, number | null> } | null>(null);
  const queued = useRef<RoomPulseTeam | null>(null);
  const shownAt = useRef(-Infinity);
  const thinking = pulse.teams.filter((t) => t.lockedAt === null).length;
  const name = (t: RoomPulseTeam) => (solo ? (t.memberFirstNames[0] ?? 'Someone') : styleOf(t).name);
  const live = pulse.phase === 'question';

  useEffect(() => {
    const before = prev.current?.q === pulse.questionIndex ? prev.current.locks : null;
    if (!before) queued.current = null;
    prev.current = { q: pulse.questionIndex, locks: new Map(pulse.teams.map((t) => [t.id, t.lockedAt])) };
    if (!live || !before) return;
    const fresh = pulse.teams.filter((t) => t.id !== mine?.id && t.lockedAt !== null && before.get(t.id) === null);
    if (fresh.length) queued.current = fresh.reduce((a, b) => ((b.lockedAt ?? 0) > (a.lockedAt ?? 0) ? b : a));
  }, [pulse.teams, pulse.questionIndex, live, mine?.id]);

  const all = solo ? 'player' : 'team';
  const q = pulse.questionIndex;
  useEffect(() => {
    if (!live) return;
    const tick = () => {
      const t = queued.current;
      if (!t || Date.now() - shownAt.current < 3000) return;
      queued.current = null;
      shownAt.current = Date.now();
      setLine({ q, text: `${name(t)} locked. ${thinking ? `${thinking} still thinking.` : `Every ${all} is in.`}` });
    };
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  });

  if (pulse.phase === 'reveal') {
    const right = pulse.teams.filter((t) => t.correct).sort((a, b) => (a.lockedAt ?? Infinity) - (b.lockedAt ?? Infinity));
    const rank = mine ? right.findIndex((t) => t.id === mine.id) + 1 : 0;
    const you = solo ? 'You were' : 'Your team was';
    if (rank === 1 && right.length === 1) return solo ? 'Only you got it.' : 'Only your team got it.';
    if (rank === 1) return `${you} fastest of ${right.length}.`;
    if (rank > 1) return `${you} ${ordinal(rank)} of ${right.length} to get it.`;
    return right.length ? `Fastest: ${name(right[0])}.` : 'Nobody got this one.';
  }
  return live && line?.q === q ? line.text : null;
}

// A bounty spot being taken is the only crowd event that buzzes.
function useBountyHaptic(spotsLeft: number | null) {
  const last = useRef(spotsLeft);
  useEffect(() => {
    if (last.current !== null && spotsLeft !== null && spotsLeft < last.current) Haptic.tap();
    last.current = spotsLeft;
  }, [spotsLeft]);
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignSelf: 'stretch', gap: Space.s, minHeight: 0 },
  field: { flex: 1, minHeight: 56 },
  dot: { position: 'absolute', left: 0, top: 0, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  letter: { fontFamily: FontFamily.uiSemi, color: Palette.onAccent },
  hit: { position: 'absolute' },
  tip: { position: 'absolute', width: 240, alignItems: 'center' },
  tipText: { backgroundColor: Palette.card, borderRadius: 10, paddingHorizontal: Space.m, paddingVertical: Space.s, overflow: 'hidden', boxShadow: '0 4px 16px rgba(22,21,19,0.10)' },
  pinCap: { position: 'absolute', left: 0, textAlign: 'center' },
  whisper: { height: 17 },
});
