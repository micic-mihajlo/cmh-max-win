import { Image, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { Palette, Radius, RoleMeta, Space } from '@/constants/signal';
import type { DossierView, Role } from '@/mocks/contract';

import { Icon } from './icon';
import { useMotionReduced, useTypeScale } from './settings';
import { Txt } from './txt';

const grain = require('@/assets/images/signal/grain.png');

export function ClueCard({ dossier, highlight }: { dossier: DossierView; highlight?: number }) {
  const reduced = useMotionReduced();
  const stacked = useTypeScale() > 1.2;
  const role = RoleMeta[dossier.role];
  const isStatement = dossier.role === 'witness';
  const enter = (i: number) => (reduced ? FadeIn.duration(150) : FadeInDown.delay(60 * i).springify().damping(20));
  return (
    <Animated.View entering={reduced ? FadeIn.duration(150) : FadeInDown.springify().damping(20)} style={styles.card}>
      <View style={[styles.edge, { backgroundColor: role.color }]} />
      <Image source={grain} resizeMode="repeat" style={styles.paperGrain} />
      <View style={styles.body}>
        <Txt variant="label" color={role.ink}>
          {dossier.docLabel} · {role.label}
        </Txt>
        <Txt variant="title" color={Palette.inkOnPaper}>
          {dossier.title}
        </Txt>
        <View style={styles.rule} />
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
              <Txt variant={isStatement ? 'quote' : 'evidence'} color={Palette.inkOnPaperBody} style={stacked ? undefined : styles.flex}>
                {isStatement && i === 0 ? '“' : ''}
                {line.text}
                {isStatement && i === dossier.lines.length - 1 ? '”' : ''}
              </Txt>
            </Animated.View>
          ))}
        </View>
        {dossier.notes ? (
          <View style={styles.notes}>
            <Txt variant="label" color={Palette.inkOnPaperMuted}>
              System notes
            </Txt>
            <Txt variant="evidenceItalic" color={Palette.inkOnPaperBody}>
              {dossier.notes}
            </Txt>
          </View>
        ) : null}
        <View style={styles.footer}>
          <Icon name="lock.fill" size={13} color={Palette.inkOnPaperMuted} />
          <Txt variant="small" color={Palette.inkOnPaperMuted}>
            Only you can see this. Read it out.
          </Txt>
        </View>
      </View>
    </Animated.View>
  );
}

export function ClueCardSkeleton({ role }: { role: Role }) {
  const meta = RoleMeta[role];
  return (
    <View style={styles.card} accessibilityLabel="Loading your evidence">
      <View style={[styles.edge, { backgroundColor: meta.color }]} />
      <View style={styles.body}>
        <Txt variant="label" color={meta.ink}>
          {meta.docLabel} · {meta.label}
        </Txt>
        <View style={[styles.skeletonBar, { width: '60%', height: 22 }]} />
        <View style={styles.rule} />
        {[92, 80, 96, 70, 85].map((w, i) => (
          <View key={i} style={[styles.skeletonBar, { width: `${w}%` }]} />
        ))}
        <Txt variant="small" color={Palette.inkOnPaperMuted}>
          Unsealing your file…
        </Txt>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: {
    backgroundColor: Palette.paper,
    borderRadius: Radius.m,
    overflow: 'hidden',
    flexDirection: 'row',
    boxShadow: '0 8px 24px rgba(14,15,19,0.4)',
  },
  edge: { width: 4 },
  paperGrain: { ...StyleSheet.absoluteFill, opacity: 0.03 },
  body: { flex: 1, padding: 20, gap: Space.m },
  rule: { height: 1, backgroundColor: 'rgba(26,24,19,0.16)' },
  lines: { gap: Space.m },
  line: { flexDirection: 'row', gap: Space.m },
  lineStacked: { flexDirection: 'column', gap: 0 },
  timeCol: { width: 56 },
  highlight: { backgroundColor: 'rgba(227,155,91,0.26)', marginHorizontal: -8, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  notes: { paddingTop: Space.m, borderTopWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(26,24,19,0.35)', gap: Space.xs },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: Space.xs },
  skeletonBar: { height: 12, borderRadius: 6, backgroundColor: 'rgba(26,24,19,0.1)' },
});
