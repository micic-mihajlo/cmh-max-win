import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/signal/backdrop';
import { Button } from '@/components/signal/primitives';
import { Txt } from '@/components/signal/txt';
import { FontFamily, Palette, Radius, Space } from '@/constants/signal';
import type { LiveLeaderboardRow, MyPayoutView } from '@/lib/contract';
import { teamIndexFromLabel, teamStyle } from '@/lib/teams';
import { Enter, Haptic } from '@/motion';

import { useCount } from './count';
import { money, ordinal, points } from './format';
import { Takeover } from './takeover';

const styleOf = (label: string) => teamStyle(label, teamIndexFromLabel(label));

// The payout as its own beat: the amount counts up on paper, then the sheet drops to the full result.
function PayoutBeat({ cents, place, maths, label, onDone }: { cents: number; place: number | null; maths: string | null; label: string; onDone: () => void }) {
  const shown = useCount(cents, 0);
  useEffect(() => {
    Haptic.success();
  }, []);
  return (
    <Takeover holdMs={1600} onDone={onDone}>
      {place ? (
        <Txt variant="label" color={Palette.paperMuted}>
          {`${ordinal(place)} place`}
        </Txt>
      ) : null}
      <Text maxFontSizeMultiplier={1.2} style={styles.amount}>
        {money(shown ?? cents)}
      </Text>
      <Txt variant="small" color={Palette.paperMuted}>
        {[maths, label].filter(Boolean).join(' · ')}
      </Txt>
    </Takeover>
  );
}

export function ResultScreen({
  title,
  teamLabel,
  solo,
  teamSize,
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
  teamSize: number;
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
  const shownPlace = useCount(ended ? place : null, teamCount);
  const sent = payout?.adapter === 'whop' && payout.status === 'sent';
  const members = mine?.memberNames.length || teamSize;
  const cents = payout?.cents ?? (teamCents !== null ? Math.floor(teamCents / Math.max(1, members)) : 0);
  const maths = !solo && teamCents !== null && members > 1 ? `${money(teamCents)} ÷ ${members} players` : null;
  const payoutLabel = sent ? 'Sent to your Whop balance' : (payout?.adapter ?? (conceptPool ? 'concept' : 'whop')) === 'concept' ? 'Concept payout' : (payout?.label ?? '');
  const [beat, setBeat] = useState<'pending' | 'on' | 'done'>('pending');
  if (beat === 'pending' && ended && cents > 0) setBeat('on');
  const footer =
    payout?.needsWhopSignIn && onClaim ? (
      <Button title={claiming ? 'Opening Whop' : 'Claim with Whop'} disabled={claiming} onPress={onClaim} />
    ) : (
      <Button title="Done" onPress={onDone} />
    );

  return (
    <Screen
      footer={footer}
      overlay={beat === 'on' ? <PayoutBeat cents={cents} place={place} maths={maths} label={payoutLabel} onDone={() => setBeat('done')} /> : null}>
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
          <Txt variant="title">{money(cents)}</Txt>
          <Txt variant="caption" color={Palette.paperMuted}>
            {[maths, payoutLabel].filter(Boolean).join(' · ')}
          </Txt>
          {payout ? null : (
            <Txt variant="caption" color={Palette.paperMuted}>
              {`Waiting for ${host} to approve`}
            </Txt>
          )}
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
                {solo ? null : <View style={[styles.marker, { backgroundColor: styleOf(row.label).ink }]} />}
                <Txt variant={me ? 'smallStrong' : 'small'} numberOfLines={1} style={styles.names}>
                  {solo ? row.memberNames.join(', ') : `${styleOf(row.label).name} · ${row.memberNames.join(', ')}`}
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
          {teamCount && teamCount > leaderboard.length ? (
            <Txt variant="caption" color={Palette.paperMuted} style={styles.rest}>
              {`${teamCount - leaderboard.length} more ${solo ? 'player' : 'team'}${teamCount - leaderboard.length === 1 ? '' : 's'} without points`}
            </Txt>
          ) : null}
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
  rest: { marginTop: Space.s },
  marker: { width: 10, height: 10, borderRadius: Radius.pill },
  amount: { fontFamily: FontFamily.uiBold, fontSize: 88, lineHeight: 96, letterSpacing: -3, color: Palette.paper, fontVariant: ['tabular-nums'] },
  dot: { width: 8, height: 8, borderRadius: Radius.pill, backgroundColor: Palette.ember },
});
