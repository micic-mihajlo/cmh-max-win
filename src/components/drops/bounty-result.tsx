import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/signal/backdrop';
import { Button } from '@/components/signal/primitives';
import { Txt } from '@/components/signal/txt';
import { Palette, Radius, Space } from '@/constants/signal';
import type { AwardPayoutView, BountyView, SquadAwardView } from '@/lib/contract';
import { Enter } from '@/motion';

import { Brass, money, money2 } from './ui';

const failures: Record<string, string> = {
  kyc_required: 'Whop couldn’t send it yet. The host’s Whop business still needs to be verified.',
  transfer_unavailable: 'Whop couldn’t send it yet. The prize balance isn’t available on Whop right now.',
};

function payoutLine(p: AwardPayoutView) {
  if (p.message) return p.message;
  if (p.status === 'sign_in_required') return `Sign in with Whop to receive ${money2(p.amountCents)}.`;
  if (p.status === 'sending') return 'Sending to your Whop balance…';
  if (p.status === 'sent') return 'Sent to your Whop balance.';
  if (p.status === 'failed') return failures[p.failureCode ?? ''] ?? 'Whop couldn’t send it. Nothing was charged, and your share is still yours.';
  return null;
}

// The payout beat: your share, where it is, and how the squad split it. Only the winning squad gets a SquadAwardView.
export function BountyResultScreen({
  award,
  bounty,
  signingIn,
  on,
}: {
  award: SquadAwardView;
  bounty: BountyView;
  signingIn?: boolean;
  on?: { onSignIn?: () => void; onContinue?: () => void };
}) {
  const p = award.myPayout;
  const concept = p.status === 'concept';
  const line = payoutLine(p);
  const split = [...award.split].sort((a, b) => Number(b.isMe) - Number(a.isMe));
  return (
    <Screen
      contentStyle={styles.centerBlock}
      footer={
        p.status === 'sign_in_required' ? (
          <>
            <Button title={signingIn ? 'Opening Whop…' : 'Sign in with Whop'} disabled={signingIn} onPress={on?.onSignIn} />
            <Button title="Continue" variant="ghost" onPress={on?.onContinue} />
          </>
        ) : (
          <Button title="Continue" onPress={on?.onContinue} />
        )
      }>
      <Enter from={8}>
        <View style={[styles.card, concept && styles.concept]}>
          <Txt variant="display">{concept ? `${money2(award.perPlayerCents)} each` : money2(p.amountCents)}</Txt>
          {concept ? (
            <>
              <Txt variant="body" color={Palette.paperMuted}>
                {`${money(bounty.totalCents)} ÷ ${bounty.winnerSlots} squads ÷ ${award.redeemableCount} players`}
              </Txt>
              <Txt variant="label" color={Brass}>
                Concept · no real money moves
              </Txt>
            </>
          ) : (
            <View style={styles.status}>
              {p.status === 'sending' ? <ActivityIndicator size="small" color={Palette.paperMuted} /> : null}
              <Txt variant="body" color={p.status === 'failed' ? Palette.danger : Palette.paperMuted} style={styles.flex}>
                {line}
              </Txt>
            </View>
          )}
          {!concept && p.status === 'sent' && p.transferId ? (
            <Txt variant="caption" color={Palette.paperMuted} selectable>
              {p.transferId}
            </Txt>
          ) : null}
        </View>
      </Enter>
      <Enter from={8} delay={80}>
        <View style={styles.split}>
          {split.map((s, i) => (
            <View key={`${s.name}-${i}`} style={styles.row}>
              <Txt variant={s.isMe ? 'bodyStrong' : 'body'} color={s.isMe ? Palette.paper : Palette.paperMuted} style={styles.flex}>
                {s.isMe ? `${s.name} · you` : s.name}
              </Txt>
              <Txt variant={s.isMe ? 'bodyStrong' : 'body'} color={s.isMe ? Palette.paper : Palette.paperMuted}>
                {money2(s.cents)}
              </Txt>
            </View>
          ))}
        </View>
      </Enter>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centerBlock: { flexGrow: 1, justifyContent: 'center' },
  flex: { flex: 1 },
  card: { gap: Space.m, padding: Space.xl, borderRadius: Radius.l, backgroundColor: Palette.panel },
  concept: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: Brass, backgroundColor: 'transparent' },
  status: { flexDirection: 'row', alignItems: 'center', gap: Space.s },
  split: { paddingHorizontal: Space.xl },
  row: { flexDirection: 'row', alignItems: 'center', gap: Space.m, height: 64 },
});
