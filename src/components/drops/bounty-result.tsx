import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/signal/backdrop';
import { Icon } from '@/components/signal/icon';
import { Button, Label, NextStep } from '@/components/signal/primitives';
import { Txt } from '@/components/signal/txt';
import { Palette, Radius, Space } from '@/constants/signal';
import { Enter } from '@/motion';

import type { DropView, LeaderboardRow, SquadAwardView } from './contract';
import { clock, ModeTag, money, names, ordinal, Tagline } from './ui';

export function BountyResultScreen({ drop, row, award, squad }: { drop: DropView; row: LeaderboardRow; award: SquadAwardView | null; squad: string[] }) {
  const me = squad[0];
  const others = squad.slice(1);
  const place = ordinal(row.rank ?? 0);
  if (!award) {
    return (
      <Screen
        footer={
          <>
            <NextStep>{`The first ${drop.bounty.winnerSlots} squads took the bounty. Next drop, read faster.`}</NextStep>
            <Button title="See the leaderboard" variant="secondary" />
          </>
        }>
        <View style={styles.head}>
          <Label color={Palette.ok}>{row.squadLabel} · solved</Label>
          <Txt variant="hero">{`Solved, ${place}.`}</Txt>
          <Txt variant="title" color={Palette.paperMuted}>
            No bounty this time.
          </Txt>
        </View>
        <View style={styles.facts}>
          <Fact label="Time" value={clock(row.solveMs ?? 0)} />
          <Fact label="Wrong guesses" value={String(Math.max(0, row.attempts - 1))} />
          <Fact label="Squad" value={squad.join(' · ')} />
        </View>
        <Txt variant="quote" color={Palette.paperMuted}>
          {Tagline}
        </Txt>
      </Screen>
    );
  }
  const concept = award.mode === 'concept';
  const ready = award.status === 'ready';
  return (
    <Screen
      footer={
        concept ? (
          <>
            <NextStep>Concept preview: in a live drop this opens a Whop claim link.</NextStep>
            <Button title={`Claim ${money(award.perPlayerCents)} (concept)`} disabled />
          </>
        ) : ready ? (
          <>
            <NextStep>{`One link, ${award.redeemableCount} claims. ${names(others)} claim on their own phones.`}</NextStep>
            <Button title={`Claim ${money(award.perPlayerCents)} on Whop`} icon={<Icon name="arrow.up.right" color={Palette.ink} />} />
          </>
        ) : (
          <>
            <NextStep>Creating your squad’s claim link on Whop…</NextStep>
            <Button title="Preparing claim link" disabled icon={<ActivityIndicator color={Palette.paperMuted} />} />
          </>
        )
      }>
      <View style={styles.head}>
        <View style={styles.headRow}>
          <Label color={Palette.ember}>
            {row.squadLabel} · {place} place
          </Label>
          <ModeTag mode={award.mode} />
        </View>
        <Enter>
          <Txt variant="hero">You won.</Txt>
        </Enter>
        <Txt variant="title">{`${money(award.amountCents)} for ${row.squadLabel}, solved in ${clock(row.solveMs ?? 0)}.`}</Txt>
      </View>
      {concept ? (
        <View style={styles.concept}>
          <Label>Concept</Label>
          <Txt variant="bodyStrong">{award.label}</Txt>
          <Txt variant="small" color={Palette.paperMuted}>
            This shows how a winning squad gets paid. No link was created.
          </Txt>
        </View>
      ) : null}
      <View style={[styles.split, concept && styles.splitConcept]}>
        {squad.map((n) => (
          <View key={n} style={styles.splitRow}>
            <Txt variant="bodyStrong" style={styles.flex}>
              {n === me ? `${n} (you)` : n}
            </Txt>
            <Txt variant="name" color={concept ? Palette.paperMuted : Palette.ember}>
              {money(award.perPlayerCents)}
            </Txt>
          </View>
        ))}
      </View>
      {!concept && ready && award.claimUrl ? (
        <View style={styles.link}>
          <Icon name="link" size={14} color={Palette.paperMuted} />
          <Txt variant="small" color={Palette.paperMuted} numberOfLines={1} style={styles.flex}>
            {award.claimUrl.replace('https://', '')}
          </Txt>
          <Txt variant="label" color={Palette.ok}>
            {`0 of ${award.redeemableCount} claimed`}
          </Txt>
        </View>
      ) : null}
      {!concept ? (
        <Txt variant="small" color={Palette.paperMuted}>
          Sign in to Whop to claim. Each squad member claims once, and only your squad can see this link.
        </Txt>
      ) : null}
    </Screen>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <Label>{label}</Label>
      <Txt variant="bodyStrong" style={styles.flex}>
        {value}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  head: { gap: Space.s, marginTop: Space.s },
  headRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  concept: {
    gap: 4,
    padding: Space.l,
    borderRadius: Radius.m,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Palette.paperMuted,
  },
  split: {
    padding: Space.l,
    gap: Space.m,
    borderRadius: Radius.l,
    backgroundColor: Palette.panel,
    borderWidth: 1,
    borderColor: Palette.hairline,
  },
  splitConcept: { opacity: 0.75 },
  splitRow: { flexDirection: 'row', alignItems: 'center' },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.s,
    padding: Space.m,
    borderRadius: Radius.m,
    backgroundColor: Palette.panel,
    borderWidth: 1,
    borderColor: Palette.ok,
  },
  facts: {
    gap: Space.m,
    padding: Space.l,
    borderRadius: Radius.l,
    backgroundColor: Palette.panel,
    borderWidth: 1,
    borderColor: Palette.hairline,
  },
  fact: { flexDirection: 'row', alignItems: 'center', gap: Space.l },
});
