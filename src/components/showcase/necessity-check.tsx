import { StyleSheet, View } from 'react-native';

import { FontFamily, Space } from '@/constants/signal';
import { Txt } from '@/components/signal/txt';
import { Enter } from '@/motion';

import { Card, G, docName } from './studio-ui';
import type { PuzzleInput } from './validate';
import { validatePuzzle } from './validate';

export function NecessityCheck({ puzzle }: { puzzle: PuzzleInput }) {
  const report = validatePuzzle(puzzle);
  const first = (id: string) => puzzle.suspects.find((s) => s.id === id)?.name.split(' ')[0] ?? id;
  const n = puzzle.pieces.length;

  return (
    <View style={styles.gap}>
      <Enter key={String(report.pass)} from={8}>
        <View style={[styles.verdict, { backgroundColor: report.pass ? G.okWash : G.surface }]}>
          <Txt style={[styles.verdictTitle, { color: report.pass ? G.ok : G.bad }]}>{report.pass ? 'Holds.' : 'Leaks.'}</Txt>
          <Txt variant="body" color={G.ink}>
            {report.pass ? `Every piece is needed. Only all ${n} together leave ${first(puzzle.answer)}.` : 'A squad could skip someone. Fix the red rows.'}
          </Txt>
        </View>
      </Enter>

      <Card>
        <Row label={`All ${n} pieces`} value={report.allTogether.map(first).join(', ') || 'nobody'} pass={report.checks.find((c) => c.id === 'together')!.pass} />
        {report.removals.map((r) => (
          <Row
            key={r.pieceId}
            label={`Without the ${docName(r.docLabel).toLowerCase()}`}
            value={`${r.remaining.length} remain`}
            hint={r.remaining.map(first).join(', ')}
            pass={r.pass}
          />
        ))}
        <View style={styles.spacer} />
        {report.checks.map((c) => (
          <Row key={c.id} label={c.label} hint={c.detail} pass={c.pass} />
        ))}
      </Card>
    </View>
  );
}

function Row({ label, value, hint, pass }: { label: string; value?: string; hint?: string; pass: boolean }) {
  return (
    <View style={styles.row}>
      <Txt style={[styles.mark, { color: pass ? G.ink : G.bad }]}>{pass ? '✓' : '✕'}</Txt>
      <View style={styles.flex}>
        <Txt variant="bodyStrong" color={G.ink}>
          {label}
        </Txt>
        {hint ? (
          <Txt variant="small" color={G.inkSoft}>
            {hint}
          </Txt>
        ) : null}
      </View>
      {value ? (
        <Txt variant="smallStrong" color={pass ? G.ink : G.bad}>
          {value}
        </Txt>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  gap: { gap: Space.m },
  verdict: { borderRadius: 16, padding: Space.l, gap: Space.xs },
  verdictTitle: { fontFamily: FontFamily.display, fontSize: 28, lineHeight: 34 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Space.m },
  mark: { width: 20, fontFamily: FontFamily.uiSemi, fontSize: 17, lineHeight: 24, textAlign: 'center' },
  spacer: { height: Space.s },
  flex: { flex: 1 },
});

