import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { Palette, Radius, RoleMeta, Space } from '@/constants/signal';
import type { DossierView, Role } from '@/lib/contract';

import { Icon } from './icon';
import { useMotionReduced, useTypeScale } from './settings';
import { Txt } from './txt';

export function ClueCard({ dossier, highlight }: { dossier: DossierView; highlight?: number }) {
  const reduced = useMotionReduced();
  const stacked = useTypeScale() > 1.2;
  const single = dossier.lines.length === 1 && !dossier.lines[0].time;
  const enter = (i: number) => (reduced ? FadeIn.duration(150) : FadeInDown.delay(60 * i).springify().damping(20));
  return (
    <Animated.View entering={reduced ? FadeIn.duration(150) : FadeInDown.springify().damping(20)} style={styles.card}>
      <View style={styles.headRow}>
        <Txt variant="bodyStrong" color={Palette.inkOnPaper}>
          {dossier.docLabel.charAt(0) + dossier.docLabel.slice(1).toLowerCase()}
        </Txt>
      </View>
      {single ? (
        <Txt variant="quote" color={Palette.inkOnPaper} style={highlight === 0 ? styles.highlight : undefined}>
          “{dossier.lines[0].text}”
        </Txt>
      ) : (
        <View style={styles.lines}>
          {dossier.lines.map((line, i) => (
            <Animated.View
              key={i}
              entering={enter(i + 1)}
              style={[styles.line, stacked && styles.lineStacked, highlight === i && styles.highlight]}>
              {line.time ? (
                <Txt variant="time" color={Palette.inkOnPaperTime} style={stacked ? undefined : styles.timeCol}>
                  {line.time}
                </Txt>
              ) : null}
              <Txt variant="evidence" color={Palette.inkOnPaperBody} style={stacked ? undefined : styles.flex}>
                {line.text}
              </Txt>
            </Animated.View>
          ))}
        </View>
      )}
      {dossier.notes ? (
        <Txt variant="evidenceItalic" color={Palette.inkOnPaperMuted}>
          {dossier.notes}
        </Txt>
      ) : null}
      <View style={styles.footer}>
        <Icon name="lock.fill" size={13} color={Palette.inkOnPaperMuted} />
        <Txt variant="small" color={Palette.inkOnPaperMuted}>
          Only you can see this. Read it out.
        </Txt>
      </View>
    </Animated.View>
  );
}

export function ClueCardSkeleton({ role }: { role: Role }) {
  const meta = RoleMeta[role];
  return (
    <View style={styles.card} accessibilityLabel="Loading your piece">
      <Txt variant="bodyStrong" color={Palette.inkOnPaper}>
        {meta.docLabel.charAt(0) + meta.docLabel.slice(1).toLowerCase()}
      </Txt>
      {[92, 80, 60].map((w, i) => (
        <View key={i} style={[styles.skeletonBar, { width: `${w}%` }]} />
      ))}
      <Txt variant="small" color={Palette.inkOnPaperMuted}>
        Dealing your piece…
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: {
    backgroundColor: Palette.card,
    borderWidth: 1,
    borderColor: Palette.hairline,
    borderRadius: Radius.l,
    padding: Space.xl,
    gap: Space.l,
    boxShadow: '0 1px 2px rgba(26,25,22,0.04), 0 8px 24px rgba(26,25,22,0.05)',
  },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Space.s },
  lines: { gap: Space.m },
  line: { flexDirection: 'row', gap: Space.m },
  lineStacked: { flexDirection: 'column', gap: 0 },
  timeCol: { width: 56 },
  highlight: { backgroundColor: Palette.accentSoft, marginHorizontal: -8, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  skeletonBar: { height: 14, borderRadius: 7, backgroundColor: Palette.paperShade },
});
