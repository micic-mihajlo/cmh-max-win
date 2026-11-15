import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Space } from '@/constants/signal';
import { Txt } from '@/components/signal/txt';
import { draftStore } from '@/components/showcase/draft-store';
import { Caption, Card, Chip, G, RoleCaption, Section, StudioScreen, studio } from '@/components/showcase/studio-ui';
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
      <Txt variant="serif" color={G.ink}>
        {draft.setup}
      </Txt>
      <Txt variant="bodyStrong" color={G.ink}>
        Everyone holds a piece. Nobody solves it alone.
      </Txt>

      <Section title="Suspects">
        <Card>
          {draft.suspects.map((s) => (
            <View key={s.id} style={studio.between}>
              <View style={styles.flex}>
                <Txt variant="bodyStrong">{s.name}</Txt>
                <Txt variant="small" color={G.inkSoft}>
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
          <View style={[styles.piece, { backgroundColor: G.role[p.role] }]}>
            <RoleCaption role={p.role} docLabel={p.docLabel} />
            <Txt variant="quote" color={G.ink}>
              {p.text}
            </Txt>
            <Caption>Only you can see this. Read it out.</Caption>
          </View>
        </Enter>
      ))}
    </StudioScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  piece: { borderRadius: 20, padding: Space.xl, gap: Space.l },
});

