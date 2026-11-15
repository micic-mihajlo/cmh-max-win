import { router, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { names } from '@/components/challenge/recap/format';
import { dropTime, followers } from '@/components/showcase/social/copy';
import { Avatar, BigButton, Screen, Section, TextAction, showcase } from '@/components/showcase/social/kit';
import { Txt } from '@/components/signal/txt';
import { Palette, Space } from '@/constants/signal';
import type { ChallengeCardView, CreatorPageView } from '@/lib/contract';
import { Enter, Haptic, PressScale } from '@/motion';

const play = (c: ChallengeCardView) => c.joinCode && router.push({ pathname: '/c/[code]', params: { code: c.joinCode } } as unknown as Href);
const recap = (id: string) => router.push({ pathname: '/studio/recap/[id]', params: { id } } as unknown as Href);

function when(c: ChallengeCardView, now: number) {
  if (c.phase === 'open') return 'Open now';
  return c.startsAt ? dropTime(c.startsAt, now) : 'Starts on stream';
}

export function CreatorScreen({ page, onFollow, onUnfollow }: { page: CreatorPageView | null | undefined; onFollow: () => void; onUnfollow: () => void }) {
  if (page === undefined) return <Screen>{null}</Screen>;
  if (page === null)
    return (
      <Screen>
        <Txt variant="body" color={Palette.paperMuted} style={styles.none}>
          No creator by that name.
        </Txt>
      </Screen>
    );

  const live = page.live[0];
  const next = page.upcoming[0];

  return (
    <Screen>
      <Enter index={0} style={[showcase.gutter, styles.head]}>
        <Avatar initials={page.displayName.slice(0, 1)} size={84} />
        <Txt variant="display" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
          {page.displayName}
        </Txt>
        <Txt variant="body" color={Palette.paperMuted}>
          {page.handle}
          {page.followerCount >= 3 ? ` · ${followers(page.followerCount)}` : ''}
        </Txt>
      </Enter>

      <Enter index={1} style={[showcase.gutter, styles.follow]}>
        {page.following ? (
          <Animated.View entering={FadeIn.duration(150)} style={styles.center}>
            <TextAction title="Following" muted onPress={onUnfollow} />
          </Animated.View>
        ) : (
          <BigButton
            title="Follow"
            onPress={() => {
              Haptic.tap();
              onFollow();
            }}
          />
        )}
      </Enter>

      {live ? (
        <Enter index={2}>
          <PressScale accessibilityRole="button" scaleTo={0.98} haptic="tap" disabled={!live.joinCode} style={[showcase.gutter, showcase.row, styles.live]} onPress={() => play(live)}>
            <View style={styles.dot} />
            <View style={showcase.flex}>
              <Txt variant="bodyStrong" numberOfLines={1}>
                {live.phase === 'open' ? 'Open now' : 'Live now'} · {live.title}
              </Txt>
              <Txt variant="caption" color={Palette.paperMuted} numberOfLines={1}>
                {live.entrantCount} playing · {live.prizePool.label}
              </Txt>
            </View>
            {live.joinCode ? <Txt variant="label">Play</Txt> : null}
          </PressScale>
        </Enter>
      ) : null}

      <Enter index={3}>
        <Section title={next ? `Next · ${when(next, page.serverNow)}` : 'Nothing scheduled'}>
          {next ? (
            <PressScale accessibilityRole="button" scaleTo={0.98} haptic="tap" disabled={!next.joinCode} onPress={() => play(next)} style={showcase.row}>
              <View style={[showcase.flex, styles.item]}>
                <Txt variant="body" numberOfLines={1}>
                  {next.title}
                </Txt>
                <Txt variant="caption" color={Palette.paperMuted} numberOfLines={1}>
                  {next.membersOnly ? 'Whop members · ' : ''}
                  {next.prizePool.label}
                </Txt>
              </View>
              {next.joinCode ? <Txt variant="label">Join</Txt> : null}
            </PressScale>
          ) : null}
        </Section>
      </Enter>

      {page.recent.length ? (
        <Enter index={4}>
          <Section title="Recent">
            <View style={showcase.list}>
              {page.recent.slice(0, 3).map((c) => {
                const winner = c.winners.find((w) => w.place === 1);
                return (
                  <PressScale key={c.challengeId} accessibilityRole="button" scaleTo={0.98} haptic="tap" onPress={() => recap(c.challengeId)} style={styles.item}>
                    <Txt variant="body" numberOfLines={1}>
                      {winner ? names(winner.memberNames) : c.title}
                    </Txt>
                    <Txt variant="caption" color={Palette.paperMuted} numberOfLines={1}>
                      {winner ? `Won ${c.title}` : `${c.entrantCount} played`}
                    </Txt>
                  </PressScale>
                );
              })}
            </View>
          </Section>
        </Enter>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  none: { marginTop: Space.xxxl, paddingHorizontal: Space.xl, textAlign: 'center' },
  head: { alignItems: 'center', gap: Space.s, marginTop: Space.xl },
  center: { alignItems: 'center' },
  follow: { marginTop: Space.xl, minHeight: 52, justifyContent: 'center' },
  live: { marginTop: Space.xxl },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Palette.ember },
  item: { gap: 2 },
});
