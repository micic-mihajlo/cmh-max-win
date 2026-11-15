import { useEffect, useState } from 'react';
import { ActivityIndicator, Keyboard, Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Screen } from '@/components/signal/backdrop';
import { CodeCells } from '@/components/signal/code-cells';
import { Button, Label } from '@/components/signal/primitives';
import { useMotionReduced } from '@/components/signal/settings';
import { Txt } from '@/components/signal/txt';
import { Wordmark } from '@/components/wordmark';
import { Palette, Radius, RoleMeta, Space } from '@/constants/signal';
import { Case01 } from '@/constants/case01';
import type { ActiveRoomView, Role, SignalErrorCode } from '@/lib/contract';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function useKeyboardHeight() {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardWillShow', (e) => setHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardWillHide', () => setHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return height;
}

export type JoinState = {
  code: string;
  phase: 'typing' | 'joining' | 'error' | 'reclaim';
  error?: SignalErrorCode;
  seats?: { role: Role; holder?: string }[];
};

const joinErrors: Partial<Record<SignalErrorCode, (code: string) => string>> = {
  ROOM_NOT_FOUND: (code) => `No case with code ${code}. Check the code with your host.`,
  ROOM_FULL: () => 'That case already has three players. Ask your host to start a new one.',
  CASE_STARTED: () => 'That case has already started. Your host can restart it to let you in.',
};

export type CoverActions = {
  onStart?: () => void;
  onOpenJoin?: () => void;
  onRejoin?: () => void;
  onCodeChange?: (code: string) => void;
  onJoin?: () => void;
  onCloseJoin?: () => void;
  onTakeSeat?: (role: Role) => void;
  onJoinDrop?: () => void;
  onHostDrop?: () => void;
};

export function CoverScreen({
  active,
  join,
  creating,
  on = {},
}: {
  active: ActiveRoomView | undefined;
  join?: JoinState;
  creating?: boolean;
  on?: CoverActions;
}) {
  const banner =
    active === undefined ? (
      <View style={[styles.banner, styles.bannerLoading]} accessibilityLabel="Checking for a case in progress" />
    ) : active && active.status === 'resolved' ? (
      <View style={[styles.banner, { borderColor: Palette.ok }]}>
        <View style={styles.bannerText}>
          <Label color={Palette.ok}>Case 01 · solved</Label>
          <Txt variant="bodyStrong">Your crew solved Case 01.</Txt>
        </View>
        <Button title="See the reveal" variant="secondary" style={styles.bannerButton} onPress={on.onRejoin} />
      </View>
    ) : active ? (
      <View style={[styles.banner, { borderColor: active.role ? RoleMeta[active.role].color : Palette.paper }]}>
        <View style={styles.bannerText}>
          <Label color={active.role ? RoleMeta[active.role].color : Palette.paperMuted}>{`Case in progress · ${active.code}`}</Label>
          <Txt variant="bodyStrong">
            {active.role ? `Case 01 is still open. Rejoin as ${RoleMeta[active.role].label}.` : 'Case 01 is still open. Rejoin the lobby.'}
          </Txt>
        </View>
        <Button title="Rejoin" style={styles.bannerButton} onPress={on.onRejoin} />
      </View>
    ) : null;

  return (
    <Screen
      overlay={join ? <JoinSheet join={join} on={on} /> : null}
      footer={
        <View style={styles.cta}>
          <Button title="Join a drop" disabled={creating} onPress={on.onJoinDrop} />
          <Button title="Host a drop" variant="ghost" disabled={creating} onPress={on.onHostDrop} />
        </View>
      }>
      <Wordmark />
      {banner}
      <View style={styles.hero}>
        <Txt variant="caption" color={Palette.paperMuted}>{`Case ${Case01.number}`}</Txt>
        <Txt variant="display" numberOfLines={2} adjustsFontSizeToFit>
          The Aurora Seed
        </Txt>
        <Txt variant="body" color={Palette.paperMuted}>
          {Case01.logline}
        </Txt>
      </View>
    </Screen>
  );
}

