import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { FontFamily, Space } from '@/constants/signal';
import { InkInput } from '@/components/signal/ink-input';
import { Txt } from '@/components/signal/txt';
import { auroraDraft, blankDraft, draftStore, type Draft } from '@/components/showcase/draft-store';
import { NecessityCheck } from '@/components/showcase/necessity-check';
import { Caption, Card, Chip, G, PrimaryButton, RoleCaption, Section, StudioScreen, docName, studio } from '@/components/showcase/studio-ui';
import { sampleStudio } from '@/components/studio/sample';
import { splitPieces, validatePuzzle } from '@/components/showcase/validate';
import { auroraBroken } from '@/mocks/showcase/aurora';
import { Enter } from '@/motion';

const steps = ['World', 'Suspects', 'Pieces', 'Answer', 'Squads', 'Bounty', 'Check'] as const;
const members = ['Chris', 'Sarah', 'Jen'];

function Builder() {
  const params = useLocalSearchParams<{ step?: string; fresh?: string; broken?: string }>();
  const [step, setStep] = useState(() => Math.max(0, steps.findIndex((s) => s.toLowerCase() === params.step)));
  const [draft, setDraftState] = useState<Draft>(() => {
    const initial = params.broken ? { ...auroraDraft, ...auroraBroken } : params.fresh ? blankDraft : draftStore.get();
    draftStore.set(initial);
    return initial;
  });
  const setDraft = (next: Draft) => {
    draftStore.set(next);
    setDraftState(next);
  };
  const last = step === steps.length - 1;

  return (
    <StudioScreen
      kicker={draft.title}
      title={steps[step]}
      onBack={step > 0 ? () => setStep(step - 1) : undefined}
      footer={
        last ? (
          <PrimaryButton title="Preview as a player" disabled={!validatePuzzle(draft).pass} onPress={() => router.push('/studio/preview')} />
        ) : (
          <PrimaryButton title={steps[step + 1]} onPress={() => setStep(step + 1)} />
        )
      }>
      <View style={styles.progress}>
        {steps.map((s, i) => (
          <View key={s} style={[styles.dot, i <= step && styles.dotOn]} />
        ))}
      </View>

      <Enter key={step} from={8}>
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
                <Card key={s.id} style={styles.tight}>
                  <View style={studio.between}>
                    <Txt variant="bodyStrong" color={G.ink}>
                      {s.name}
                    </Txt>
                    <Caption>{s.job}</Caption>
                  </View>
                  <InkInput
                    value={s.claim}
                    onChangeText={(claim) => setDraft({ ...draft, suspects: draft.suspects.map((x, j) => (j === i ? { ...x, claim } : x)) })}
                    style={styles.claim}
                    focusedStyle={styles.focused}
                  />
                </Card>
              ))
            : null}

          {step === 2 ? (
            <>
              <Txt variant="body" color={G.inkSoft}>
                Every piece is true and puts one suspect somewhere else.
              </Txt>
              {draft.pieces.map((p, i) => (
                <View key={p.id} style={[styles.piece, { backgroundColor: G.role[p.role] }]}>
                  <RoleCaption role={p.role} docLabel={p.docLabel} />
                  <Txt variant="body" color={G.ink}>
                    {p.text}
                  </Txt>
                  <Caption>Clears</Caption>
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
                </View>
              ))}
            </>
          ) : null}

          {step === 3 ? (
            <>
              <Txt variant="body" color={G.inkSoft}>
                The one nobody can clear.
              </Txt>
              <View style={styles.list}>
                {draft.suspects.map((s) => (
                  <Chip key={s.id} label={`${s.name} · ${s.job}`} selected={draft.answer === s.id} onPress={() => setDraft({ ...draft, answer: s.id })} />
                ))}
              </View>
            </>
          ) : null}

          {step === 4 ? (
            <>
              <View style={studio.row}>
                {([2, 3] as const).map((n) => (
                  <Chip key={n} label={n === 2 ? 'Duos' : 'Trios'} selected={draft.squadSize === n} onPress={() => setDraft({ ...draft, squadSize: n })} />
                ))}
              </View>
              {[draft.squadSize].map((size) => {
                const counts = splitPieces(draft.pieces.length, size);
                const hands = counts.map((count, m) => draft.pieces.slice(counts.slice(0, m).reduce((a, b) => a + b, 0)).slice(0, count));
                return (
                  <Section key={size} title={size === 3 ? 'Trio' : 'Duo'}>
                    <Card>
                      {hands.map((hand, m) => (
                        <View key={m} style={styles.hand}>
                          <Txt variant="bodyStrong" color={G.ink}>
                            {members[m]} · {hand.length} piece{hand.length === 1 ? '' : 's'}
                          </Txt>
                          <Caption>{hand.map((p) => docName(p.docLabel)).join(' + ')}</Caption>
                        </View>
                      ))}
                    </Card>
                  </Section>
                );
              })}
              <Caption>Leftover players fold into duos, so nobody sits out.</Caption>
            </>
          ) : null}

          {step === 5 ? (
            <>
              <View style={studio.gap}>
                <View style={studio.wrap}>
                  {[100, 300, 500].map((v) => (
                    <Chip key={v} label={`$${v}`} selected={draft.bounty === v} onPress={() => setDraft({ ...draft, bounty: v })} />
                  ))}
                </View>
                <View style={studio.wrap}>
                  {[1, 3, 5].map((v) => (
                    <Chip key={v} label={`${v} squad${v > 1 ? 's' : ''}`} selected={draft.winners === v} onPress={() => setDraft({ ...draft, winners: v })} />
                  ))}
                </View>
                <Card>
                  <View style={studio.between}>
                    <Txt variant="body" color={G.ink}>
                      Each winning squad
                    </Txt>
                    <Txt variant="bodyStrong" color={G.ink}>
                      ${Math.floor(draft.bounty / draft.winners)}
                    </Txt>
                  </View>
                  <View style={studio.between}>
                    <Txt variant="body" color={G.ink}>
                      Each player in a trio
                    </Txt>
                    <Txt variant="bodyStrong" color={G.ink}>
                      ${(Math.floor((draft.bounty / draft.winners / 3) * 100) / 100).toFixed(2)}
                    </Txt>
                  </View>
                </Card>
                <Caption>Concept payout. No money moves in this preview.</Caption>
              </View>
              <Section title="Goes live">
                <View style={studio.wrap}>
                  {['Tonight 9 PM', 'Fri 8 PM', 'Sat 2 PM'].map((v) => (
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
                <PrimaryButton
                  variant="text"
                  title={validatePuzzle(draft).pass ? 'Try a broken version' : 'Restore the original'}
                  onPress={() => setDraft(validatePuzzle(draft).pass ? { ...draft, ...auroraBroken } : auroraDraft)}
                />
              </View>
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
      <Caption>{label}</Caption>
      <InkInput value={value} onChangeText={onChange} multiline={multiline} style={[styles.input, multiline && styles.inputTall, big && styles.inputBig]} focusedStyle={styles.focused} />
    </View>
  );
}

const styles = StyleSheet.create({
  progress: { flexDirection: 'row', gap: 6 },
  dot: { flex: 1, height: 3, borderRadius: 2, backgroundColor: G.line },
  dotOn: { backgroundColor: G.ink },
  field: { gap: Space.s },
  input: {
    backgroundColor: G.surface,
    borderRadius: 14,
    paddingHorizontal: Space.l,
    paddingVertical: Space.m,
    fontFamily: FontFamily.ui,
    fontSize: 17,
    lineHeight: 24,
    color: G.ink,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  focused: { borderColor: G.ink },
  inputTall: { minHeight: 96, textAlignVertical: 'top' },
  inputBig: { fontFamily: FontFamily.display, fontSize: 24, lineHeight: 30 },
  tight: { gap: Space.s },
  claim: { fontFamily: FontFamily.ui, fontSize: 17, lineHeight: 24, color: G.inkSoft, paddingVertical: Space.xs, paddingHorizontal: Space.s, marginHorizontal: -Space.s, borderRadius: 10, borderWidth: 1.5, borderColor: 'transparent' },
  piece: { borderRadius: 16, padding: Space.l, gap: Space.m },
  list: { alignItems: 'flex-start', gap: Space.s },
  hand: { gap: 2 },
});




export default function BuilderRoute() {
  return sampleStudio ? <Builder /> : <Redirect href="/studio" />;
}
