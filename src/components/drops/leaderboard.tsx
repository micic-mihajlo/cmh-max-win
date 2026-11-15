import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/signal/backdrop';
import { Icon } from '@/components/signal/icon';
import { Button, Label, NextStep } from '@/components/signal/primitives';
import { Txt } from '@/components/signal/txt';
import { Palette, Radius, Space } from '@/constants/signal';
import { Stagger } from '@/motion';

import type { DropView, LeaderboardRow, LeaderboardView } from './contract';
import { BountyLine, clock, ordinal } from './ui';

function Row({ row }: { row: LeaderboardRow }) {
  const winner = row.status === 'winner';
  const solving = row.status === 'solving';
  return (
    <View style={[styles.row, row.isMine && styles.rowMine, winner && styles.rowWinner]}>
      <Txt variant="name" color={winner ? Palette.ember : solving ? Palette.paperFaint : Palette.paper} style={styles.rank}>
        {row.rank ?? '–'}
      </Txt>
      <View style={styles.flex}>
        <Txt variant="bodyStrong">
          {row.squadLabel}
          {row.isMine ? ' · you' : ''}
        </Txt>
        <Txt variant="small" color={Palette.paperMuted} numberOfLines={1}>
          {row.memberNames.join(' · ')}
        </Txt>
      </View>
      <View style={styles.right}>
        {solving ? (
          <Txt variant="smallStrong" color={Palette.paperMuted}>
            solving…
          </Txt>
        ) : (
          <Txt variant="time">{clock(row.solveMs ?? 0)}</Txt>
        )}
        {winner ? (
          <View style={styles.badge}>
            <Icon name="trophy.fill" size={11} color={Palette.ink} />
            <Txt variant="label" color={Palette.ink}>
              Bounty
            </Txt>
          </View>
        ) : row.status === 'solved' ? (
          <Txt variant="label" color={Palette.paperFaint}>
            Solved
          </Txt>
        ) : null}
      </View>
    </View>
  );
}

export function LeaderboardScreen({ drop, board, now }: { drop: DropView; board: LeaderboardView; now: number }) {
  const winners = board.rows.filter((r) => r.status === 'winner').length;
  const left = board.winnerSlots - winners;
  const mine = board.rows.find((r) => r.isMine);
  const solved = board.rows.filter((r) => r.rank !== null).length;
  const status = !mine
    ? 'You’re watching this race.'
    : mine.status === 'solving'
      ? `Your squad is still solving. ${solved} squads have finished.`
      : `Your squad finished ${ordinal(mine.rank ?? 0)}.`;
  return (
    <Screen
      footer={
        <>
          <NextStep>{status}</NextStep>
          {mine?.status === 'solving' ? <Button title="Back to the case" /> : null}
        </>
      }>
      <View style={styles.head}>
        <View style={styles.liveRow}>
          <View style={styles.liveDot} />
          <Label color={Palette.ember}>Live · {clock(now - board.startsAt)}</Label>
        </View>
        <Txt variant="display">{drop.title}</Txt>
        <BountyLine bounty={drop.bounty} />
      </View>
      <View style={styles.slots}>
        {Array.from({ length: board.winnerSlots }, (_, i) => (
          <View key={i} style={[styles.slot, i < winners && styles.slotTaken]}>
            <Txt variant="smallStrong" color={i < winners ? Palette.ink : Palette.paperMuted}>
              {ordinal(i + 1)}
            </Txt>
          </View>
        ))}
        <Txt variant="smallStrong" color={left > 0 ? Palette.paper : Palette.paperMuted} style={styles.flex}>
          {left > 0 ? `${left} of ${board.winnerSlots} bounty slots left` : 'All bounty slots taken'}
        </Txt>
      </View>
      <View style={styles.list}>
        <Stagger>
          {board.rows.map((r) => (
            <Row key={r.squadLabel} row={r} />
          ))}
        </Stagger>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  head: { gap: Space.s, marginTop: Space.s },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: Space.s },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Palette.ember,
  },
  slots: { flexDirection: 'row', alignItems: 'center', gap: Space.s },
  slot: {
    width: 44,
    height: 32,
    borderRadius: Radius.s,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Palette.paperMuted,
  },
  slotTaken: {
    backgroundColor: Palette.ember,
    borderColor: Palette.ember,
    borderStyle: 'solid',
  },
  list: { gap: 6 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.m,
    paddingVertical: 10,
    paddingHorizontal: Space.m,
    borderRadius: Radius.m,
    backgroundColor: Palette.panel,
    borderWidth: 1,
    borderColor: Palette.hairline,
  },
  rowMine: { borderColor: Palette.paper },
  rowWinner: { backgroundColor: 'rgba(227,155,91,0.08)' },
  rank: { width: 26, textAlign: 'center', fontVariant: ['tabular-nums'] },
  right: { alignItems: 'flex-end', gap: 2 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.pill,
    backgroundColor: Palette.ember,
  },
});
