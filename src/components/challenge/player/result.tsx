import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/signal/backdrop';
import { Button } from '@/components/signal/primitives';
import { Txt } from '@/components/signal/txt';
import { Palette, Radius, Space } from '@/constants/signal';
import type { LiveLeaderboardRow, MyPayoutView } from '@/lib/contract';
import { Enter, Haptic, useReduced } from '@/motion';

import { money, ordinal, points } from './format';

// The rank climbs from the back of the field to your place, eased out over 600ms: the one count allowed past 300ms.
function useClimb(to: number | null, from: number | null) {
  const reduced = useReduced();
  const [shown, setShown] = useState<number | null>(null);
  useEffect(() => {
    if (to === null || from === null || reduced || from <= to) return;
    const start = performance.now();
    let frame = requestAnimationFrame(function step(now) {
      const t = Math.min(1, (now - start) / 600);
      setShown(Math.round(from - (from - to) * (1 - (1 - t) ** 3)));
      if (t < 1) frame = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(frame);
  }, [to, from, reduced]);
  return to === null ? null : (shown ?? (reduced || from === null || from <= to ? to : from));
}

export function ResultScreen({
  title,
  teamLabel,
  solo,
  totalPoints,
  ended,
  teamCount,
  leaderboard,
  payout,
  teamCents,
  conceptPool,
  host,
  claiming,
  onClaim,
  onDone,
}: {
  title: string;
  teamLabel: string | null;
  solo: boolean;
  totalPoints: number | null;
  ended: boolean;
  teamCount: number | null;
  leaderboard: LiveLeaderboardRow[] | null;
  payout: MyPayoutView | null;
  teamCents: number | null;
  conceptPool: boolean;
  host: string;
  claiming: boolean;
  onClaim?: () => void;
  onDone: () => void;
}) {
  const mine = leaderboard?.find((r) => r.label === teamLabel) ?? null;
  const place = payout?.place ?? mine?.place ?? null;
  const shownPlace = useClimb(ended ? place : null, teamCount);
  const sent = payout?.adapter === 'whop' && payout.status === 'sent';
  const announced = useRef(false);
  useEffect(() => {
    if (!sent || announced.current) return;
    announced.current = true;
    Haptic.success();
  }, [sent]);
  const footer =
    payout?.needsWhopSignIn && onClaim ? (
      <Button title={claiming ? 'Opening Whop' : 'Claim with Whop'} disabled={claiming} onPress={onClaim} />
    ) : (
      <Button title="Done" onPress={onDone} />
    );

  return (
    <Screen footer={footer}>
      <View style={styles.top}>
        <Enter index={0}>
          <Txt variant="label" color={Palette.paperMuted} numberOfLines={1}>
            {title}
          </Txt>
        </Enter>
        <Enter index={1}>
          <Txt variant="hero" accessibilityRole="header">
            {!ended ? 'Final' : shownPlace ? ordinal(shownPlace) : 'Finished'}
          </Txt>
        </Enter>
        <Enter index={2}>
          <Txt variant="small" color={Palette.paperMuted}>
            {[
              !ended ? 'Placing teams' : place && teamCount ? `of ${teamCount} ${solo ? 'players' : 'teams'}` : place ? null : 'No place this time',
              totalPoints !== null ? `${points(totalPoints)} points` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </Txt>
        </Enter>
      </View>

      {payout || teamCents ? (
        <Enter index={3} style={styles.payout}>
          <Txt variant="title">{money(payout?.cents ?? teamCents ?? 0)}</Txt>
          <Txt variant="caption" color={Palette.paperMuted}>
            {[
              !payout && !solo ? 'Team share' : null,
              sent ? 'Sent to your Whop balance' : (payout?.adapter ?? (conceptPool ? 'concept' : 'whop')) === 'concept' ? 'Concept payout' : payout?.label,
              payout ? null : `waiting for ${host} to approve`,
            ]
              .filter(Boolean)
              .join(' · ')}
          </Txt>
        </Enter>
      ) : null}

      {leaderboard && leaderboard.length > 0 ? (
        <Enter index={4} style={styles.board}>
          {leaderboard.map((row) => {
            const me = row.label === teamLabel;
            return (
              <View key={`${row.place}-${row.label}`} style={styles.line} accessible accessibilityLabel={`${ordinal(row.place)}, ${row.memberNames.join(', ')}${me ? ', you' : ''}`}>
                <Txt variant="time" color={Palette.paperMuted} style={styles.place}>
                  {ordinal(row.place)}
                </Txt>
                <Txt variant={me ? 'smallStrong' : 'small'} numberOfLines={1} style={styles.names}>
                  {solo ? row.memberNames.join(', ') : `${row.label} · ${row.memberNames.join(', ')}`}
                </Txt>
                {me ? (
                  <View style={styles.you}>
                    <View style={styles.dot} />
                    <Txt variant="caption" color={Palette.ember}>
                      You
                    </Txt>
                  </View>
                ) : null}
              </View>
            );
          })}
        </Enter>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { gap: Space.xs, marginTop: Space.xxl },
  payout: { gap: 2, marginTop: Space.l },
  board: { marginTop: Space.xl },
  line: { flexDirection: 'row', alignItems: 'center', gap: Space.m, minHeight: 44 },
  place: { width: 40 },
  names: { flex: 1 },
  you: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: Radius.pill, backgroundColor: Palette.ember },
});
