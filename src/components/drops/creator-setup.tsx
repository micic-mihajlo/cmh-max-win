import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/signal/backdrop';
import { Label, Segmented } from '@/components/signal/primitives';
import { Txt } from '@/components/signal/txt';
import { Palette, Radius, Space } from '@/constants/signal';
import { PressScale } from '@/motion';

import type { SquadSize } from './contract';
import { ModeTag, money, money2, Tagline } from './ui';

export type CreatorDraft = { title: string; squadSize: SquadSize; totalCents: number; winnerSlots: number; startsIn: 'now' | '5' | '15' };

function Field({ k, children }: { k: string; children: ReactNode }) {
  return (
    <View style={styles.field}>
      <Txt variant="bodyStrong">{k}</Txt>
      {children}
    </View>
  );
}

function Stepper({ value }: { value: string }) {
  return (
    <View style={styles.step}>
      <View style={styles.stepBtn}>
        <Txt variant="bodyStrong" color={Palette.paperMuted}>
          −
        </Txt>
      </View>
      <Txt variant="bodyStrong" style={styles.stepValue}>
        {value}
      </Txt>
      <View style={styles.stepBtn}>
        <Txt variant="bodyStrong" color={Palette.paperMuted}>
          +
        </Txt>
      </View>
    </View>
  );
}

export function CreatorSetupScreen({ draft, opening }: { draft: CreatorDraft; opening?: boolean }) {
  const perSquad = Math.floor(draft.totalCents / draft.winnerSlots);
  const perPlayer = Math.floor(perSquad / draft.squadSize);
  return (
    <Screen
      footer={
        <>
          <PressScale disabled={opening} style={[styles.cta, opening && styles.ctaBusy]}>
            <Txt variant="button" color={opening ? Palette.paperMuted : Palette.ink}>
              {opening ? 'Opening…' : 'Open drop'}
            </Txt>
          </PressScale>
          <Txt variant="small" color={Palette.paperMuted} style={styles.center}>
            Free to enter. The first correct squads win, no luck involved.
          </Txt>
        </>
      }>
      <View style={styles.head}>
        <Label>New drop · creator</Label>
        <Txt variant="display">Set up your drop</Txt>
      </View>

      <View style={styles.chal}>
        <View style={styles.art}>
          <Txt variant="title" color={Palette.ok}>
            A
          </Txt>
        </View>
        <View style={styles.flex}>
          <Txt variant="name">{draft.title}</Txt>
          <Txt variant="small" color={Palette.paperMuted}>
            Squad whodunit · 3 pieces · ~2 min
          </Txt>
        </View>
      </View>

      <View style={styles.card}>
        <Field k="Squad size">
          <View style={styles.seg}>
            <Segmented
              value={String(draft.squadSize) as '2' | '3'}
              options={[
                { value: '2', label: '2' },
                { value: '3', label: '3' },
              ]}
            />
          </View>
        </Field>
        <Field k="Bounty">
          <Stepper value={money(draft.totalCents)} />
        </Field>
        <Field k="Winning squads">
          <Stepper value={String(draft.winnerSlots)} />
        </Field>
        <Txt variant="small" color={Palette.paperMuted} style={styles.math}>
          Each winning squad gets <Txt variant="smallStrong">{money(perSquad)}</Txt>, so <Txt variant="smallStrong">{money2(perPlayer)}</Txt> per player.
        </Txt>
      </View>

      <View style={styles.card}>
        <Field k="Starts">
          <View style={styles.seg}>
            <Segmented
              value={draft.startsIn}
              options={[
                { value: 'now', label: 'Now' },
                { value: '5', label: '5 min' },
                { value: '15', label: '15 min' },
              ]}
            />
          </View>
        </Field>
        <Field k="Paid with">
          <View style={styles.paid}>
            <Txt variant="body" color={Palette.paperMuted}>
              Whop
            </Txt>
            <ModeTag mode="concept" />
          </View>
        </Field>
      </View>
      <Txt variant="quote" color={Palette.paperMuted}>
        {Tagline}
      </Txt>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  head: { gap: Space.s, marginTop: Space.s },
  chal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: Space.l,
    borderRadius: 16,
    backgroundColor: Palette.panel,
    borderWidth: 1.5,
    borderColor: Palette.ember,
  },
  art: { width: 56, height: 56, borderRadius: Radius.m, backgroundColor: Palette.panelRaised, alignItems: 'center', justifyContent: 'center' },
  card: { borderRadius: 16, backgroundColor: Palette.panel, borderWidth: StyleSheet.hairlineWidth, borderColor: Palette.hairline },
  field: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 56, paddingHorizontal: Space.l, gap: Space.m },
  seg: { minWidth: 140 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: Palette.ink },
  stepValue: { minWidth: 44, textAlign: 'center', fontVariant: ['tabular-nums'] },
  math: { paddingHorizontal: Space.l, paddingBottom: Space.m },
  paid: { flexDirection: 'row', alignItems: 'center', gap: Space.s },
  cta: { height: 54, borderRadius: 16, backgroundColor: Palette.ember, alignItems: 'center', justifyContent: 'center' },
  ctaBusy: { backgroundColor: Palette.panel },
});
