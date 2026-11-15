import { StyleSheet, View } from 'react-native';

import { Palette, Radius, Space } from '@/constants/signal';
import { Txt } from '@/components/signal/txt';
import { Enter } from '@/motion';

import { Card } from './studio-ui';
import type { PuzzleInput } from './validate';
import { validatePuzzle } from './validate';

export function NecessityCheck({ puzzle }: { puzzle: PuzzleInput }) {
  const report = validatePuzzle(puzzle);
  const first = (id: string) => puzzle.suspects.find((s) => s.id === id)?.name.split(' ')[0] ?? id;
  const n = puzzle.pieces.length;

  return (
    <View style={styles.gap}>
      <Enter key={String(report.pass)} from={8}>
        <View style={[styles.verdict, report.pass ? styles.pass : styles.fail]}>
          <Txt variant="title" color={report.pass ? Palette.ok : Palette.danger}>
            {report.pass ? 'Holds.' : 'Leaks.'}
          </Txt>
          <Txt variant="body">
            {report.pass ? `Every piece is needed. Only all ${n} together leave ${first(puzzle.answer)}.` : 'A squad could skip someone. Fix the red rows.'}
          </Txt>
        </View>
      </Enter>

      <Card style={styles.tight}>
        <Row label={`All ${n} pieces`} value={report.allTogether.map(first).join(', ') || 'nobody'} pass={report.checks.find((c) => c.id === 'together')!.pass} />
        {report.removals.map((r) => (
          <Row
            key={r.pieceId}
            label={`Without ${r.docLabel}`}
            value={`${r.remaining.length} remain`}
            hint={r.remaining.map(first).join(', ')}
            pass={r.pass}
          />
        ))}
      </Card>

      <Card style={styles.tight}>
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
      <View style={[styles.mark, { backgroundColor: pass ? Palette.ok : Palette.danger }]}>
        <Txt variant="smallStrong" color="#FFFFFF">
          {pass ? '✓' : '✕'}
        </Txt>
      </View>
      <View style={styles.flex}>
        <Txt variant="bodyStrong">{label}</Txt>
        {hint ? (
          <Txt variant="small" color={Palette.paperMuted}>
            {hint}
          </Txt>
        ) : null}
      </View>
      {value ? (
        <Txt variant="smallStrong" color={pass ? Palette.paper : Palette.danger}>
          {value}
        </Txt>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  gap: { gap: Space.m },
  verdict: { borderRadius: Radius.m, padding: Space.l, gap: Space.xs, borderWidth: 1 },
  pass: { backgroundColor: '#EEF5EE', borderColor: '#CFE3D0' },
  fail: { backgroundColor: '#FBEDEA', borderColor: '#F0CFC7' },
  tight: { gap: Space.m },
  row: { flexDirection: 'row', alignItems: 'center', gap: Space.m },
  mark: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
});
