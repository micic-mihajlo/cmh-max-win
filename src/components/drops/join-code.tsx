import React, { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import { router } from 'expo-router';

import { Screen } from '@/components/signal/backdrop';
import { Button } from '@/components/signal/primitives';
import { Txt } from '@/components/signal/txt';
import { FontFamily, Palette, Radius, Space } from '@/constants/signal';
import { Enter, Haptic, useReduced } from '@/motion';

export const JOIN_CODE_LENGTH = 4;

export type JoinPhase = 'typing' | 'checking' | 'error' | 'joined';

// Phone join: four Wordle tiles. Typing auto-advances, the last letter submits, a wrong code shakes once.
export function JoinCodeScreen({
  code,
  phase,
  name,
  hostName,
  onChange,
  onSubmit,
  onScan,
  onBack,
}: {
  code: string;
  phase: JoinPhase;
  name: string;
  hostName?: string | null;
  onChange?: (code: string) => void;
  onSubmit?: (code: string) => void;
  onScan?: () => void;
  onBack?: () => void;
}) {
  const reduced = useReduced();
  const input = useRef<React.ComponentRef<typeof TextInput>>(null);
  const shake = useSharedValue(0);
  useEffect(() => {
    if (phase !== 'error') return;
    input.current?.focus();
    Haptic.warning();
    if (reduced) return;
    shake.set(withSequence(...[6, -6, 6, -6, 6, 0].map((x) => withTiming(x, { duration: 40 }))));
  }, [phase, reduced, shake]);
  const row = useAnimatedStyle(() => ({ transform: [{ translateX: shake.get() }] }));

  if (phase === 'joined') {
    return (
      <Screen contentStyle={styles.center}>
        <Enter>
          <Txt variant="display" style={styles.text}>
            You’re in.
          </Txt>
          <Txt variant="body" color={Palette.paperMuted} style={styles.text}>
            Watch the screen.
          </Txt>
        </Enter>
        <Enter delay={60}>
          <View style={styles.chip}>
            <Txt variant="bodyStrong">{name}</Txt>
          </View>
        </Enter>
      </Screen>
    );
  }

  const type = (raw: string) => {
    if (phase === 'checking') return;
    const next = raw
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, JOIN_CODE_LENGTH);
    if (next.length > code.length) (next.length === JOIN_CODE_LENGTH ? Haptic.tap : Haptic.select)();
    onChange?.(next);
    if (next.length === JOIN_CODE_LENGTH) onSubmit?.(next);
  };

  return (
    <Screen
      contentStyle={styles.center}
      header={
        <View style={styles.bar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={12}
            style={styles.back}
            onPress={onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/')))}>
            <Txt variant="title" style={styles.chevron}>
              ‹
            </Txt>
          </Pressable>
        </View>
      }>
      <Txt variant="title" style={styles.text}>
        Type the code on the screen
      </Txt>
      <Pressable accessibilityLabel={`Drop code ${code.split('').join(' ') || 'empty'}`} onPress={() => input.current?.focus()}>
        <Animated.View style={[styles.tiles, row]}>
          {Array.from({ length: JOIN_CODE_LENGTH }, (_, i) => {
            const ch = code[i];
            const tile = (
              <View style={[styles.tile, ch && styles.tileFilled, phase === 'error' && styles.tileError]}>
                <Txt style={styles.letter}>{ch ?? ''}</Txt>
              </View>
            );
            return ch ? (
              <Enter key={`${i}${ch}`} from={8} stagger={0}>
                {tile}
              </Enter>
            ) : (
              <View key={i}>{tile}</View>
            );
          })}
        </Animated.View>
      </Pressable>
      <Txt variant="small" color={phase === 'error' ? Palette.danger : Palette.paperMuted} style={styles.text}>
        {phase === 'error' ? `That code isn’t live yet. ${hostName ? `Check ${hostName}’s chat.` : 'Check the code on the big screen.'}` : phase === 'checking' ? 'Checking…' : ' '}
      </Txt>
      {onScan ? <Button title="Scan a code" variant="ghost" onPress={onScan} /> : null}
      <TextInput
        ref={input}
        value={code}
        onChangeText={type}
        autoFocus
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={JOIN_CODE_LENGTH}
        caretHidden
        style={styles.hidden}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Space.xl },
  text: { textAlign: 'center' },
  bar: { paddingHorizontal: Space.l, height: 44, justifyContent: 'center' },
  back: { width: 32 },
  chevron: { fontSize: 34, lineHeight: 40, marginTop: -4 },
  tiles: { flexDirection: 'row', gap: 10 },
  tile: {
    width: 64,
    height: 76,
    borderRadius: Radius.m,
    borderWidth: 1,
    borderColor: Palette.hairline,
    backgroundColor: Palette.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileFilled: { borderColor: Palette.paper },
  tileError: { borderColor: Palette.danger },
  letter: { fontFamily: FontFamily.uiBold, fontSize: 40, lineHeight: 48, color: Palette.paper },
  chip: {
    paddingHorizontal: Space.l,
    paddingVertical: Space.s,
    borderRadius: Radius.pill,
    backgroundColor: Palette.accentSoft,
    alignSelf: 'center',
    marginTop: Space.l,
  },
  hidden: { position: 'absolute', opacity: 0, width: 1, height: 1 },
});
