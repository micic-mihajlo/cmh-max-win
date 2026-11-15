import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { FontFamily, Space } from '@/constants/signal';
import { Txt } from '@/components/signal/txt';
import { Card, G, Hairline, PrimaryButton, Section, Stat, StudioScreen, studio } from '@/components/showcase/studio-ui';
import { creator, lastDrop, liveDrop, upcomingDrops } from '@/mocks/showcase/studio';
import { PressScale } from '@/motion';

export default function Studio() {
  return (
    <StudioScreen
      kicker="Sample data"
      title={`${creator.name}'s studio`}
      footer={<PrimaryButton title="New drop" onPress={() => router.push('/studio/builder?fresh=1')} />}>
      <View style={styles.live}>
        <View style={studio.between}>
          <View style={studio.row}>
            <View style={styles.liveDot} />
            <Txt variant="smallStrong" color={G.ink}>
              Live now
            </Txt>
          </View>
          <Txt variant="small" color={G.inkSoft}>
            ${liveDrop.bounty} · first {liveDrop.winners} squads
          </Txt>
        </View>
        <Txt style={styles.liveTitle}>{liveDrop.title}</Txt>
        <View style={studio.between}>
          <View style={studio.row}>
            {liveDrop.code.split('').map((c, i) => (
              <View key={i} style={styles.tile}>
                <Txt style={styles.tileText}>{c}</Txt>
              </View>
            ))}
          </View>
          <View style={styles.right}>
            <Txt variant="bodyStrong" color={G.ink}>{liveDrop.here} here</Txt>
            <Txt variant="small" color={G.inkSoft}>
              {liveDrop.squads} squads
            </Txt>
          </View>
        </View>
      </View>

      <Section title="Upcoming">
        <Card>
          {upcomingDrops.map((d, i) => (
            <View key={d.title} style={studio.gap}>
              {i > 0 ? <Hairline /> : null}
              <View style={studio.between}>
                <View style={styles.flex}>
                  <Txt variant="bodyStrong" color={G.ink}>{d.title}</Txt>
                  <Txt variant="small" color={G.inkSoft}>
                    {d.when} · ${d.bounty}
                  </Txt>
                </View>
                <Txt variant="small" color={G.inkSoft}>
                  {d.reminders} set reminders
                </Txt>
              </View>
            </View>
          ))}
        </Card>
      </Section>

      <Section title={`Last drop · ${lastDrop.title}`}>
        <Card style={styles.stats}>
          <Stat value={String(lastDrop.entrants)} label="entrants" />
          <Stat value={String(lastDrop.squads)} label="squads" />
          <Stat value={`${Math.round(lastDrop.solveRate * 100)}%`} label="solve rate" />
          <Stat value={lastDrop.medianSolve} label="median solve" />
        </Card>
      </Section>

      <View style={[studio.gap, styles.make]}>
        <Link title="Generate a puzzle" hint="Pick a setting, get a case that passes the check" onPress={() => router.push('/studio/generate')} />
        <Link title="Community cases" hint="Run one as your next drop" onPress={() => router.push('/studio/community')} />
      </View>
    </StudioScreen>
  );
}

function Link({ title, hint, onPress }: { title: string; hint: string; onPress: () => void }) {
  return (
    <PressScale accessibilityRole="button" onPress={onPress} haptic="tap">
      <Card style={styles.link}>
        <View style={styles.flex}>
          <Txt variant="bodyStrong" color={G.ink}>{title}</Txt>
          <Txt variant="small" color={G.inkSoft}>
            {hint}
          </Txt>
        </View>
        <Txt variant="name" color={G.inkSoft}>
          ›
        </Txt>
      </Card>
    </PressScale>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  make: { marginTop: Space.xxl },
  right: { alignItems: 'flex-end' },
  live: { gap: Space.m, marginTop: Space.s },
  liveTitle: { fontFamily: FontFamily.display, fontSize: 22, lineHeight: 28, color: G.ink },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: G.ink },
  tile: {
    width: 40,
    height: 46,
    borderRadius: 10,
    backgroundColor: G.fill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileText: { fontFamily: FontFamily.display, fontSize: 26, color: G.ink },
  stats: { flexDirection: 'row', flexWrap: 'wrap', rowGap: Space.l },
  link: { flexDirection: 'row', alignItems: 'center' },
});


