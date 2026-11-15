import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/signal/backdrop';
import { Icon } from '@/components/signal/icon';
import { Button, Label } from '@/components/signal/primitives';
import { joinNames } from '@/components/signal/room';
import { Txt } from '@/components/signal/txt';
import { FontFamily, Palette, Radius, RoleMeta, Space } from '@/constants/signal';
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
        <Label color={Palette.paperMuted}>Your season</Label>
        <Txt variant="display">Kestrel Station</Txt>
      </View>

      <View style={styles.solved}>
        <View style={styles.solvedTop}>
          <Label color={Palette.ok}>Case 01 · solved</Label>
          <Icon name="checkmark.seal.fill" size={20} color={Palette.ok} />
        </View>
        <Txt variant="title">The Aurora Seed</Txt>
        <Txt variant="small" color={Palette.paperMuted}>
          Solved on attempt {attempts} by {joinNames(crew)}.
        </Txt>
        <View style={styles.crew}>
          {(['detective', 'hacker', 'witness'] as const).map((r) => (
            <View key={r} style={[styles.crewDot, { backgroundColor: RoleMeta[r].color }]} />
          ))}
        </View>
      </View>

      <View style={styles.coming}>
        <Label>Episode 02 · coming</Label>
        <Txt variant="title">The Second Seed</Txt>
        <Txt variant="small" color={Palette.paperMuted}>
          Coming. Your crew will pick up where you left off.
        </Txt>
      </View>

      {pack.real ? <RealPackCard pack={pack} onBuy={onBuy} /> : <ConceptPackCard />}
    </Screen>
  );
}

export function RealPackCard({ pack, onBuy }: { pack: SeasonPackView; onBuy?: () => void }) {
  return (
    <View style={styles.real}>
      <View style={styles.realTop}>
        <View style={styles.whopBadge}>
          <Txt variant="label" color={Palette.paper}>
            {pack.environment === 'production' ? 'Whop' : 'Whop · test purchase'}
          </Txt>
        </View>
        {pack.state === 'owned' ? (
          <View style={styles.ownedBadge}>
            <Icon name="checkmark" size={12} color={Palette.paper} />
            <Txt variant="label" color={Palette.paper}>
              Owned
            </Txt>
          </View>
        ) : null}
      </View>
      <Txt style={styles.realTitle}>Season 01 pack</Txt>
      <Txt variant="evidence" color={Palette.inkOnPaper}>
        Every new Kestrel Station episode, starting with The Second Seed.
      </Txt>
      {pack.state === 'locked' ? (
        <>
          <Txt variant="bodyStrong" color={Palette.inkOnPaper}>
            $4.99 · one-time · sandbox
          </Txt>
          <Pressable style={styles.buy} accessibilityRole="button" onPress={onBuy}>
            <Txt variant="button" color={Palette.ink}>
              Get the season
            </Txt>
          </Pressable>
          <Txt variant="small" color={pack.error ? Palette.danger : Palette.inkOnPaperMuted}>
            {pack.error ? 'Checkout didn’t open. Try again.' : 'Checkout opens on Whop. The pack unlocks only after our server verifies the payment.'}
          </Txt>
        </>
      ) : pack.state === 'checkout' ? (
        <>
          <View style={[styles.buy, styles.verifying]}>
            <ActivityIndicator color={Palette.inkOnPaper} />
            <Txt variant="button" color={Palette.inkOnPaper}>
              Finish checkout on Whop…
            </Txt>
          </View>
          <Txt variant="small" color={Palette.inkOnPaperMuted}>
            Whop’s checkout is open. Pay there, then come back here.
          </Txt>
        </>
      ) : pack.state === 'verifying' ? (
        <>
          <View style={[styles.buy, styles.verifying]}>
            <ActivityIndicator color={Palette.inkOnPaper} />
            <Txt variant="button" color={Palette.inkOnPaper}>
              Verifying with Whop…
            </Txt>
          </View>
          <Txt variant="small" color={Palette.inkOnPaperMuted}>
            Back from checkout. We unlock the pack when the server confirms the payment, not before. You can close this screen.
          </Txt>
        </>
      ) : (
        <>
          <View style={styles.ownedRow}>
            <Icon name="checkmark.seal.fill" size={22} color="#3E6B3A" />
            <Txt variant="bodyStrong" color={Palette.inkOnPaper}>
              Verified by the server{pack.environment === 'sandbox' ? ' · test purchase' : ''}
            </Txt>
          </View>
          <Txt variant="small" color={Palette.inkOnPaperMuted}>
            Episode 02 joins your shelf the day it ships.
          </Txt>
        </>
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
  head: { gap: Space.s, marginTop: Space.s },
  solved: { backgroundColor: Palette.panel, borderRadius: Radius.l, padding: Space.l, gap: 6, borderWidth: 1, borderColor: Palette.hairline },
  solvedTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  crew: { flexDirection: 'row', gap: 6, marginTop: 4 },
  crewDot: { width: 10, height: 10, borderRadius: 5 },
  coming: { borderRadius: Radius.l, padding: Space.l, gap: 6, borderWidth: 1, borderColor: Palette.hairline },
  real: {
    backgroundColor: Palette.paper,
    borderRadius: Radius.l,
    padding: Space.xl,
    gap: Space.m,
    boxShadow: '0 18px 40px rgba(0,0,0,0.45)',
  },
  realTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  realTitle: { fontFamily: FontFamily.display, fontSize: 28, lineHeight: 34, color: Palette.inkOnPaper },
  whopBadge: { backgroundColor: Palette.inkOnPaper, borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 5 },
  ownedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#3E6B3A', borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 5 },
  buy: {
    minHeight: 54,
    borderRadius: Radius.pill,
    backgroundColor: Palette.ember,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: Space.s,
  },
  verifying: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: Palette.inkOnPaper },
  ownedRow: { flexDirection: 'row', alignItems: 'center', gap: Space.s },
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
