import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Icon } from '@/components/signal/icon';
import { Label } from '@/components/signal/primitives';
import { Txt } from '@/components/signal/txt';
import { Palette, Radius, RoleColors, Space } from '@/constants/signal';
import type { Role, BountyMode, BountyView, DropSummaryView } from '@/lib/contract';

export const Tagline = 'Everyone holds a piece. Nobody solves it alone.';

export const PieceLabel: Record<Role, string> = {
  hacker: 'Camera Log',
  witness: 'Statement',
  detective: 'Scene Notes',
};

export const Brass = RoleColors.detective;

export function money(cents: number) {
  return cents % 100 === 0 ? `$${cents / 100}` : `$${(cents / 100).toFixed(2)}`;
}

export function money2(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export function short(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function clock(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export function ordinal(n: number) {
  const tail = n % 100 >= 11 && n % 100 <= 13 ? 'th' : (({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th');
  return `${n}${tail}`;
}

export function names(list: string[]) {
  if (list.length <= 1) return list.join('');
  return `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`;
}

export function ModeTag({ mode }: { mode: BountyMode }) {
  const concept = mode === 'concept';
  return (
    <View style={[styles.mode, concept ? styles.modeConcept : styles.modeReal]}>
      <Icon name={concept ? 'flask' : 'checkmark.seal.fill'} size={12} color={concept ? Brass : Palette.ok} />
      <Txt variant="label" color={concept ? Brass : Palette.ok}>
        {concept ? 'Concept' : 'Verified · Whop sandbox'}
      </Txt>
    </View>
  );
}

export function BountyLine({ bounty }: { bounty: BountyView }) {
  return (
    <View style={styles.bounty}>
      <Txt variant="title" color={Palette.paper}>
        {money(bounty.totalCents)}
      </Txt>
      <Txt variant="small" color={Palette.paperMuted} style={styles.flex}>
        split by the first {bounty.winnerSlots} correct squads · {money(bounty.perSquadCents)} each
      </Txt>
    </View>
  );
}

export function DropCard({ drop, children }: { drop: DropSummaryView; children?: ReactNode }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <View style={styles.avatar}>
          <Txt variant="bodyStrong" color={Palette.ink}>
            {drop.creatorName.replace('@', '').slice(0, 1).toUpperCase()}
          </Txt>
        </View>
        <View style={styles.flex}>
          <Txt variant="smallStrong">{drop.creatorName}</Txt>
          <Txt variant="small" color={Palette.paperMuted}>
            {drop.status === 'scheduled' ? 'Drop · free to enter' : drop.status === 'live' ? 'Drop · live now' : 'Drop · ended'}
          </Txt>
        </View>
        <ModeTag mode={drop.bounty.mode} />
      </View>
      <Txt variant="display">{drop.title}</Txt>
      <BountyLine bounty={drop.bounty} />
      <View style={styles.pieces}>
        <Txt variant="small" color={Palette.paperMuted} style={styles.flex}>
          3 pieces, split across your squad. {Tagline}
        </Txt>
      </View>
      {children}
    </View>
  );
}

export function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <View style={styles.stat}>
      <Label>{label}</Label>
      <Txt variant="code" color={accent ?? Palette.paper} style={styles.statValue}>
        {value}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  mode: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  modeConcept: { borderColor: Brass, borderStyle: 'dashed' },
  modeReal: { borderColor: Palette.ok },
  bounty: { flexDirection: 'row', alignItems: 'baseline', gap: Space.s },
  card: {
    gap: Space.m,
    padding: Space.l,
    borderRadius: Radius.l,
    backgroundColor: Palette.panel,
    borderWidth: 1,
    borderColor: Palette.hairline,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: Space.m },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Palette.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pieces: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  piece: { width: 14, height: 18, borderRadius: 3, borderWidth: 1.5 },
  stat: { flex: 1, gap: 2 },
  statValue: { fontSize: 40, lineHeight: 48, letterSpacing: 1 },
});
