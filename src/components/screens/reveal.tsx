import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Screen } from '@/components/signal/backdrop';
import { Banner, Button, Label } from '@/components/signal/primitives';
import { useMotionReduced } from '@/components/signal/settings';
import { Txt } from '@/components/signal/txt';
import { Palette, Radius, RoleMeta, Space } from '@/constants/signal';
import { suspectById } from '@/constants/case01';
import type { RevealView, RoomView } from '@/lib/contract';

export type RevealPage = 'reconstruction' | 'credits' | 'choice' | 'next';

const pages: RevealPage[] = ['reconstruction', 'credits', 'choice', 'next'];

export function RevealScreen({
  room,
  reveal,
  page,
  late,
  choice,
}: {
  room: RoomView;
  reveal: RevealView;
  page: RevealPage;
  late?: boolean;
  choice?: 'report' | 'informant';
}) {
  const reduced = useMotionReduced();
  const culprit = suspectById(reveal.culprit);
  const enter = (i: number) => (reduced ? undefined : FadeInDown.duration(500).delay(120 * i));
  const footer = {
    reconstruction: <Button title="Who cracked it" />,
    credits: <Button title="What happens to Jun" />,
    choice: <Button title={choice ? 'Lock in the crew’s choice' : 'Choose together'} disabled={!choice} />,
    next: (
      <>
        <Button title="See your season" />
        <Button title="Start a new case" variant="secondary" />
      </>
    ),
  }[page];

  return (
    <Screen footer={footer}>
      <View style={styles.progress}>
        {pages.map((p) => (
          <View key={p} style={[styles.tick, p === page && styles.tickOn]} />
        ))}
      </View>
      <Label color={Palette.ok}>{`Case 01 · solved on attempt ${room.attempts}`}</Label>
      {late ? <Banner tone="good" title="Your crew solved it." text="You were away when it resolved. Here’s what happened." /> : null}

      {page === 'reconstruction' ? (
        <>
          <Txt variant="display">
            {culprit.name}
            <Txt variant="display" color={Palette.paperMuted}>
              {' '}
              took the Aurora Seed.
            </Txt>
          </Txt>
          <Label>Reconstruction</Label>
          <View style={styles.timeline}>
            {reveal.timeline.map((t, i) => (
              <Animated.View key={t.time} entering={enter(i)} style={styles.tRow}>
                <View style={styles.tRail}>
                  <View style={styles.tDot} />
                  {i < reveal.timeline.length - 1 ? <View style={styles.tLine} /> : null}
                </View>
                <Txt variant="time" color={Palette.paper} style={styles.tTime}>
                  {t.time}
                </Txt>
                <Txt variant="serif" style={styles.flex}>
                  {t.text}
                </Txt>
              </Animated.View>
            ))}
          </View>
          <Txt variant="quote" color={Palette.paperMuted}>
            {reveal.why}
          </Txt>
        </>
      ) : null}

      {page === 'credits' ? (
        <>
          <Txt variant="display">Every clue mattered.</Txt>
          <Txt variant="body" color={Palette.paperMuted}>
            Remove any one of these and two suspects stay possible. Nobody could have solved it alone.
          </Txt>
          {reveal.credits.map((c, i) => {
            const meta = RoleMeta[c.role];
            const cleared = suspectById(c.cleared);
            return (
              <Animated.View key={c.role} entering={enter(i)} style={[styles.credit, { borderLeftColor: meta.color }]}>
                <View style={styles.creditTop}>
                  <Label color={meta.color}>{`${meta.docLabel} · ${c.memberName}`}</Label>
                  <View style={[styles.cleared, { borderColor: meta.color }]}>
                    <Txt variant="label" color={meta.color}>
                      Cleared
                    </Txt>
                  </View>
                </View>
                <Txt variant="name">
                  {c.memberName}’s {meta.docLabel.toLowerCase()} ruled out {cleared.first}.
                </Txt>
                <Txt variant="small" color={Palette.paperMuted}>
                  {c.line}
                </Txt>
              </Animated.View>
            );
          })}
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
          />
          <ChoiceCard
            title="Keep her as an informant"
            text="Jun stays in the galley, and she owes you. Whoever messaged her may try again."
            selected={choice === 'informant'}
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
            <Label color={Palette.paperMuted}>Next episode</Label>
            <Txt variant="title">{reveal.teaser.title}</Txt>
            <Txt variant="serif" color={Palette.paper}>
              {reveal.teaser.text}
            </Txt>
            <View style={styles.coming}>
              <Txt variant="label" color={Palette.paperMuted}>
                Coming · not playable yet
              </Txt>
            </View>
          </View>
          <Txt variant="small" color={Palette.paperMuted}>
            Your crew’s progress and choices are saved. One of you can re-invite the others when Episode 02 is ready.
          </Txt>
        </>
      ) : null}
    </Screen>
  );
}

function ChoiceCard({ title, text, selected }: { title: string; text: string; selected: boolean }) {
  return (
    <View
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={[styles.choice, selected && { borderColor: Palette.ember, backgroundColor: '#251C15' }]}>
      <Txt variant="name">{title}</Txt>
      <Txt variant="small" color={Palette.paperMuted}>
        {text}
      </Txt>
      {selected ? (
        <Txt variant="smallStrong" color={Palette.ember}>
          Maya and Ravi picked this · waiting for you
        </Txt>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  progress: { flexDirection: 'row', gap: 6 },
  tick: { flex: 1, height: 3, borderRadius: 2, backgroundColor: Palette.hairline },
  tickOn: { backgroundColor: Palette.paper },
  timeline: { gap: 0 },
  tRow: { flexDirection: 'row', gap: Space.m, minHeight: 64 },
  tRail: { width: 12, alignItems: 'center', paddingTop: 8 },
  tDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: Palette.paper },
  tLine: { flex: 1, width: 1, backgroundColor: Palette.hairline, marginTop: 4 },
  tTime: { width: 48, paddingTop: 2 },
  credit: { backgroundColor: Palette.panel, borderRadius: Radius.m, borderLeftWidth: 4, padding: Space.l, gap: Space.s },
  creditTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Space.s },
  cleared: { borderWidth: 1, borderRadius: Radius.s, paddingHorizontal: 6, paddingVertical: 2, transform: [{ rotate: '-4deg' }] },
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
  coming: { alignSelf: 'flex-start', borderWidth: 1, borderStyle: 'dashed', borderColor: Palette.paperFaint, borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
});
