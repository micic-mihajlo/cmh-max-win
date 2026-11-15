import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/signal/backdrop';
import { joinNames } from '@/components/signal/room';
import { Button, Label } from '@/components/signal/primitives';
import { Txt } from '@/components/signal/txt';
import { Palette, Radius, Space } from '@/constants/signal';
import { NudgeEntrance, Stagger } from '@/motion';
import { RACE_REVEAL_MS, type DropView, type LeaderboardRow, type LeaderboardView, type Role } from '@/lib/contract';

import { useServerClock } from './clock';
import { short } from './ui';

// RoomView-derived state for the bottom card while the squad is racing.
export type RacingSquad = { pick: string | null; locked: number; size: number; nudge: string | null; cooldownUntil: number | null; agreed?: string[]; meLocked?: boolean };

const squadNames = (names: string[]) => (names.length > 1 ? `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}` : names.join(''));

// Only our row carries a time; other squads are dimmed labels.
function Row({ row }: { row: LeaderboardRow }) {
  return (
    <View style={styles.row}>
      <Txt variant="bodyStrong" color={row.isMine ? Palette.paper : Palette.paperMuted} style={styles.rank}>
        {row.rank ?? ''}
      </Txt>
      {row.isMine && row.memberNames.length ? (
        <View style={styles.flex}>
          <Txt variant="bodyStrong">{squadNames(row.memberNames)}</Txt>
          <Txt variant="caption" color={Palette.paperMuted}>
            {row.squadLabel}
          </Txt>
        </View>
      ) : (
        <Txt variant="bodyStrong" color={row.isMine ? Palette.paper : Palette.paperMuted} style={styles.flex}>
          {row.squadLabel}
          {row.isMine ? ' · you' : ''}
        </Txt>
      )}
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
  const title = inMoney || missed ? `You ${(mine?.memberNames.length || drop.squadSize) === 2 ? 'two' : 'three'} got #${mine?.rank}.` : 'Race';
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
                {`${racing.locked} of ${racing.size} locked`}
              </Txt>
            </View>
            {racing.agreed?.length && !racing.meLocked ? <Txt variant="bodyStrong">{`${joinNames(racing.agreed)} agreed. Your call.`}</Txt> : null}
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
            <Txt variant="small" color={Palette.paperMuted} style={styles.center}>
              {`Jun took the seed. ${(mine?.memberNames.length || drop.squadSize) === 2 ? 'Both pieces' : 'All three pieces'} counted.`}
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
  list: { backgroundColor: Palette.panel, borderRadius: 16, paddingHorizontal: Space.l },
  row: { flexDirection: 'row', alignItems: 'center', gap: Space.m, height: 56 },
  rank: { minWidth: 28, fontVariant: ['tabular-nums'] },
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
