import { CameraView, type BarcodeScanningResult } from 'expo-camera';
import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, StyleSheet, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeIn, FadeOut, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Screen } from '@/components/signal/backdrop';
import { Icon } from '@/components/signal/icon';
import { Button } from '@/components/signal/primitives';
import { Txt } from '@/components/signal/txt';
import { FontFamily, Palette, Radius, Space } from '@/constants/signal';
import { normalizeCode, parseChallengeCode } from '@/lib/share-link';
import { Duration, Ease, Haptic, PressScale, useReduced } from '@/motion';

const FRAME = 248;
const SYMBOLS = process.env.EXPO_OS === 'ios';
const NOTICE_MS = 2200;

// Full-bleed camera reading QR codes. A Signal code joins on the frame it is read; anything else gets one quiet notice.
export function ScanCamera({ onCode, onClose, onManual }: { onCode: (code: string) => void; onClose: () => void; onManual: () => void }) {
  const insets = useSafeAreaInsets();
  const done = useRef(false);
  const rejected = useRef<string | null>(null);
  const [notice, setNotice] = useState(false);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => clearTimeout(noticeTimer.current ?? undefined), []);

  const scanned = ({ data }: BarcodeScanningResult) => {
    if (done.current) return;
    const code = parseChallengeCode(data);
    if (code) {
      done.current = true;
      onCode(code);
      return;
    }
    if (rejected.current === data) return;
    rejected.current = data;
    Haptic.warning();
    setNotice(true);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => {
      setNotice(false);
      rejected.current = null;
    }, NOTICE_MS);
  };

  return (
    <View style={styles.camera}>
      <CameraView style={StyleSheet.absoluteFill} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={scanned} />
      <View pointerEvents="none" style={styles.frameWrap}>
        <View style={styles.frame} />
      </View>
      <View style={[styles.top, { paddingTop: insets.top + Space.s }]}>
        <CloseButton onPress={onClose} style={styles.round} />
        <View style={styles.pill}>
          <Txt variant="smallStrong">Point at the QR on stream</Txt>
        </View>
        <View style={styles.roundSpacer} />
      </View>
      <View style={[styles.bottom, { paddingBottom: insets.bottom + Space.xl }]}>
        {notice ? (
          <Animated.View entering={FadeIn.duration(Duration.fade)} exiting={FadeOut.duration(Duration.exit)} style={styles.pill}>
            <Txt variant="small">That QR isn’t a Signal challenge</Txt>
          </Animated.View>
        ) : null}
        <PressScale accessibilityRole="button" haptic="tap" onPress={onManual} style={styles.pillButton}>
          {SYMBOLS ? <Icon name="keyboard" size={16} /> : null}
          <Txt variant="smallStrong">Type the code instead</Txt>
        </PressScale>
      </View>
    </View>
  );
}

// SF Symbols only draw on iOS, so elsewhere the close control reads as a word.
function CloseButton({ onPress, style }: { onPress: () => void; style: StyleProp<ViewStyle> }) {
  return (
    <PressScale accessibilityRole="button" accessibilityLabel="Close" haptic="tap" onPress={onPress} style={[style, !SYMBOLS && styles.closeWord]}>
      {SYMBOLS ? <Icon name="xmark" size={16} /> : <Txt variant="smallStrong">Close</Txt>}
    </PressScale>
  );
}

type CameraState = 'ask' | 'denied' | 'off' | 'manual';

const COPY: Record<CameraState, { title: string; body: string }> = {
  ask: { title: 'Scan to join', body: 'Point your camera at the QR on stream. Signal only uses the camera to read the code.' },
  denied: { title: 'Camera is off', body: 'Turn on camera access for Signal in Settings to scan, or type the code on the screen.' },
  off: { title: 'Join a challenge', body: 'This device has no camera to scan with. Type the code on the screen.' },
  manual: { title: 'Join a challenge', body: 'Type the four-letter code on the stream.' },
};

