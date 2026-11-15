import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Palette, Radius, RoleMeta, Space } from '@/constants/signal';
import { Suspects, suspectById } from '@/constants/case01';
import type { RoomView, SuspectId } from '@/lib/contract';

import { Banner, Button } from './primitives';
import { joinNames, lockedIds, seals } from './room';
import { Seal } from './seal';
import { useMotionReduced } from './settings';
import { SuspectOption } from './suspect-card';
import { Txt } from './txt';

export type SheetNotice = { tone: 'warn' | 'info' | 'good'; title: string; text?: string };

function statusLine(room: RoomView) {
  const locked = lockedIds(room);
  const meLocked = !!room.me && locked.has(room.me.memberId);
  const lockedOthers = room.members.filter((m) => !m.isMe && locked.has(m.memberId)).map((m) => m.name);
  const waiting = room.members.filter((m) => !m.isMe && !locked.has(m.memberId)).map((m) => m.name);
  if (!room.theory.culprit) return { text: 'Pick a suspect first.', strong: false };
  if (room.checkedRevision === room.theory.revision) return { text: 'Already checked. Change the theory to try again.', strong: true };
  if (meLocked) return { text: `You’re in. Waiting for ${joinNames(waiting)}${waiting.length === 1 ? ' to agree' : ''}.`, strong: false };
  if (lockedOthers.length > 0)
    return { text: `${joinNames(lockedOthers)} ${lockedOthers.length === 1 ? 'agrees' : 'agree'}. Lock in if you do.`, strong: true };
  return { text: 'Everyone locks in the same name.', strong: false };
}

export function useSecondsUntil(until: number | null, offset: number) {
  const [local, setNow] = useState(() => Date.now());
  const now = local + offset;
  const active = until !== null && until > now;
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [active]);
  return until === null ? 0 : Math.max(0, Math.ceil((until - now) / 1000));
}

export function TheorySheet({
  room,
  expanded,
  notice,
  fullHeight,
  pendingPick,
  onToggle,
  onPick,
  onLockIn,
  serverOffset = 0,
}: {
  room: RoomView;
  expanded: boolean;
  notice?: SheetNotice;
  fullHeight?: boolean;
  pendingPick?: SuspectId;
  onToggle?: () => void;
  onPick?: (id: SuspectId) => void;
  onLockIn?: () => void;
  serverOffset?: number;
}) {
  const insets = useSafeAreaInsets();
  const reduced = useMotionReduced();
  const locked = lockedIds(room);
  const meLocked = !!room.me && locked.has(room.me.memberId);
  const alreadyChecked = room.checkedRevision === room.theory.revision;
  const culprit = room.theory.culprit ? suspectById(room.theory.culprit) : null;
  const status = statusLine(room);
  const ruledOut = room.lastNudge;
  const cooldown = useSecondsUntil(room.cooldownUntil, serverOffset);

  return (
    <>
      {expanded ? (
        <Animated.View entering={reduced ? undefined : FadeIn.duration(200)} style={styles.scrim} pointerEvents="none" />
      ) : null}
      <Animated.View
        entering={reduced ? undefined : SlideInDown.springify().damping(20)}
        style={[
          styles.sheet,
          { paddingBottom: insets.bottom + Space.m },
          fullHeight && expanded && { top: insets.top + Space.s },
        ]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Shared theory" onPress={onToggle} style={styles.summary}>
          <View style={styles.handle} />
          {expanded ? (
            <View style={styles.sheetHead}>
              <Txt variant="title">Who took the seed?</Txt>
              <Txt variant="body" color={Palette.paperMuted}>
                Whoever’s left is the thief.
              </Txt>
            </View>
          ) : (
            <View style={styles.summaryRow}>
              <View style={styles.flex}>
                <Txt variant="small" color={Palette.paperMuted}>
                  Squad theory
                </Txt>
                <Txt variant="name">{culprit ? culprit.name : 'No pick yet'}</Txt>
              </View>
              <View style={styles.dots}>
                {room.members.map((m) => (
                  <View key={m.memberId} style={[styles.dot, locked.has(m.memberId) && styles.dotOn]} />
                ))}
              </View>
              <Txt variant="smallStrong" color={Palette.paperMuted} style={styles.tabular}>
                {locked.size} of {room.members.length}
              </Txt>
            </View>
          )}
        </Pressable>
        {expanded ? (
          <ScrollView style={fullHeight ? styles.flex : undefined} contentContainerStyle={styles.expanded} showsVerticalScrollIndicator={false}>
            {notice ? <Banner tone={notice.tone} title={notice.title} text={notice.text} /> : null}
            <View>
              {Suspects.map((s) => (
                <SuspectOption
                  key={s.id}
                  suspect={s}
                  selected={(pendingPick ?? room.theory.culprit) === s.id}
                  pending={pendingPick === s.id}
                  ruledOutBy={
                    ruledOut && ruledOut.wrongPick === s.id
                      ? ruledOut.holder
                        ? ruledOut.holder.memberId === room.me?.memberId
                          ? 'You'
                          : ruledOut.holder.name
                        : RoleMeta[ruledOut.forRole].label
                      : undefined
                  }
                  onPress={() => onPick?.(s.id)}
                />
              ))}
            </View>
            <View style={styles.seals}>
              {seals(room).map(({ role, member }) => (
                <View key={member.memberId} style={styles.sealCol}>
                  <Seal role={role} filled={locked.has(member.memberId)} haptic={member.isMe} size={46} initial={member.name.charAt(0).toUpperCase()} />
                  <Txt variant="small" color={Palette.paperMuted} numberOfLines={1}>
                    {member.isMe ? 'You' : member.name}
                  </Txt>
                </View>
              ))}
            </View>
            <Txt variant="small" color={Palette.paperMuted} style={styles.center}>
              {cooldown > 0 ? 'Wrong pick. Talk it through.' : `${locked.size} of ${room.members.length} locked${meLocked ? '' : ` · ${status.text}`}`}
            </Txt>
            {cooldown > 0 ? (
              <Button title={`Try again in 0:${String(cooldown).padStart(2, '0')}`} disabled />
            ) : !culprit || alreadyChecked ? (
              <Button title={culprit ? `Lock in ${culprit.first}` : 'Pick a name first'} disabled />
            ) : meLocked ? (
              <Button title="Locked in ✓" variant="secondary" />
            ) : (
              <Button title={`Lock in ${culprit.first}`} haptic={false} onPress={onLockIn} />
            )}
          </ScrollView>
        ) : null}
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  tabular: { fontVariant: ['tabular-nums'] },
  center: { textAlign: 'center' },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(26,25,22,0.25)' },
  sheetHead: { gap: 4, paddingTop: Space.s },
  dots: { flexDirection: 'row', gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 5, borderWidth: 1.5, borderColor: Palette.paperMuted },
  dotOn: { backgroundColor: Palette.paper, borderColor: Palette.paper },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Palette.panel,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderTopWidth: 1,
    borderColor: Palette.hairline,
    paddingHorizontal: Space.xl,
    boxShadow: '0 -8px 32px rgba(26,25,22,0.10)',
  },
  summary: { paddingTop: Space.s, paddingBottom: Space.s, gap: 4 },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: Palette.hairline, marginBottom: Space.s },
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Space.m },
  expanded: { gap: Space.m, paddingTop: Space.s, paddingBottom: Space.xs },
  seals: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-around', rowGap: Space.s },
  sealCol: { alignItems: 'center', gap: 6, width: 80 },
});
