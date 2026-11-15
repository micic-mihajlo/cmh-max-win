import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/signal/backdrop';
import { Icon } from '@/components/signal/icon';
import { Button, Label, NextStep, Segmented } from '@/components/signal/primitives';
import { Txt } from '@/components/signal/txt';
import { Palette, Radius, RoleColors, Space } from '@/constants/signal';

import type { BountyMode, SquadSize } from './contract';
import { ModeTag, money, PieceLabel, Tagline } from './ui';

export type CreatorDraft = {
  title: string;
  squadSize: SquadSize;
  totalCents: number;
  winnerSlots: number;
  startsInMin: number;
  mode: BountyMode;
};

function Stepper({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <View style={styles.field}>
      <Label>{label}</Label>
      <View style={styles.stepper}>
        <View style={styles.stepBtn}>
          <Icon name="minus" size={14} color={Palette.paperMuted} />
        </View>
        <Txt variant="title" style={styles.stepValue}>
          {value}
        </Txt>
        <View style={styles.stepBtn}>
          <Icon name="plus" size={14} color={Palette.paper} />
        </View>
      </View>
      <Txt variant="small" color={Palette.paperMuted}>
        {hint}
      </Txt>
    </View>
  );
}

export function CreatorSetupScreen({ draft, publishing }: { draft: CreatorDraft; publishing?: boolean }) {
  const perSquad = Math.floor(draft.totalCents / draft.winnerSlots);
  const perPlayer = Math.floor(perSquad / draft.squadSize);
  return (
    <Screen
      footer={
        <>
          <NextStep>{`Goes live now. Squads form in ${draft.startsInMin} min.`}</NextStep>
          <Button
            title={publishing ? 'Going live…' : 'Go live'}
            disabled={publishing}
            icon={<Icon name="dot.radiowaves.left.and.right" color={publishing ? Palette.paperMuted : Palette.ink} />}
          />
        </>
      }>
      <View style={styles.head}>
        <Label>New drop</Label>
        <Txt variant="display">Set up your drop</Txt>
        <Txt variant="small" color={Palette.paperMuted}>
          Followers join a waiting room. When it opens, they’re split into squads and race the same challenge.
        </Txt>
      </View>

      <View style={styles.challenge}>
        <Label>Challenge</Label>
        <Txt variant="title">{draft.title}</Txt>
        <Txt variant="small" color={Palette.paperMuted}>
          Who stole the Aurora Seed? 4 suspects, 3 pieces. Solves take 20–45 s.
        </Txt>
        <View style={styles.pieceRow}>
          {(['hacker', 'witness', 'detective'] as const).map((r) => (
            <View key={r} style={[styles.piece, { borderColor: RoleColors[r] }]}>
              <Txt variant="smallStrong" color={RoleColors[r]}>
                {PieceLabel[r]}
              </Txt>
            </View>
          ))}
        </View>
        <Txt variant="quote" color={Palette.paperMuted}>
          {Tagline}
        </Txt>
      </View>

      <View style={styles.field}>
        <Label>Squad size</Label>
        <Segmented
          value={String(draft.squadSize) as '2' | '3'}
          options={[
            { value: '2', label: 'Duos · 2' },
            { value: '3', label: 'Trios · 3' },
          ]}
        />
        <Txt variant="small" color={Palette.paperMuted}>
          Leftovers still play: an odd one out turns a {draft.squadSize === 3 ? 'trio into two duos' : 'duo into a trio'}.
        </Txt>
      </View>

      <View style={styles.row}>
        <Stepper label="Bounty" value={money(draft.totalCents)} hint="Total pool" />
        <Stepper label="Winners" value={String(draft.winnerSlots)} hint="First correct squads" />
      </View>

      <View style={styles.split}>
        <View style={styles.splitHead}>
          <Label>Payout</Label>
          <ModeTag mode={draft.mode} />
        </View>
        <Txt variant="bodyStrong">{`Each of the first ${draft.winnerSlots} squads gets ${money(perSquad)}, ${money(perPlayer)} per player.`}</Txt>
        <Txt variant="small" color={Palette.paperMuted}>
          Free to enter. Skill only: winners are the first correct squads in the order the server checks them.
        </Txt>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { gap: Space.s, marginTop: Space.s },
  challenge: {
    gap: Space.s,
    padding: Space.l,
    borderRadius: Radius.l,
    backgroundColor: Palette.panel,
    borderWidth: 1,
    borderColor: Palette.hairline,
  },
  pieceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginVertical: Space.xs,
  },
  piece: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  field: { flex: 1, gap: Space.s },
  row: { flexDirection: 'row', gap: Space.l },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 6,
    borderRadius: Radius.pill,
    backgroundColor: Palette.panel,
    borderWidth: 1,
    borderColor: Palette.hairline,
  },
  stepBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Palette.panelRaised,
  },
  stepValue: { fontVariant: ['tabular-nums'] },
  split: {
    gap: Space.s,
    borderLeftWidth: 2,
    borderLeftColor: Palette.ember,
    paddingLeft: Space.l,
  },
  splitHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
