import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/signal/backdrop';
import { Txt } from '@/components/signal/txt';
import { Palette, Radius, Space } from '@/constants/signal';
import { PressScale, Stagger } from '@/motion';

import type { DropTemplateId, RealPayoutStatusView } from '@/lib/contract';

import { Brass, money, Tagline } from './ui';

export type CreatorDrop = { title: string; totalCents: number; winnerSlots: number };
export type Pot = { key: string; label: string; totalCents: number; concept?: boolean };

// Real pots go to the first squad alone, so a trio on $3 gets $1 each: Whop's minimum transfer is $1.00.
export const winnerSlotsFor = (pot: Pot) => (pot.concept ? 3 : 1);
const WHOP_MIN_TRANSFER_CENTS = 100;

// A real pot fits while real payouts are on, the pot is within the remaining budget, one squad's share is within the cap,
// and each of a trio's shares reaches Whop's minimum transfer.
export const potFits = (pot: Pot, real: RealPayoutStatusView | undefined) => {
  if (pot.concept) return true;
  const perSquad = pot.totalCents / winnerSlotsFor(pot);
  return !!real?.enabled && pot.totalCents <= real.remainingCents && perSquad <= real.capPerSquadCents && perSquad / 3 >= WHOP_MIN_TRANSFER_CENTS;
};

export type Challenge = { key: string; label: string; title: string; template?: DropTemplateId };

export const CHALLENGES: Challenge[] = [
  { key: 'split-passphrase', label: 'Split Passphrase · quick', title: 'Split Passphrase', template: 'split-passphrase' },
  { key: 'mystery', label: 'Case 01 · Mystery', title: 'The Aurora Seed' },
];

export const POTS: Pot[] = [
  { key: 'concept', label: 'Concept', totalCents: 30000, concept: true },
  { key: '3', label: '$3', totalCents: 300 },
  { key: '6', label: '$6', totalCents: 600 },
  { key: '9', label: '$9', totalCents: 900 },
];

// Danny's screen: the drop card, a bounty picker, and Open drop. The server decides whether money really moves;
// the live card shows the real entrant count from useDrop.
export function CreatorSetupScreen({
  drop,
  live,
  pot,
  onPot,
  real,
  challenge,
  onChallenge,
  error,
  onOpen,
}: {
  drop: CreatorDrop;
  live?: { entrantCount: number; shareUrl: string };
  pot?: Pot;
  onPot?: (pot: Pot) => void;
  real?: RealPayoutStatusView;
  challenge?: Challenge;
  onChallenge?: (challenge: Challenge) => void;
  error?: string | null;
  onOpen?: () => void;
}) {
  return (
    <Screen
      footer={
        live ? null : (
          <PressScale onPress={onOpen} style={styles.cta}>
            <Txt variant="button" color={Palette.ink}>
              Open drop
            </Txt>
          </PressScale>
        )
      }>
      <View style={styles.head}>
        <Txt variant="display">{live ? 'Your drop is live.' : 'Run a drop'}</Txt>
      </View>
      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.art}>
            <Txt variant="title" color={Palette.paper}>
              A
            </Txt>
          </View>
          <View style={styles.flex}>
            <Txt variant="name">{drop.title}</Txt>
            <Txt variant="small" color={Palette.paperMuted}>
              {`${pot?.concept ? 'Just for fun' : money(drop.totalCents)} · ${drop.winnerSlots === 1 ? 'first squad wins' : `first ${drop.winnerSlots} squads win`}`}
            </Txt>
            {pot ? (
              <Txt variant="label" color={Brass}>
                {pot.concept ? 'Concept · no real money moves' : 'Real · paid via Whop'}
              </Txt>
            ) : null}
          </View>
        </View>
        {live ? (
          <Stagger>
            <View style={styles.line}>
              <Txt variant="small" color={Palette.paperMuted} numberOfLines={1} style={styles.flex}>
                {live.shareUrl}
              </Txt>
              <Txt variant="smallStrong" color={Palette.paper}>
                Share
              </Txt>
            </View>
            <View style={styles.line}>
              <Txt variant="title" style={styles.count}>
                {live.entrantCount}
              </Txt>
              <Txt variant="body" color={Palette.paperMuted}>
                joined
              </Txt>
            </View>
          </Stagger>
        ) : null}
        {!live && challenge && onChallenge ? <Picker label="Challenge" options={CHALLENGES} selected={challenge.key} onPick={onChallenge} /> : null}
        {!live && pot && onPot ? (
          <>
            <Picker label="Bounty" options={POTS} selected={pot.key} onPick={onPot} disabled={(o) => !potFits(o, real)} />
            <Txt variant="small" color={Palette.paperMuted}>
              {real?.enabled ? `Real · paid via Whop · ${money(real.remainingCents)} left` : 'Real payouts are off right now.'}
            </Txt>
          </>
        ) : null}
      </View>
      {error ? (
        <Txt variant="body" color={Palette.danger}>
          {error}
        </Txt>
      ) : null}
      <Txt variant="quote" color={Palette.paperMuted}>
        {Tagline}
      </Txt>
    </Screen>
  );
}

function Picker<T extends { key: string; label: string }>({
  label,
  options,
  selected,
  onPick,
  disabled,
}: {
  label: string;
  options: T[];
  selected: string;
  onPick: (option: T) => void;
  disabled?: (option: T) => boolean;
}) {
  return (
    <View style={styles.picker}>
      <Txt variant="small" color={Palette.paperMuted}>
        {label}
      </Txt>
      <View style={styles.pots}>
        {options.map((o) => {
          const on = o.key === selected;
          const off = !on && !!disabled?.(o);
          return (
            <PressScale
              key={o.key}
              accessibilityRole="button"
              accessibilityState={{ selected: on, disabled: off }}
              onPress={off ? undefined : () => onPick(o)}
              haptic="tap"
              style={[styles.pot, on && styles.potOn, off && styles.potOff]}>
              <Txt variant="smallStrong" color={on ? Palette.ink : Palette.paper}>
                {o.label}
              </Txt>
            </PressScale>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  picker: { gap: Space.s },
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  head: { gap: Space.s, marginTop: Space.s },
  card: { gap: Space.m, padding: Space.l, borderRadius: 16, backgroundColor: Palette.panel, borderWidth: 1.5, borderColor: Palette.hairline },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  art: { width: 56, height: 56, borderRadius: Radius.m, backgroundColor: Palette.panelRaised, alignItems: 'center', justifyContent: 'center' },
  line: { flexDirection: 'row', alignItems: 'baseline', gap: Space.s, paddingTop: Space.s },
  count: { fontVariant: ['tabular-nums'] },
  pots: { flexDirection: 'row', flexWrap: 'wrap', gap: Space.s },
  pot: {
    minWidth: 56,
    height: 40,
    paddingHorizontal: Space.m,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Palette.hairline,
    backgroundColor: Palette.panelRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  potOn: { backgroundColor: Palette.paper, borderColor: Palette.paper },
  potOff: { opacity: 0.4 },
  cta: { height: 52, borderRadius: 16, backgroundColor: Palette.paper, alignItems: 'center', justifyContent: 'center' },
});
