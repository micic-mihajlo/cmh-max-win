import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { FontFamily, Palette, Radius, Space } from '@/constants/signal';
import { Txt } from '@/components/signal/txt';
import { auroraDraft, draftStore, type Draft } from '@/components/showcase/draft-store';
import { NecessityCheck } from '@/components/showcase/necessity-check';
import { Card, Chip, PrimaryButton, RolePill, Section, StudioScreen, studio } from '@/components/showcase/studio-ui';
import { splitPieces, validatePuzzle } from '@/components/showcase/validate';
import { auroraBroken } from '@/mocks/showcase/aurora';
import { Enter } from '@/motion';

const steps = ['World', 'Suspects', 'Pieces', 'Answer', 'Squads', 'Bounty', 'Check'] as const;
const members = ['Kit', 'Lou', 'Ana'];

export default function Builder() {
  const params = useLocalSearchParams<{ step?: string; fresh?: string; broken?: string }>();
  const [step, setStep] = useState(() => Math.max(0, steps.findIndex((s) => s.toLowerCase() === params.step)));
  const [draft, setDraftState] = useState<Draft>(() => (params.broken ? { ...auroraDraft, ...auroraBroken } : params.fresh ? auroraDraft : draftStore.get()));
  const setDraft = (next: Draft) => {
    draftStore.set(next);
    setDraftState(next);
  };
  const first = (id: string) => draft.suspects.find((s) => s.id === id)?.name.split(' ')[0] ?? id;
  const last = step === steps.length - 1;

  return (
    <StudioScreen
      kicker={`Step ${step + 1} of ${steps.length}`}
      title={steps[step]}
      onBack={step > 0 ? () => setStep(step - 1) : undefined}
      footer={
        last ? (
          <PrimaryButton title="Preview as a player" disabled={!validatePuzzle(draft).pass} onPress={() => router.push('/studio/preview')} />
        ) : (
          <PrimaryButton title={`Next: ${steps[step + 1]}`} onPress={() => setStep(step + 1)} />
        )
      }>
      <View style={styles.progress}>
        {steps.map((s, i) => (
          <View key={s} style={[styles.dot, i <= step && styles.dotOn]} />
        ))}
      </View>

      <Enter key={step} from={10}>
        <View style={studio.gap}>
          {step === 0 ? (
            <>
              <Field label="Title" value={draft.title} onChange={(title) => setDraft({ ...draft, title })} big />
              <Field label="Where" value={draft.setting} onChange={(setting) => setDraft({ ...draft, setting })} />
              <Field label="One-line setup" value={draft.setup} onChange={(setup) => setDraft({ ...draft, setup })} multiline />
            </>
          ) : null}

          {step === 1
            ? draft.suspects.map((s, i) => (
                <Card key={s.id}>
                  <View style={studio.between}>
                    <Txt variant="name">{s.name}</Txt>
                    <Chip label={s.job} tone="soft" />
                  </View>
                  <TextInput
                    value={s.claim}
                    onChangeText={(claim) => setDraft({ ...draft, suspects: draft.suspects.map((x, j) => (j === i ? { ...x, claim } : x)) })}
                    style={styles.claim}
                  />
                </Card>
              ))
            : null}

          {step === 2 ? (
            <>
              <Txt variant="body" color={Palette.paperMuted}>
                Every piece is true and puts one suspect somewhere else.
              </Txt>
              {draft.pieces.map((p, i) => (
                <Card key={p.id}>
                  <RolePill role={p.role} docLabel={p.docLabel} />
                  <Txt style={styles.pieceText}>{p.text}</Txt>
                  <Txt variant="label" color={Palette.paperMuted}>
                    Clears
                  </Txt>
                  <View style={studio.wrap}>
                    {draft.suspects.map((s) => (
                      <Chip
                        key={s.id}
                        label={s.name.split(' ')[0]}
                        selected={p.places.includes(s.id)}
                        onPress={() =>
                          setDraft({
                            ...draft,
                            pieces: draft.pieces.map((x, j) =>
                              j === i ? { ...x, places: x.places.includes(s.id) ? x.places.filter((id) => id !== s.id) : [...x.places, s.id] } : x,
                            ),
                          })
                        }
                      />
                    ))}
                  </View>
                </Card>
              ))}
            </>
          ) : null}

          {step === 3 ? (
            <>
              <Txt variant="body" color={Palette.paperMuted}>
                Whoever nobody can clear.
              </Txt>
              {draft.suspects.map((s) => (
                <Chip key={s.id} label={`${s.name} · ${s.job}`} selected={draft.answer === s.id} onPress={() => setDraft({ ...draft, answer: s.id })} />
              ))}
            </>
          ) : null}

          {step === 4 ? (
            <>
              <View style={studio.row}>
                {([2, 3] as const).map((n) => (
                  <Chip key={n} label={n === 2 ? 'Duos' : 'Trios'} selected={draft.squadSize === n} onPress={() => setDraft({ ...draft, squadSize: n })} />
                ))}
              </View>
              {([3, 2] as const).map((size) => {
                const counts = splitPieces(draft.pieces.length, size);
                const hands = counts.map((count, m) => draft.pieces.slice(counts.slice(0, m).reduce((a, b) => a + b, 0)).slice(0, count));
                return (
                  <Section key={size} title={size === 3 ? 'Trio' : 'Duo'}>
                    <Card>
                      {hands.map((hand, m) => (
                        <View key={m} style={styles.hand}>
                          <Txt variant="bodyStrong">
                            {members[m]} · {hand.length} piece{hand.length === 1 ? '' : 's'}
                          </Txt>
                          <Txt variant="small" color={Palette.paperMuted}>
                            {hand.map((p) => p.docLabel).join(' + ')}
                          </Txt>
                        </View>
                      ))}
                    </Card>
                  </Section>
                );
              })}
              <Txt variant="small" color={Palette.paperMuted}>
                Leftover players fold into duos, so nobody sits out.
              </Txt>
            </>
          ) : null}

          {step === 5 ? (
            <>
              <Section title="Bounty">
                <View style={studio.wrap}>
                  {[100, 300, 500].map((v) => (
                    <Chip key={v} label={`$${v}`} selected={draft.bounty === v} onPress={() => setDraft({ ...draft, bounty: v })} />
                  ))}
                </View>
                <View style={studio.wrap}>
                  {[1, 3, 5].map((v) => (
                    <Chip key={v} label={`First ${v} squad${v > 1 ? 's' : ''}`} selected={draft.winners === v} onPress={() => setDraft({ ...draft, winners: v })} />
                  ))}
                </View>
                <Card>
                  <View style={studio.between}>
                    <Txt variant="body">Each winning squad</Txt>
                    <Txt variant="bodyStrong">${Math.floor(draft.bounty / draft.winners)}</Txt>
                  </View>
                  <View style={studio.between}>
                    <Txt variant="body">Each player in a trio</Txt>
                    <Txt variant="bodyStrong">${(Math.floor((draft.bounty / draft.winners / 3) * 100) / 100).toFixed(2)}</Txt>
                  </View>
                </Card>
              </Section>
              <Section title="Goes live">
                <View style={studio.wrap}>
                  {['Tonight · 9:00 PM', 'Fri · 8:00 PM', 'Sat · 2:00 PM'].map((v) => (
                    <Chip key={v} label={v} selected={draft.when === v} onPress={() => setDraft({ ...draft, when: v })} />
                  ))}
                </View>
              </Section>
            </>
          ) : null}

          {step === 6 ? (
            <>
              <NecessityCheck puzzle={draft} />
              <View style={studio.row}>
                <Chip label="Load a broken version" onPress={() => setDraft({ ...draft, ...auroraBroken })} />
                <Chip label="Reset" onPress={() => setDraft(auroraDraft)} />
              </View>
              <Txt variant="small" color={Palette.paperMuted}>
                Clears for {draft.pieces.map((p) => p.places.map(first).join('+') || '—').join(', ')}. Answer {first(draft.answer)}.
              </Txt>
            </>
          ) : null}
        </View>
      </Enter>
    </StudioScreen>
  );
}

