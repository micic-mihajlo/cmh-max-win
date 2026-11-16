import { router, type Href } from 'expo-router';
import { useRef, useState, type ComponentRef } from 'react';
import { Platform, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import Animated, { FadeIn } from 'react-native-reanimated';

import { YourChallenges } from '@/components/home/your-challenges';
import { OnNow, ComingUp } from '@/components/home/streams';
import { Screen } from '@/components/signal/backdrop';
import { Txt } from '@/components/signal/txt';
import { Wordmark } from '@/components/wordmark';
import { FontFamily, Palette, Radius, Space } from '@/constants/signal';
import { useActiveDrop } from '@/hooks/use-active-drop';
import { useResolveCode } from '@/hooks/use-discovery';
import { useActiveRoom } from '@/hooks/use-signal';
import { Haptic, PressScale } from '@/motion';

const ALPHABET = /[^ABCDEFGHJKLMNPQRSTUVWXYZ23456789]/g;
const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL ?? 'https://signal-app-wine.vercel.app';

// Home: join a game with a code, or host one. What's on and your own challenges sit below.
export function HomeScreen() {
  const [code, setCode] = useState('');
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const ready = code.length === 4;
  const resolved = useResolveCode(ready ? code : null);
  const unknown = ready && resolved === null;
  const active = useActiveRoom();
  const activeDrop = useActiveDrop(active?.code ?? null);
  const { width } = useWindowDimensions();
  const desktop = Platform.OS === 'web' && width >= 768;

  const join = () => {
    if (!ready || unknown) return input.current?.focus();
    if (resolved) router.push(resolved.path as Href);
  };

  const resume = () =>
    activeDrop
      ? router.push({ pathname: '/drop/[id]', params: { id: activeDrop.dropId } })
      : active && router.push({ pathname: '/room/[code]', params: { code: active.code } });

  return (
    <Screen>
      <View style={styles.top}>
        <Wordmark />
        <Txt variant="bodyStrong" color={Palette.paperMuted} style={styles.lede}>
          Live quizzes with your stream. Winners get paid on Whop.
        </Txt>
      </View>
      <View style={styles.join}>
        <PressScale
          accessibilityRole="button"
          accessibilityLabel={'Join code ' + (code.split('').join(' ') || 'empty')}
          scaleTo={0.99}
          onPress={() => input.current?.focus()}>
          <View style={styles.tiles}>
            {Array.from({ length: 4 }, (_, i) => (
              <View key={i} style={[styles.tile, i === code.length && styles.tileActive]}>
                {code[i] ? (
                  <Animated.View entering={FadeIn.duration(120)}>
                    <Txt style={styles.letter}>{code[i]}</Txt>
                  </Animated.View>
                ) : null}
              </View>
            ))}
          </View>
        </PressScale>
        <TextInput
          ref={input}
          value={code}
          onChangeText={(t) => {
            const next = t.toUpperCase().replace(ALPHABET, '').slice(0, 4);
            if (next.length > code.length) Haptic.select();
            setCode(next);
          }}
          onSubmitEditing={join}
          autoFocus={Platform.OS === 'web'}
          autoCapitalize="characters"
          autoCorrect={false}
          autoComplete="off"
          maxLength={4}
          caretHidden
          accessibilityLabel="Join code"
          style={styles.hidden}
        />
        <View style={styles.under}>
          {unknown ? (
            <Txt variant="label" color={Palette.paperMuted}>
              No game with that code
            </Txt>
          ) : (
            <PressScale accessibilityRole="link" haptic="tap" hitSlop={12} onPress={() => router.push('/scan' as Href)}>
              <Txt variant="label">Scan</Txt>
            </PressScale>
          )}
        </View>
        <PressScale
          accessibilityRole="button"
          accessibilityState={{ disabled: !resolved }}
          haptic="tap"
          onPress={join}
          style={[styles.primary, !resolved && styles.primaryOff]}>
          <Txt variant="button" color={resolved ? Palette.ink : Palette.disabledText}>
            Join
          </Txt>
        </PressScale>
        {active ? (
          <PressScale accessibilityRole="link" haptic="tap" onPress={resume} style={styles.host}>
            <Txt variant="label">Back to your squad</Txt>
          </PressScale>
        ) : null}
        <PressScale accessibilityRole="link" haptic="tap" onPress={() => router.push('/host')} style={styles.host}>
          <Txt variant="label">Start a game</Txt>
        </PressScale>
      </View>
      {desktop ? (
        <View style={styles.qrRow}>
          <View style={styles.qr}>
            <QRCode value={WEB_URL} size={96} color={Palette.paper} backgroundColor={Palette.card} />
          </View>
          <Txt variant="small" color={Palette.paperMuted} style={styles.flex}>
            Scan to open Signal on your phone.
          </Txt>
        </View>
      ) : null}
      <OnNow />
      <ComingUp />
      <YourChallenges />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  lede: Platform.select({ web: { textWrap: 'balance' } as object, default: {} }),
  top: { gap: Space.l, paddingTop: Space.l },
  join: { gap: Space.m, paddingTop: Space.s },
  tiles: { flexDirection: 'row', gap: 10 },
  tile: {
    flex: 1,
    height: 88,
    borderRadius: Radius.m,
    backgroundColor: Palette.card,
    borderWidth: 1,
    borderColor: Palette.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileActive: { borderColor: Palette.paper },
  letter: { fontFamily: FontFamily.uiBold, fontSize: 44, lineHeight: 54, color: Palette.paper },
  hidden: { position: 'absolute', opacity: 0, width: 1, height: 1 },
  under: { flexDirection: 'row', justifyContent: 'center', minHeight: 24 },
  primary: { minHeight: 56, borderRadius: Radius.m, backgroundColor: Palette.paper, alignItems: 'center', justifyContent: 'center' },
  primaryOff: { backgroundColor: Palette.paperShade },
  host: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  qrRow: { flexDirection: 'row', alignItems: 'center', gap: Space.l },
  qr: { padding: Space.s, borderRadius: Radius.s, backgroundColor: Palette.card },
});
