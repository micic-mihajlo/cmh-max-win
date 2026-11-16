import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Screen } from '@/components/signal/backdrop';
import { Avatar, Banner, Button } from '@/components/signal/primitives';
import { useMotionReduced } from '@/components/signal/settings';
import { Txt } from '@/components/signal/txt';
import { FontFamily, Palette, Radius, RoleMeta, Space } from '@/constants/signal';
import { suspectById } from '@/constants/case01';
import { Haptic, PressScale, Stagger } from '@/motion';
import type { RevealView, RoomView } from '@/lib/contract';

export type RevealPage = 'reconstruction' | 'credits' | 'choice' | 'next';

export function RevealScreen({
  room,
  reveal,
  page,
  late,
  choice,
  host,
  on = {},
}: {
  room: RoomView;
  reveal: RevealView;
  page: RevealPage;
  late?: boolean;
  choice?: 'report' | 'informant';
  host?: { name: string; following: boolean; onFollow?: () => void };
  on?: { onPage?: (page: RevealPage) => void; onChoice?: (c: 'report' | 'informant') => void; onSeason?: () => void; onNewCase?: () => void };
}) {
  const reduced = useMotionReduced();
  const culprit = suspectById(reveal.culprit);
  const enter = (i: number) => (reduced ? undefined : FadeInDown.duration(220).delay(60 * i));
  useEffect(() => {
    if (page === 'reconstruction') Haptic.tap();
  }, [page]);
  const footer = {
    reconstruction: <Button title="What happens next" onPress={() => on.onPage?.('next')} />,
    credits: <Button title={`See what happens to ${culprit.first}`} onPress={() => on.onPage?.('choice')} />,
    choice: <Button title={choice ? 'Continue' : 'Choose together'} disabled={!choice} onPress={() => on.onPage?.('next')} />,
    next: (
      <>
        <Button title="See your season" onPress={on.onSeason} />
        <Button title="Start a new case" variant="secondary" onPress={on.onNewCase} />
      </>
    ),
  }[page];

  return (
    <Screen footer={footer} contentStyle={page === 'credits' ? styles.centered : undefined}>
      {late ? <Banner tone="good" title="Your crew solved it." text="You were away when it resolved. Here’s what happened." /> : null}

      {page === 'reconstruction' ? (
        <>
          <Txt variant="display">{reveal.headline}</Txt>
          <View style={styles.credits}>
            {reveal.credits.map((c, i) => {
              const m = c.line.match(/^(.+?) (placed|put|locked|ruled|cleared) (.+?)\.?$/);
              return (
                <Animated.View key={c.role} entering={enter(i)} style={[styles.creditRow, i > 0 && styles.creditRule]}>
                  <Avatar name={c.memberName} filled={c.memberName === room.me?.name} />
                  <View style={styles.flex}>
                    <Txt variant="name">{m ? m[1] : `${c.memberName}’s ${RoleMeta[c.role].docLabel.toLowerCase()}`}</Txt>
                    <Txt variant="small" color={Palette.paperMuted}>
                      {m ? `${m[2]} ${m[3]}` : c.line}
                    </Txt>
                  </View>
                </Animated.View>
              );
            })}
          </View>
          <Txt variant="serif" color={Palette.paperMuted} style={styles.italic}>
            {`Nobody could place ${culprit.first}.`}
          </Txt>
        </>
      ) : null}

      {page === 'credits' ? (
        <>
          <Txt variant="display">{`It was ${culprit.first}.`}</Txt>
          <View style={styles.lines}>
            <Stagger from={8} stagger={80}>
              {reveal.credits.map((c) => (
                <Txt key={c.role} variant="body">
                  <Txt variant="body" style={styles.creditName}>
                    {c.memberName}
                  </Txt>
                  {`’s ${RoleMeta[c.role].docLabel.toLowerCase()} ruled out ${suspectById(c.cleared).first}.`}
                </Txt>
              ))}
            </Stagger>
          </View>
        </>
      ) : null}

      {page === 'choice' ? (
        <>
          <View style={styles.previewTag}>
            <Txt variant="label" color={Palette.paperMuted}>
              Preview · carries into Episode 02
            </Txt>
          </View>
          <Txt variant="display">What do you do with Jun?</Txt>
          <Txt variant="body" color={Palette.paperMuted}>
            She’s confessed to the crew, not to the station. Decide together.
          </Txt>
          <ChoiceCard
            title="Report her"
            text="Station command takes it from here. The crew keeps its record clean."
            selected={choice === 'report'}
            onPress={() => on.onChoice?.('report')}
          />
          <ChoiceCard
            title="Keep her as an informant"
            text="Jun stays in the galley, and she owes you. Whoever messaged her may try again."
            selected={choice === 'informant'}
            onPress={() => on.onChoice?.('informant')}
          />
          <Txt variant="small" color={Palette.paperMuted}>
            Episode 02 remembers this.
          </Txt>
        </>
      ) : null}

      {page === 'next' ? (
        <>
          <Txt variant="display">Case closed. For now.</Txt>
          <View style={styles.teaser}>
            <Txt variant="name" style={styles.teaserTitle}>
              The Second Seed
            </Txt>
            <Txt variant="body">The seed they recovered is a replica.</Txt>
            <Txt variant="small" color={Palette.paperMuted}>
              Friday, 9 pm
            </Txt>
          </View>
          {host ? (
            host.following ? (
              <Txt variant="body" color={Palette.paperMuted}>
                See you Friday
              </Txt>
            ) : (
              <PressScale accessibilityRole="link" haptic="tap" onPress={host.onFollow} style={styles.follow}>
                <Txt variant="bodyStrong">{`Follow ${host.name} for next Friday`}</Txt>
              </PressScale>
            )
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}

function ChoiceCard({ title, text, selected, onPress }: { title: string; text: string; selected: boolean; onPress?: () => void }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.choice, selected && { borderColor: Palette.paper, backgroundColor: Palette.accentSoft }]}>
      <Txt variant="name">{title}</Txt>
      <Txt variant="small" color={Palette.paperMuted}>
        {text}
      </Txt>
      {selected ? (
        <Txt variant="smallStrong" color={Palette.paper}>
          Your pick · a preview for now
        </Txt>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centered: { flexGrow: 1, justifyContent: 'center' },
  italic: { fontFamily: FontFamily.serifItalic },
  credits: {
    backgroundColor: Palette.card,
    borderRadius: Radius.l,
    borderWidth: 1,
    borderColor: Palette.hairline,
    paddingHorizontal: Space.l,
  },
  creditRow: { flexDirection: 'row', alignItems: 'center', gap: Space.m, paddingVertical: Space.l },
  creditRule: { borderTopWidth: 1, borderTopColor: Palette.hairline },
  timeline: { gap: 0 },
  tRow: { flexDirection: 'row', gap: Space.m, minHeight: 64 },
  tRail: { width: 12, alignItems: 'center', paddingTop: 8 },
  tDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: Palette.paper },
  tLine: { flex: 1, width: 1, backgroundColor: Palette.hairline, marginTop: 4 },
  tTime: { width: 48, paddingTop: 2 },
  lines: { gap: Space.m },
  creditName: { fontFamily: FontFamily.uiMedium, color: Palette.paper },
  previewTag: { alignSelf: 'flex-start', borderWidth: 1, borderColor: Palette.paperMuted, borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  choice: { borderWidth: 1, borderColor: Palette.hairline, borderRadius: Radius.m, padding: Space.l, gap: 6, backgroundColor: Palette.panel },
  teaser: {
    borderRadius: Radius.l,
    padding: Space.xl,
    gap: Space.m,
    backgroundColor: Palette.panel,
    borderWidth: 1,
    borderColor: Palette.hairline,
  },
  teaserTitle: { fontSize: 22, lineHeight: 28 },
  follow: { alignSelf: 'flex-start', paddingVertical: Space.s },
});