function Field({ label, value, onChange, multiline, big }: { label: string; value: string; onChange: (v: string) => void; multiline?: boolean; big?: boolean }) {
  return (
    <View style={styles.field}>
      <Txt variant="label" color={Palette.paperMuted}>
        {label}
      </Txt>
      <TextInput value={value} onChangeText={onChange} multiline={multiline} style={[styles.input, big && styles.inputBig]} />
    </View>
  );
}

const styles = StyleSheet.create({
  progress: { flexDirection: 'row', gap: 6 },
  dot: { flex: 1, height: 4, borderRadius: 2, backgroundColor: Palette.hairline },
  dotOn: { backgroundColor: Palette.ember },
  field: { gap: Space.s },
  input: {
    backgroundColor: Palette.card,
    borderRadius: Radius.m,
    borderWidth: 1,
    borderColor: Palette.hairline,
    paddingHorizontal: Space.l,
    paddingVertical: Space.m,
    fontFamily: FontFamily.ui,
    fontSize: 17,
    lineHeight: 24,
    color: Palette.paper,
  },
  inputBig: { fontFamily: FontFamily.displayBold, fontSize: 24, lineHeight: 30 },
  claim: { fontFamily: FontFamily.serif, fontSize: 18, lineHeight: 26, color: Palette.paper, padding: 0 },
  pieceText: { fontFamily: FontFamily.serif, fontSize: 19, lineHeight: 27, color: Palette.paper, padding: 0 },
  hand: { gap: 2 },
});
