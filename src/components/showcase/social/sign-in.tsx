import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Txt } from '@/components/signal/txt';
import { FontFamily, Palette, Radius, Space } from '@/constants/signal';
import { Enter } from '@/motion';

import { Avatar, BigButton, Pill } from './kit';

const tiles = ['S', 'I', 'G', 'N', 'A', 'L'];

export function WelcomeScreen({ onWhop, onApple, onLater }: { onWhop: () => void; onApple: () => void; onLater?: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.screen, { paddingTop: insets.top + Space.xxxl, paddingBottom: insets.bottom + Space.xl }]}>
      <View style={styles.hero}>
        <View style={styles.tiles}>
          {tiles.map((letter, i) => (
            <Enter key={letter} index={i} stagger={60} from={8}>
              <View style={[styles.tile, i === 3 && styles.tileLit]}>
                <Txt style={styles.tileLetter}>{letter}</Txt>
              </View>
            </Enter>
          ))}
        </View>
        <Enter delay={360}>
          <Txt variant="display" style={styles.center}>
            Everyone holds a piece.
          </Txt>
          <Txt variant="serif" color={Palette.paperMuted} style={[styles.center, styles.sub]}>
            Nobody solves it alone.
          </Txt>
        </Enter>
      </View>
      <Enter delay={480} style={styles.actions}>
        <BigButton title="Continue with Whop" onPress={onWhop} />
        <BigButton title="Continue with Apple" tone="ink" onPress={onApple} />
        <Txt variant="small" color={Palette.paperMuted} style={[styles.center, styles.fine]}>
          One account for your squads, season packs and bounties.
        </Txt>
        {onLater ? (
          <Txt variant="smallStrong" color={Palette.paperMuted} style={styles.center} onPress={onLater}>
            Not now
          </Txt>
        ) : null}
      </Enter>
    </View>
  );
}

const suggestions = ['kitmarlowe', 'kit.solves', 'kit_m'];

export function ClaimHandleScreen({ onDone }: { onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const [handle, setHandle] = useState('kit');
  const clean = handle.toLowerCase().replace(/[^a-z0-9._]/g, '');
  const ok = clean.length >= 3;
  return (
    <View style={[styles.screen, { paddingTop: insets.top + Space.xxxl, paddingBottom: insets.bottom + Space.xl }]}>
      <Enter style={styles.claim}>
        <Avatar initials={clean.slice(0, 1).toUpperCase() || '?'} size={72} />
        <Txt variant="title" style={styles.center}>
          Claim your handle
        </Txt>
        <Txt variant="body" color={Palette.paperMuted} style={styles.center}>
          It&apos;s how your squad finds you.
        </Txt>
        <View style={styles.field}>
          <Txt style={styles.at}>@</Txt>
          <TextInput
            value={clean}
            onChangeText={setHandle}
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus={false}
            maxLength={20}
            style={styles.input}
            accessibilityLabel="Handle"
          />
        </View>
        <View style={styles.status}>
          <View style={[styles.dot, { backgroundColor: ok ? Palette.ok : Palette.hairline }]} />
          <Txt variant="small" color={ok ? Palette.ok : Palette.paperMuted}>
            {ok ? `@${clean} is yours` : 'At least 3 letters'}
          </Txt>
        </View>
        <View style={styles.suggestions}>
          {suggestions.map((s) => (
            <Pill key={s} title={`@${s}`} onPress={() => setHandle(s)} />
          ))}
        </View>
      </Enter>
      <View style={styles.actions}>
        <BigButton title={`Claim @${clean || 'handle'}`} onPress={ok ? onDone : undefined} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Palette.ink, paddingHorizontal: Space.xl, justifyContent: 'space-between' },
  hero: { flex: 1, justifyContent: 'center', gap: Space.xxl },
  tiles: { flexDirection: 'row', justifyContent: 'center', gap: Space.s },
  tile: {
    width: 46,
    height: 54,
    borderRadius: 10,
    backgroundColor: Palette.card,
    borderWidth: 1,
    borderColor: Palette.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileLit: { backgroundColor: Palette.ember, borderColor: Palette.ember },
  tileLetter: { fontFamily: FontFamily.uiBold, fontSize: 26, lineHeight: 30, color: Palette.paper },
  center: { textAlign: 'center' },
  sub: { marginTop: Space.s },
  actions: { gap: Space.m },
  fine: { marginTop: Space.xs, marginBottom: Space.s },
  claim: { alignItems: 'center', gap: Space.m, marginTop: Space.xl },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    marginTop: Space.l,
    height: 60,
    borderRadius: Radius.m,
    backgroundColor: Palette.card,
    borderWidth: 1,
    borderColor: Palette.paper,
    paddingHorizontal: Space.l,
  },
  at: { fontFamily: FontFamily.uiSemi, fontSize: 22, color: Palette.paperMuted, marginRight: 2 },
  input: { flex: 1, fontFamily: FontFamily.uiSemi, fontSize: 22, color: Palette.paper, paddingVertical: 0 },
  status: { flexDirection: 'row', alignItems: 'center', gap: Space.s, alignSelf: 'flex-start' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  suggestions: { flexDirection: 'row', flexWrap: 'wrap', gap: Space.s, alignSelf: 'flex-start' },
});
