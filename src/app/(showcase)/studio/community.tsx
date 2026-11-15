import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { FontFamily, Space } from '@/constants/signal';
import { Txt } from '@/components/signal/txt';
import { auroraDraft, draftStore } from '@/components/showcase/draft-store';
import { generatePuzzle, settings } from '@/components/showcase/generate';
import { Caption, G, PrimaryButton, StudioScreen, studio } from '@/components/showcase/studio-ui';
import { communityCases, type CommunityCase } from '@/mocks/showcase/studio';
import { Enter, PressScale } from '@/motion';

const load = (c: CommunityCase) => {
  const puzzle = generatePuzzle({ setting: c.setting, difficulty: c.difficulty, seed: c.seed });
  draftStore.set({ ...auroraDraft, ...puzzle, title: c.title, setting: settings.find((s) => s.id === c.setting)!.label });
};

export default function Community() {
  return (
    <StudioScreen title="Community cases">
      {communityCases.map((c, i) => (
        <Enter key={c.id} index={i} from={8}>
          <View style={styles.item}>
            <PressScale
              accessibilityRole="button"
              onPress={() => {
                load(c);
                router.push('/studio/preview');
              }}>
              <View style={[styles.cover, { backgroundColor: c.tone }]}>
                <Caption>
                  {settings.find((s) => s.id === c.setting)!.label} · {c.difficulty}
                </Caption>
                <Txt style={styles.coverTitle}>{c.title}</Txt>
              </View>
            </PressScale>
            <View style={studio.between}>
              <View style={styles.flex}>
                <Txt variant="bodyStrong" color={G.ink}>
                  by {c.creator}
                </Txt>
                <Caption>
                  {c.plays.toLocaleString('en-US')} plays · {Math.round(c.solveRate * 100)}% solved
                </Caption>
              </View>
              <PrimaryButton
                title="Run as a drop"
                variant="text"
                onPress={() => {
                  load(c);
                  router.push('/studio/builder?step=bounty');
                }}
              />
            </View>
          </View>
        </Enter>
      ))}
    </StudioScreen>
  );
}

const styles = StyleSheet.create({
  item: { gap: Space.m, marginBottom: Space.m },
  flex: { flex: 1 },
  cover: { height: 140, borderRadius: 16, padding: Space.l, justifyContent: 'space-between' },
  coverTitle: { fontFamily: FontFamily.display, fontSize: 28, lineHeight: 32, letterSpacing: -0.4, color: G.ink },
});