function JoinSheet({ join, on }: { join: JoinState; on: CoverActions }) {
  const insets = useSafeAreaInsets();
  const reduced = useMotionReduced();
  const keyboard = useKeyboardHeight();
  if (join.phase === 'reclaim') return <ReclaimSheet join={join} on={on} />;
  const error = join.phase === 'error' && join.error ? joinErrors[join.error]?.(join.code) : null;
  const ready = join.code.length === 4;
  return (
    <>
      <AnimatedPressable accessibilityLabel="Close" onPress={on.onCloseJoin} entering={reduced ? undefined : FadeIn} style={styles.scrim} />
      <Animated.View
        entering={reduced ? undefined : SlideInDown.springify().damping(20)}
        style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, keyboard) + Space.l }]}>
        <View style={styles.handle} />
        <Txt variant="title">Join a case</Txt>
        <Txt variant="body" color={Palette.paperMuted}>
          Enter the 4-letter code from your host.
        </Txt>
        <View style={styles.cells}>
          <CodeCells value={join.code} error={!!error} />
          {on.onCodeChange ? (
            <TextInput
              value={join.code}
              onChangeText={(t) =>
                on.onCodeChange?.(
                  t
                    .toUpperCase()
                    .replace(/[^A-Z0-9]/g, '')
                    .slice(0, 4),
                )
              }
              onSubmitEditing={ready ? on.onJoin : undefined}
              autoFocus
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={4}
              caretHidden
              accessibilityLabel="Invite code"
              style={styles.hiddenInput}
            />
          ) : null}
        </View>
        {error ? (
          <Txt variant="bodyStrong" color={Palette.danger} accessibilityRole="alert" style={styles.center}>
            {error}
          </Txt>
        ) : (
          <Txt variant="small" color={Palette.paperMuted} style={styles.center}>
            {join.phase === 'joining' ? ' ' : ready ? 'Ready to join.' : '4 letters. No 0, O, 1 or I.'}
          </Txt>
        )}
        {join.phase === 'joining' ? (
          <View style={styles.joining}>
            <ActivityIndicator color={Palette.onAccent} />
            <Txt variant="button" color={Palette.onAccent}>
              Joining {join.code}…
            </Txt>
          </View>
        ) : (
          <Button
            title={error ? 'Try another code' : 'Join'}
            disabled={!ready && !error}
            variant={error ? 'secondary' : 'primary'}
            onPress={error ? () => on.onCodeChange?.('') : on.onJoin}
          />
        )}
      </Animated.View>
    </>
  );
}

function ReclaimSheet({ join, on }: { join: JoinState; on: CoverActions }) {
  const insets = useSafeAreaInsets();
  const seats = join.seats ?? [];
  return (
    <>
      <Pressable accessibilityLabel="Close" onPress={on.onCloseJoin} style={styles.scrim} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + Space.l }]}>
        <View style={styles.handle} />
        <Label color={Palette.paperMuted}>{`Case in progress · ${join.code}`}</Label>
        {seats.length ? (
          <>
            <Txt variant="title">Pick your seat back</Txt>
            <Txt variant="body" color={Palette.paperMuted}>
              This case already started. These players stepped away, so you can take over their seat, evidence and lock-in.
            </Txt>
            {seats.map((s, i) => {
              const meta = RoleMeta[s.role];
              return (
                <Pressable
                  key={s.role}
                  accessibilityRole="button"
                  onPress={() => on.onTakeSeat?.(s.role)}
                  style={[styles.seat, i === 0 && { borderColor: meta.color }]}>
                  <View style={[styles.dot, { backgroundColor: meta.color }]} />
                  <View style={styles.seatBody}>
                    <Txt variant="bodyStrong" color={meta.color}>
                      {meta.label}
                    </Txt>
                    <Txt variant="small" color={Palette.paperMuted}>
                      {s.holder ? `${s.holder}’s seat · stepped away` : 'Its player stepped away'}
                    </Txt>
                  </View>
                  <Txt variant="label" color={Palette.paperMuted}>
                    {meta.docLabel}
                  </Txt>
                </Pressable>
              );
            })}
            <Button title={`Take the ${RoleMeta[seats[0].role].label} seat`} onPress={() => on.onTakeSeat?.(seats[0].role)} />
          </>
        ) : (
          <>
            <Txt variant="title">No free seat</Txt>
            <Txt variant="body" color={Palette.paperMuted}>
              Everyone’s here and the case is underway. Ask your host to restart it, or start your own.
            </Txt>
            <Button title="Start your own case" variant="secondary" onPress={on.onStart} />
          </>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  seat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.m,
    padding: Space.l,
    borderRadius: Radius.m,
    borderWidth: 1,
    borderColor: Palette.hairline,
    backgroundColor: Palette.ink,
  },
  seatBody: { flex: 1, gap: 2 },
  center: { textAlign: 'center' },
  hero: { gap: Space.m, marginTop: Space.xxl },
  cta: { gap: Space.xs, paddingBottom: Space.l },
  bannerLoading: { height: 128, borderColor: Palette.hairline, opacity: 0.6 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  banner: {
    borderWidth: 1,
    borderRadius: Radius.l,
    padding: Space.l,
    gap: Space.m,
    backgroundColor: Palette.panel,
  },
  bannerText: { gap: 4 },
  bannerButton: { minHeight: 46 },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(5,6,8,0.72)' },
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
    paddingTop: Space.s,
    gap: Space.m,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: Palette.hairline, marginBottom: Space.s },
  cells: { paddingVertical: Space.m },
  hiddenInput: { ...StyleSheet.absoluteFill, opacity: 0.02, color: 'transparent' },
  joining: {
    minHeight: 54,
    borderRadius: Radius.pill,
    backgroundColor: Palette.paper,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space.s,
    opacity: 0.85,
  },
});
