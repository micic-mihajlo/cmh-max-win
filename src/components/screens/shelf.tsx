import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/signal/backdrop';
import { Icon } from '@/components/signal/icon';
import { Button, Label } from '@/components/signal/primitives';
import { joinNames } from '@/components/signal/room';
import { Txt } from '@/components/signal/txt';
import { FontFamily, Palette, Radius, Space } from '@/constants/signal';
import type { SeasonPackView } from '@/lib/contract';

export type ShelfPack = SeasonPackView | { real: false };

export function ShelfScreen({
  pack,
  attempts,
  crew,
  onBuy,
  onNewCase,
}: {
  pack: ShelfPack;
  attempts: number;
  crew: string[];
  onBuy?: () => void;
  onNewCase?: () => void;
}) {
  return (
    <Screen footer={<Button title="Start a new case" variant="secondary" onPress={onNewCase} />}>
      <View style={styles.head}>
        <Txt variant="display">Kestrel Station</Txt>
        <Txt variant="body" color={Palette.paperMuted}>
          Season 01
        </Txt>
      </View>

      <View style={styles.episodes}>
        <View style={styles.episode}>
          <View style={styles.flex}>
            <Txt variant="name">01 The Aurora Seed</Txt>
            <Txt variant="small" color={Palette.paperMuted}>
              {`Solved · attempt ${attempts}${crew.length ? ` · ${joinNames(crew)}` : ''}`}
            </Txt>
          </View>
          <Icon name="checkmark" size={18} color={Palette.paper} />
        </View>
        <View style={[styles.episode, styles.rule]}>
          <View style={styles.flex}>
            <Txt variant="name">02 The Second Seed</Txt>
            <Txt variant="small" color={Palette.paperMuted}>
              Friday, 9 pm
            </Txt>
          </View>
          <Txt variant="smallStrong" color={Palette.paperMuted}>
            {pack.real && pack.state === 'owned' ? 'Open' : 'Locked'}
          </Txt>
        </View>
      </View>

      {pack.real ? <RealPackCard pack={pack} onBuy={onBuy} /> : <ConceptPackCard />}
    </Screen>
  );
}

export function RealPackCard({ pack, onBuy }: { pack: SeasonPackView; onBuy?: () => void }) {
  const test = pack.environment === 'production' ? '' : ' · Whop test purchase';
  return (
    <View style={styles.real}>
      <Txt style={styles.realTitle}>Season 01</Txt>
      <Txt variant="body" color={Palette.paperMuted}>
        Every Kestrel Station drop.
      </Txt>
      {pack.state === 'locked' ? (
        <>
          <Pressable style={styles.buy} accessibilityRole="button" onPress={onBuy}>
            <Txt variant="button" color={Palette.onAccent}>
              Get Season 01 · $4.99
            </Txt>
          </Pressable>
          {pack.error ? (
            <Txt variant="small" color={Palette.danger}>
              Checkout didn’t open. Try again.
            </Txt>
          ) : null}
        </>
      ) : pack.state === 'owned' ? (
        <View style={styles.owned}>
          <Icon name="checkmark" size={16} color={Palette.paper} />
          <Txt variant="bodyStrong">{`Owned${test}`}</Txt>
        </View>
      ) : (
        <View style={styles.owned}>
          <ActivityIndicator color={Palette.paper} />
          <Txt variant="bodyStrong">{pack.state === 'checkout' ? 'Finish checkout on Whop…' : 'Verifying with Whop…'}</Txt>
        </View>
      )}
    </View>
  );
}

export function ConceptPackCard() {
  return (
    <View style={styles.concept} accessibilityLabel="Concept. Season pack, not for sale yet.">
      <View style={styles.stamp}>
        <Txt style={styles.stampText}>CONCEPT</Txt>
      </View>
      <Label color={Palette.paperMuted}>Season pack · via Whop · concept</Label>
      <Txt variant="title" color={Palette.paperMuted}>
        Season 01 pack
      </Txt>
      <Txt variant="small" color={Palette.paperMuted}>
        Not for sale yet. This is how paid episodes would work: sold through Whop’s hosted checkout, unlocked only by a
        server-verified purchase.
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  head: { gap: 4, marginTop: Space.s },
  episodes: { backgroundColor: Palette.card, borderRadius: Radius.l, borderWidth: 1, borderColor: Palette.hairline, paddingHorizontal: Space.l },
  episode: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: Space.m, paddingVertical: Space.m },
  rule: { borderTopWidth: 1, borderTopColor: Palette.hairline },
  real: {
    backgroundColor: Palette.card,
    borderWidth: 1,
    borderColor: Palette.hairline,
    borderRadius: Radius.l,
    padding: Space.xl,
    gap: Space.m,
    boxShadow: '0 1px 2px rgba(26,25,22,0.04), 0 8px 24px rgba(26,25,22,0.05)',
  },
  realTitle: { fontFamily: FontFamily.displayBold, fontSize: 22, lineHeight: 28, color: Palette.paper },
  buy: { minHeight: 56, borderRadius: Radius.m, backgroundColor: Palette.ember, alignItems: 'center', justifyContent: 'center', marginTop: Space.s },
  owned: {
    minHeight: 56,
    borderRadius: Radius.m,
    backgroundColor: Palette.paperShade,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space.s,
    marginTop: Space.s,
  },
  concept: {
    borderRadius: Radius.l,
    padding: Space.xl,
    gap: Space.s,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Palette.paperFaint,
    overflow: 'hidden',
  },
  stamp: {
    position: 'absolute',
    right: 14,
    top: 18,
    borderWidth: 2,
    borderColor: Palette.paperMuted,
    borderRadius: Radius.s,
    paddingHorizontal: 8,
    paddingVertical: 2,
    transform: [{ rotate: '-10deg' }],
  },
  stampText: { fontFamily: FontFamily.uiBold, fontSize: 13, letterSpacing: 3, color: Palette.paperMuted },
});
