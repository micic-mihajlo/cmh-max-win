import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/signal/backdrop';
import { Button, Label } from '@/components/signal/primitives';
import { Txt } from '@/components/signal/txt';
import { Palette, Radius, RoleColors, Space } from '@/constants/signal';
import { Enter } from '@/motion';
import type { Role } from '@/lib/contract';

import { useServerNow } from './clock';
import type { BountyView, SquadAwardView } from './contract';
import { Brass, clock, ModeTag, money2, PieceLabel } from './ui';

export type CreditedMember = { name: string; isMe: boolean; roles: Role[] };

// The win screen. Only the winning squad ever gets a SquadAwardView, so there is no loser variant here.
export function BountyResultScreen({
  award,
  bounty,
  squadLabel,
  members,
  serverNow,
}: {
  award: SquadAwardView;
  bounty: BountyView;
  squadLabel: string;
  members: CreditedMember[];
  serverNow: number;
}) {
  const now = useServerNow(serverNow);
  const concept = award.mode === 'concept';
  const real = !concept && award.status === 'ready' && award.claimUrl;
  return (
    <Screen
      footer={
        real ? (
          <>
            <Button title="Claim your share on Whop" />
            {award.expiresAt ? (
              <Txt variant="small" color={Palette.paperMuted} style={styles.center}>
                Link expires in {clock(award.expiresAt - now)}
              </Txt>
            ) : null}
          </>
        ) : (
          <Button title="See the reveal" variant="secondary" />
        )
      }>
      <View style={styles.headRow}>
        <Label>{`${squadLabel} · #${award.place} of ${bounty.winnerSlots}`}</Label>
        <ModeTag mode={award.mode} />
      </View>
      <Enter>
        <Txt variant="display">You’re in the money.</Txt>
      </Enter>
      <View style={styles.share}>
        <Label>Your share</Label>
        <Txt variant="hero" color={concept ? Palette.paper : Palette.ember}>
          {money2(award.perPlayerCents)}
        </Txt>
      </View>
      <View style={styles.card}>
        <Line k="Bounty" v={money2(bounty.totalCents)} />
        <Line k={`÷ ${bounty.winnerSlots} winning squads`} v={money2(award.amountCents)} />
        <Line k={`÷ ${award.redeemableCount} players in ${squadLabel}`} v={money2(award.perPlayerCents)} strong />
      </View>
      <View style={styles.card}>
        {members.map((m) => (
          <View key={m.name} style={styles.mem}>
            <View style={[styles.avatar, { backgroundColor: m.isMe ? Palette.ember : RoleColors[m.roles[0]] }]}>
              <Txt variant="smallStrong" color={Palette.ink}>
                {m.name.charAt(0)}
              </Txt>
            </View>
            <Txt variant="bodyStrong" style={styles.flex}>
              {m.isMe ? `${m.name} · you` : m.name}
            </Txt>
            <Txt variant="small" color={Palette.paperMuted}>
              {m.roles.map((r) => PieceLabel[r]).join(' + ')}
            </Txt>
          </View>
        ))}
      </View>
      {concept ? (
        <View style={styles.concept} accessibilityLabel="Concept payout. Nothing to tap.">
          <View style={styles.conceptHead}>
            <Txt variant="bodyStrong">Claim your share on Whop</Txt>
            <ModeTag mode="concept" />
          </View>
          <Txt variant="small" color={Palette.paperMuted}>
            In the live version, each player signs in to Whop and claims once. The link expires 24 h after the win.
          </Txt>
          <Txt variant="label" color={Brass}>
            {award.label}
          </Txt>
        </View>
      ) : !real ? (
        <Txt variant="small" color={Palette.paperMuted}>
          Creating your squad’s claim link on Whop…
        </Txt>
      ) : null}
    </Screen>
  );
}

function Line({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <View style={styles.line}>
      <Txt variant={strong ? 'bodyStrong' : 'body'} color={strong ? Palette.paper : Palette.paperMuted} style={styles.flex}>
        {k}
      </Txt>
      <Txt variant={strong ? 'bodyStrong' : 'body'} style={styles.num}>
        {v}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Space.s },
  share: { gap: 2 },
  card: { gap: 10, padding: Space.l, borderRadius: 16, backgroundColor: Palette.panel, borderWidth: StyleSheet.hairlineWidth, borderColor: Palette.hairline },
  line: { flexDirection: 'row', alignItems: 'center' },
  num: { fontVariant: ['tabular-nums'] },
  mem: { flexDirection: 'row', alignItems: 'center', gap: Space.m },
  avatar: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  concept: { gap: Space.s, padding: Space.l, borderRadius: Radius.l, borderWidth: 1.5, borderStyle: 'dashed', borderColor: Brass },
  conceptHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Space.s },
});
