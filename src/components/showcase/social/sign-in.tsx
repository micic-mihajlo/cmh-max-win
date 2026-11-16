import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { InkInput } from '@/components/signal/ink-input';
import { Txt } from '@/components/signal/txt';
import { FontFamily, Palette, Space } from '@/constants/signal';
import { Enter } from '@/motion';

import { Avatar, BigButton, TextAction } from './kit';

export function WelcomeScreen({ onWhop, onApple }: { onWhop: () => void; onApple: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.screen, { paddingTop: insets.top + Space.xxxl, paddingBottom: insets.bottom + Space.xxxl }]}>
      <View style={styles.hero}>
        <Enter>
          <Txt variant="display" style={styles.center}>
            Everyone holds a piece.
          </Txt>
        </Enter>
        <Enter index={1}>
          <Txt variant="body" color={Palette.paperMuted} style={styles.center}>
            Nobody solves it alone.
          </Txt>
        </Enter>
      </View>
      <Enter index={2} style={styles.actions}>
        <PreviewNote />
        <BigButton title="Continue with Whop" onPress={onWhop} />
        <View style={styles.apple}>
          <TextAction title="Continue with Apple" onPress={onApple} />
        </View>
      </Enter>
    </View>
  );
}

const suggestions = ['chriswalker', 'chris.solves', 'chris_w'];

export function ClaimHandleScreen({ onDone }: { onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const [handle, setHandle] = useState('chris');
  const clean = handle.toLowerCase().replace(/[^a-z0-9._]/g, '');
  const ok = clean.length >= 3;
  return (
    <View style={[styles.screen, { paddingTop: insets.top + Space.xxxl, paddingBottom: insets.bottom + Space.xl }]}>
      <Enter style={styles.claim}>
        <Avatar initials={clean.slice(0, 1).toUpperCase() || '?'} size={72} />
        <Txt variant="title" style={styles.center}>
          Claim your handle
        </Txt>
        <View style={styles.field}>
          <Txt style={styles.at}>@</Txt>
          <InkInput
            value={clean}
            onChangeText={setHandle}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={20}
            style={styles.input}
            accessibilityLabel="Handle"
          />
        </View>
        <Txt variant="small" color={ok ? Palette.ok : Palette.paperMuted} style={styles.status}>
          {ok ? `@${clean} is yours` : 'At least 3 letters'}
        </Txt>
        <View style={styles.suggestions}>
          {suggestions.map((s) => (
            <TextAction key={s} title={`@${s}`} muted onPress={() => setHandle(s)} />
          ))}
        </View>
      </Enter>
      <View style={styles.actions}>
        <PreviewNote />
        <BigButton title={`Claim @${clean || 'handle'}`} onPress={ok ? onDone : undefined} />
      </View>
    </View>
  );
}

function PreviewNote() {
  return (
    <Txt variant="small" color={Palette.paperMuted} style={styles.center}>
      {"Preview · sign-in isn't connected yet, so no account is created"}
    </Txt>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Palette.ink, paddingHorizontal: Space.xl, justifyContent: 'space-between' },
  hero: { flex: 1, justifyContent: 'center', gap: Space.m },
  center: { textAlign: 'center' },
  actions: { gap: Space.xl, alignItems: 'stretch' },
  apple: { alignSelf: 'center' },
  claim: { alignItems: 'center', gap: Space.m, marginTop: Space.xl },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    marginTop: Space.l,
    height: 56,
    borderRadius: 14,
    backgroundColor: Palette.card,
    borderWidth: 1,
    borderColor: Palette.paper,
    paddingHorizontal: Space.l,
  },
  at: { fontFamily: FontFamily.uiSemi, fontSize: 22, color: Palette.paperMuted, marginRight: 2 },
  input: { flex: 1, fontFamily: FontFamily.uiSemi, fontSize: 22, color: Palette.paper, paddingVertical: 0 },
  status: { alignSelf: 'flex-start' },
  suggestions: { flexDirection: 'row', flexWrap: 'wrap', gap: Space.l, alignSelf: 'flex-start', marginTop: Space.xs },
});
