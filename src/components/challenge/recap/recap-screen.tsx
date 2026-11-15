import { Share, StyleSheet, View } from 'react-native';

import { BigButton, Screen } from '@/components/showcase/social/kit';
import { Txt } from '@/components/signal/txt';
import { Palette, Space } from '@/constants/signal';
import type { ChallengeGrowthView, ChallengeRecapView } from '@/lib/contract';
import { Enter } from '@/motion';

import { clock, day, money, names } from './format';

const placeWord = ['First', 'Second', 'Third'];

export function RecapScreen({ recap, growth }: { recap: ChallengeRecapView | null | undefined; growth: ChallengeGrowthView | null | undefined }) {
  if (recap === undefined) return <Screen>{null}</Screen>;
  if (recap === null)
    return (
      <Screen>
        <Txt variant="body" color={Palette.paperMuted} style={styles.none}>
          No recap yet
        </Txt>
      </Screen>
    );

  const [first, ...rest] = recap.podium;
  const concept = recap.payoutAdapter === 'concept';
  const cancelled = recap.status === 'cancelled';
  const stats = [
    { value: recap.entrantCount, label: recap.entrantCount === 1 ? 'player' : 'players' },
    { value: recap.teamCount, label: recap.teamCount === 1 ? 'team' : 'teams' },
    ...(growth ? [{ value: growth.newWhopMembers, label: growth.newWhopMembers === 1 ? 'new Whop member' : 'new Whop members' }] : []),
  ];
  const share = () =>
    void Share.share({
      message: first
        ? `${names(first.memberNames)} won ${recap.title} with ${recap.creator.displayName}`
        : `${recap.title} with ${recap.creator.displayName}`,
    }).catch(() => {});

  return (
    <Screen>
      <View style={styles.body}>
        <Enter index={0} style={styles.gap}>
          <Txt variant="label" color={Palette.paperMuted}>
            {recap.title} · {day(recap.endedAt)}
          </Txt>
          {cancelled ? (
            <Txt variant="display">Cancelled</Txt>
          ) : first ? (
            <>
              <Txt variant="display" numberOfLines={3} adjustsFontSizeToFit minimumFontScale={0.6}>
                {names(first.memberNames)}
              </Txt>
              <Txt variant="body" color={Palette.paperMuted}>
                Took first in {clock(first.finishMs)}
              </Txt>
            </>
          ) : (
            <Txt variant="display">Nobody finished</Txt>
          )}
        </Enter>

        <Enter index={1} style={styles.stats}>
          {stats.map((s) => (
            <View key={s.label} style={styles.stat}>
              <Txt variant="title" style={styles.tabular}>
                {s.value}
              </Txt>
              <Txt variant="caption" color={Palette.paperMuted}>
                {s.label}
              </Txt>
            </View>
          ))}
        </Enter>

        {recap.podium.length ? (
          <Enter index={2} style={styles.list}>
            {[first, ...rest].map((row) => (
              <View key={row.place} style={styles.row}>
                <View style={styles.flex}>
                  <Txt variant="bodyStrong" numberOfLines={2}>
                    {names(row.memberNames)}
                  </Txt>
                  <Txt variant="caption" color={Palette.paperMuted}>
                    {placeWord[row.place - 1] ?? `Place ${row.place}`} · {row.teamLabel} · {clock(row.finishMs)}
                  </Txt>
                </View>
                {recap.poolCents > 0 ? (
                  <Txt variant="time" color={Palette.paper}>
                    {money(row.cents)}
                  </Txt>
                ) : null}
              </View>
            ))}
            {recap.poolCents > 0 ? (
              <Txt variant="caption" color={Palette.paperMuted}>
                {money(recap.paidCents)} of {money(recap.poolCents)} paid{concept ? ' · concept payout, no real money moves' : ''}
              </Txt>
            ) : null}
          </Enter>
        ) : null}
      </View>

      <Enter index={3} style={styles.action}>
        <BigButton title="Share recap" onPress={share} />
      </Enter>
    </Screen>
  );
}

const styles = StyleSheet.create({
  none: { marginTop: Space.xxxl, paddingHorizontal: Space.xl, textAlign: 'center' },
  body: { paddingHorizontal: Space.xl, gap: Space.xxl + Space.s, marginTop: Space.xl },
  gap: { gap: Space.s },
  stats: { flexDirection: 'row', gap: Space.xxl },
  stat: { gap: 2 },
  tabular: { fontVariant: ['tabular-nums'] },
  list: { gap: Space.xl },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: Space.l },
  flex: { flex: 1, minWidth: 0, gap: 2 },
  action: { paddingHorizontal: Space.xl, marginTop: Space.xxxl },
});
