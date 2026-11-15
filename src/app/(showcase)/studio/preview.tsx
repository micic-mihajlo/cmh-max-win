import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Palette, Radius, Space } from '@/constants/signal';
import { Txt } from '@/components/signal/txt';
import { draftStore } from '@/components/showcase/draft-store';
import { Card, Chip, RolePill, Section, StudioScreen, studio } from '@/components/showcase/studio-ui';
import { splitPieces } from '@/components/showcase/validate';
import { Enter } from '@/motion';

const members = ['Kit', 'Lou', 'Ana'];

export default function PlayerPreview() {
  const draft = draftStore.get();
  const [seat, setSeat] = useState(0);
  const counts = splitPieces(draft.pieces.length, draft.squadSize);
  const start = counts.slice(0, seat).reduce((a, b) => a + b, 0);
  const hand = draft.pieces.slice(start, start + counts[seat]);

  return (
    <StudioScreen kicker="Player preview" title={draft.title}>
      <Txt variant="serif">{draft.setup}</Txt>
      <Txt variant="bodyStrong">Everyone holds a piece. Nobody solves it alone.</Txt>

      <Section title="Suspects">
        <Card>
          {draft.suspects.map((s) => (
            <View key={s.id} style={studio.between}>
              <View style={styles.flex}>
                <Txt variant="bodyStrong">{s.name}</Txt>
                <Txt variant="small" color={Palette.paperMuted}>
                  {s.job} · “{s.claim}”
                </Txt>
              </View>
            </View>
          ))}
        </Card>
      </Section>

      <Section title="Seen as">
        <View style={studio.row}>
          {counts.map((count, i) => (
            <Chip key={i} label={`${members[i]} · ${count}`} selected={seat === i} onPress={() => setSeat(i)} />
          ))}
        </View>
      </Section>

      {hand.map((p, i) => (
        <Enter key={`${seat}-${p.id}`} index={i} from={10}>
          <View style={styles.piece}>
            <RolePill role={p.role} docLabel={p.docLabel} />
            <Txt variant="quote">{p.text}</Txt>
            <Txt variant="small" color={Palette.paperMuted}>
              Only you can see this. Read it out.
            </Txt>
          </View>
        </Enter>
      ))}
    </StudioScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  piece: {
    backgroundColor: Palette.card,
    borderRadius: Radius.l,
    borderWidth: 1,
    borderColor: Palette.paper,
    padding: Space.xl,
    gap: Space.l,
  },
});
