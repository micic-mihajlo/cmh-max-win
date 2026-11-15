import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/signal/backdrop';
import { Button } from '@/components/signal/primitives';
import { Txt } from '@/components/signal/txt';
import { Palette, Radius, Space } from '@/constants/signal';
import type { BountyView, SquadAwardView } from '@/lib/contract';

import { useServerClock } from './clock';
import { Brass, clock, ModeTag, money, money2 } from './ui';

// The payout beat: one static card with the math inline. Only the winning squad ever gets a SquadAwardView.
export function BountyResultScreen({
  award,
  bounty,
  squadLabel,
  offset,
  on,
}: {
  award: SquadAwardView;
  bounty: BountyView;
  squadLabel: string;
  offset: number | null;
  on?: { onClaim?: () => void; onContinue?: () => void };
}) {
  const now = useServerClock(offset);
  const concept = award.mode === 'concept';
  const real = !concept && award.status === 'ready' && award.claimUrl;
  const math = `${money(bounty.totalCents)} ÷ ${bounty.winnerSlots} squads ÷ ${award.redeemableCount} players`;
  return (
    <Screen
      contentStyle={styles.centerBlock}
      footer={
        <>
          {real ? <Button title="Claim your share on Whop" onPress={on?.onClaim} /> : null}
          <Button title="Continue" onPress={on?.onContinue} />
        </>
      }>
      <View style={[styles.card, concept ? styles.concept : styles.real]}>
        <View style={styles.cardHead}>
          {concept ? null : <ModeTag mode={award.mode} />}
          <Txt variant="display">{`${money2(award.perPlayerCents)} each`}</Txt>
        </View>
        <Txt variant="body" color={Palette.paperMuted}>
          {math}
        </Txt>
        {concept ? (
          <Txt variant="label" color={Brass}>
            {award.label}
          </Txt>
        ) : real && award.expiresAt ? (
          <Txt variant="small" color={Palette.paperMuted}>
            Link expires in {clock(award.expiresAt - now)}
          </Txt>
        ) : (
          <Txt variant="small" color={Palette.paperMuted}>
            Creating your squad’s claim link on Whop…
          </Txt>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centerBlock: { flexGrow: 1, justifyContent: 'center' },
  card: { gap: Space.m, padding: Space.xl, borderRadius: Radius.l },
  concept: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: Brass },
  real: { borderWidth: 1, borderColor: Palette.ok, backgroundColor: Palette.panel },
  cardHead: { alignItems: 'flex-start', gap: Space.s },
});