// The camera's explanation, denied and manual states, all with the same four tiles for typing or pasting a code.
export function ManualCode({
  camera,
  onCode,
  onClose,
  onAllow,
  onSettings,
  onScan,
}: {
  camera: CameraState;
  onCode: (code: string) => void;
  onClose: () => void;
  onAllow?: () => void;
  onSettings?: () => void;
  onScan?: () => void;
}) {
  const reduced = useReduced();
  const input = useRef<React.ComponentRef<typeof TextInput>>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState(false);
  const shake = useSharedValue(0);
  const row = useAnimatedStyle(() => ({ transform: [{ translateX: shake.get() }] }));
  const copy = COPY[camera];
  const [typing, setTyping] = useState(false);

  const type = (raw: string) => {
    const pasted = raw.length > 4 ? parseChallengeCode(raw) : null;
    if (pasted) {
      setCode(pasted);
      onCode(pasted);
      return;
    }
    const next = raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
    setError(false);
    if (next.length > code.length) Haptic.select();
    setCode(next);
    if (next.length < 4) return;
    const full = normalizeCode(next);
    if (full) {
      onCode(full);
      return;
    }
    setError(true);
    Haptic.warning();
    if (!reduced) shake.set(withSequence(...[6, -6, 6, -6, 0].map((x) => withTiming(x, { duration: 40, easing: Ease.out }))));
  };

  return (
    <KeyboardAvoidingView behavior={process.env.EXPO_OS === 'ios' ? 'padding' : undefined} style={styles.fill}>
      <Screen
        scroll={false}
        header={
          <View style={styles.header}>
            <CloseButton onPress={onClose} style={styles.roundQuiet} />
          </View>
        }
        contentStyle={styles.manual}>
        <View style={styles.copy}>
          {SYMBOLS && !typing ? (
            <View style={styles.badge}>
              <Icon name={camera === 'denied' ? 'video.slash' : 'qrcode.viewfinder'} size={28} />
            </View>
          ) : null}
          <Txt variant="title" style={styles.center}>
            {copy.title}
          </Txt>
          {typing ? null : (
            <Txt variant="body" color={Palette.paperMuted} style={styles.center}>
              {copy.body}
            </Txt>
          )}
        </View>
        {camera === 'ask' && onAllow ? <Button title="Allow camera" onPress={onAllow} /> : null}
        {camera === 'denied' && onSettings ? <Button title="Open Settings" variant="secondary" onPress={onSettings} /> : null}
        {camera === 'manual' && onScan ? <Button title="Scan instead" variant="secondary" onPress={onScan} /> : null}
        <View style={styles.enter}>
          <Txt variant="label" color={Palette.paperMuted} style={styles.center}>
            {camera === 'ask' || camera === 'denied' ? 'Or enter the code' : 'Code'}
          </Txt>
          <PressScale
            accessibilityRole="button"
            accessibilityLabel={`Challenge code ${code.split('').join(' ') || 'empty'}`}
            scaleTo={0.98}
            onPress={() => input.current?.focus()}>
            <Animated.View style={[styles.tiles, row]}>
              {Array.from({ length: 4 }, (_, i) => (
                <View key={i} style={[styles.tile, code[i] ? styles.tileFilled : null, error && styles.tileError]}>
                  <Txt style={styles.letter}>{code[i] ?? ''}</Txt>
                </View>
              ))}
            </Animated.View>
          </PressScale>
          <Txt variant="small" color={error ? Palette.danger : Palette.paperMuted} style={styles.center}>
            {error ? 'Codes skip I, O, 0 and 1. Check the screen.' : 'You can paste a Signal link too.'}
          </Txt>
        </View>
        <TextInput
          ref={input}
          value={code}
          onChangeText={type}
          onFocus={() => setTyping(true)}
          onBlur={() => setTyping(false)}
          autoFocus={camera === 'off'}
          autoCapitalize="characters"
          autoCorrect={false}
          autoComplete="off"
          caretHidden
          style={styles.hidden}
        />
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  camera: { flex: 1, backgroundColor: Palette.paper },
  frameWrap: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
  frame: {
    width: FRAME,
    height: FRAME,
    borderRadius: Radius.l,
    borderCurve: 'continuous',
    borderWidth: 2,
    borderColor: Palette.card,
    boxShadow: '0 0 0 2000px rgba(33, 32, 28, 0.45)',
  },
  top: { position: 'absolute', left: 0, right: 0, top: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Space.l },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center', gap: Space.m },
  round: { width: 40, height: 40, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: Palette.card },
  roundSpacer: { width: 40 },
  roundQuiet: {
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.hairline,
    backgroundColor: Palette.card,
  },
  closeWord: { width: 'auto', paddingHorizontal: Space.l },
  pill: { paddingHorizontal: Space.l, paddingVertical: Space.s, borderRadius: Radius.pill, backgroundColor: Palette.card },
  pillButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.s,
    paddingHorizontal: Space.xl,
    paddingVertical: Space.m,
    borderRadius: Radius.pill,
    backgroundColor: Palette.card,
  },
  header: { paddingHorizontal: Space.l, paddingTop: Space.s, alignItems: 'flex-start' },
  manual: { flexGrow: 1, justifyContent: 'center', gap: Space.xl },
  copy: { alignItems: 'center', gap: Space.m },
  badge: {
    width: 64,
    height: 64,
    borderRadius: Radius.l,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Palette.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.hairline,
    marginBottom: Space.xs,
  },
  center: { textAlign: 'center' },
  enter: { gap: Space.m, alignItems: 'center', marginTop: Space.s },
  tiles: { flexDirection: 'row', gap: 10 },
  tile: {
    width: 64,
    height: 76,
    borderRadius: Radius.m,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: Palette.hairline,
    backgroundColor: Palette.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileFilled: { borderColor: Palette.paper },
  tileError: { borderColor: Palette.danger },
  letter: { fontFamily: FontFamily.uiBold, fontSize: 40, lineHeight: 48, color: Palette.paper },
  hidden: { position: 'absolute', opacity: 0, width: 1, height: 1 },
});
