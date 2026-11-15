import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/signal/backdrop';
import { Button, Label } from '@/components/signal/primitives';
import { Txt } from '@/components/signal/txt';
import { Palette, Radius, RoleColors, Space } from '@/constants/signal';
import { NudgeEntrance, Seal, Stagger } from '@/motion';
import { RACE_REVEAL_MS, type DropView, type LeaderboardRow, type LeaderboardView, type Role } from '@/lib/contract';

import { useServerClock } from './clock';
import { short } from './ui';

// RoomView-derived state for the bottom card while the squad is racing.
export type RacingSquad = { pick: string | null; locked: number; size: number; nudge: string | null; cooldownUntil: number | null };

// Only our row carries a time; other squads are dimmed labels.
function Row({ row }: { row: LeaderboardRow }) {
  return (
    <View style={[styles.row, row.isMine ? styles.rowMine : styles.rowOther]}>
      <Txt variant="bodyStrong" color={row.isMine ? Palette.ember : Palette.paperMuted} style={styles.rank}>
        {row.rank ?? '–'}
      </Txt>
      <Txt variant="bodyStrong" color={row.isMine ? Palette.paper : Palette.paperMuted} style={styles.flex}>
        {row.squadLabel}
        {row.isMine ? ' · you' : ''}
      </Txt>
      {row.isMine ? <Txt variant="time">{row.status === 'solving' ? 'Racing' : short(row.solveMs ?? 0)}</Txt> : null}
    </View>
  );
}

export function LeaderboardScreen({
  drop,
  board,
  offset,
  racing,
  roles,
  on,
}: {
  drop: DropView;
  board: LeaderboardView;
  offset: number | null;
  racing?: RacingSquad;
  roles?: Role[];
  on?: { onCase?: () => void; onShare?: () => void; onReveal?: () => void };
}) {
  const now = useServerClock(offset);
  const raceMs = now - (board.startsAt + RACE_REVEAL_MS);
  const cooldown = racing?.cooldownUntil ? racing.cooldownUntil - now : 0;
  const taken = board.rows.filter((r) => r.status === 'winner').length;
  const mine = board.rows.find((r) => r.isMine);
  const solved = board.rows.filter((r) => r.rank !== null);
  const stillRacing = board.rows.length - solved.length;
  const inMoney = mine?.status === 'winner';
  const missed = mine?.status === 'solved';
  const creator = drop.creatorName.replace('@', '');
  const title = inMoney ? `You placed #${mine?.rank}` : missed ? `Solved · #${mine?.rank}` : 'Race';
  const sub = missed
    ? `The bounty went to the first ${board.winnerSlots} squads.`
    : taken >= board.winnerSlots
      ? `All ${board.winnerSlots} bounty spots taken`
      : `${taken} of ${board.winnerSlots} bounty spots taken`;
  const shown = missed ? [...board.rows.filter((r) => r.status === 'winner'), mine!] : board.rows.filter((r) => r.rank !== null || r.isMine);
  return (
    <Screen
      footer={
        !mine ? null : racing ? (
          <View style={styles.card}>
            <View style={styles.cardHead}>
              <Label>Your squad’s pick</Label>
              <Txt variant="smallStrong" color={Palette.paperMuted}>
                {racing.locked} of {racing.size} locked
              </Txt>
            </View>
            <Txt variant="name">{racing.pick ?? 'No pick yet'}</Txt>
            {racing.nudge ? (
              <NudgeEntrance haptic={false}>
                <Txt variant="body" color={Palette.paperMuted}>
                  {racing.nudge}
                </Txt>
              </NudgeEntrance>
            ) : null}
            <Button title={cooldown > 0 ? `Try again in ${short(cooldown)}` : 'Back to the case'} disabled={cooldown > 0} onPress={on?.onCase} />
          </View>
        ) : inMoney ? (
          <>
            <View style={styles.seals}>
              {(roles ?? []).map((r) => (
                <Seal key={r} locked color={RoleColors[r]} initial={r.charAt(0).toUpperCase()} size={44} />
              ))}
            </View>
            <Txt variant="small" color={Palette.paperMuted} style={styles.center}>
              Jun took the seed. All three pieces counted.
            </Txt>
            <Button title="See your share" onPress={on?.onShare} />
          </>
        ) : (
          <>
            <Txt variant="small" color={Palette.paperMuted} style={styles.center}>
              {`You solved it in ${short(mine?.solveMs ?? 0)} with ${mine?.attempts ?? 0} wrong guess${mine?.attempts === 1 ? '' : 'es'}. Jun took the seed.`}
            </Txt>
            <Button title="See the reveal" variant="secondary" onPress={on?.onReveal} />
          </>
        )
      }>
      <Label>{`${creator.charAt(0).toUpperCase()}${creator.slice(1)}’s drop · ${drop.title}`}</Label>
      <View style={styles.titleRow}>
        <View style={styles.flex}>
          <Txt variant="display">{title}</Txt>
          <Txt variant="small" color={Palette.paperMuted}>
            {sub}
          </Txt>
        </View>
        <Txt variant="time">{short(missed || inMoney ? (mine?.solveMs ?? 0) : raceMs)}</Txt>
      </View>
      <View style={styles.spots}>
        {Array.from({ length: board.winnerSlots }, (_, i) => (
          <View key={i} style={[styles.spot, i < taken && styles.spotTaken]} />
        ))}
      </View>
      <View style={styles.list}>
        <Stagger>
          {shown.map((r) => (
            <Row key={r.squadLabel} row={r} />
          ))}
        </Stagger>
      </View>
      {racing && stillRacing > 1 ? (
        <Txt variant="small" color={Palette.paperMuted} style={styles.center}>
          {stillRacing - 1} squads still racing
        </Txt>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Space.m },
  spots: { flexDirection: 'row', gap: 6 },
  spot: { flex: 1, height: 8, borderRadius: Radius.pill, backgroundColor: Palette.panelRaised },
  spotTaken: { backgroundColor: Palette.ember },
  list: { gap: 6 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.m,
    paddingVertical: 12,
    paddingHorizontal: Space.l,
    borderRadius: Radius.m,
    backgroundColor: Palette.panel,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.hairline,
  },
  rowMine: { borderWidth: 1, borderColor: Palette.ember },
  rowOther: { opacity: 0.5 },
  rank: { width: 20, fontVariant: ['tabular-nums'] },
  card: {
    gap: Space.s,
    padding: Space.l,
    borderRadius: 16,
    backgroundColor: Palette.panel,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.hairline,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  seals: { flexDirection: 'row', justifyContent: 'center', gap: Space.m },
});
