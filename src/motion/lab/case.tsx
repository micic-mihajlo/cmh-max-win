import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, type HostInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { SuspectId } from '@/lib/contract';
import { LAB_MOCK_ANSWER, labCrew, labNudge, labSuspects } from '@/mocks/motion-fixtures';
import {
  Checking,
  Enter,
  FlipFrom,
  LockInRing,
  measureRect,
  NudgeEntrance,
  Palette,
  PressScale,
  RoleColor,
  RoleInitial,
  Spring,
  Stagger,
  useCheckingHold,
  type Rect,
} from '@/motion';

import { ui } from './ui';

const dossier = [
  { time: '21:30', text: 'Lab fixture line. Evidence text comes from the server.' },
  { time: '21:40', text: 'Each line slides up like a file from a folder.' },
  { time: '21:52', text: 'Sixty milliseconds apart, then still.' },
];

// The theory round on a mock server: you lock in, Ravi and Lena follow on timers, the third
// lock-in triggers the check. Any edit clears every lock-in.
export default function LabCase() {
  const insets = useSafeAreaInsets();
  const [culprit, setCulprit] = useState<SuspectId | null>(null);
  const [from, setFrom] = useState<Rect | null>(null);
  const [revision, setRevision] = useState(0);
  const [locked, setLocked] = useState(0);
  const checkSeq = locked === 3 ? revision : null;
  const checking = useCheckingHold(checkSeq);
  const outcome = checkSeq == null || checking ? null : culprit === LAB_MOCK_ANSWER ? 'correct' : 'wrong';
  const wrong = outcome === 'wrong' ? culprit : null;
  const cards = useRef<Partial<Record<SuspectId, HostInstance | null>>>({});

  useEffect(() => {
    if (locked === 0 || locked === 3) return;
    const t = setTimeout(() => setLocked((n) => n + 1), 750);
    return () => clearTimeout(t);
  }, [locked, revision]);

  useEffect(() => {
    if (outcome === 'correct') router.replace('/lab/reveal');
  }, [outcome]);

  const pick = async (id: SuspectId) => {
    if (id === culprit) return;
    setFrom(await measureRect(cards.current[id] ?? null));
    setCulprit(id);
    setRevision((r) => r + 1);
    setLocked(0);
  };

  const burned = wrong != null;
  const canLock = culprit != null && locked === 0 && !burned;
  const seats = labCrew.map((m, i) => ({
    key: m.memberId,
    name: m.name,
    color: RoleColor[m.role!],
    initial: RoleInitial[m.role!],
    locked: i < locked,
    isMe: m.isMe,
  }));

  return (
    <View style={ui.screen}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32, paddingHorizontal: 20, gap: 22 }}>
        <Enter from={24} spring={Spring.file}>
          <View style={[ui.paper, styles.dossier]}>
            <Text style={[ui.label, { color: '#766242' }]}>Scene notes · 21:30–21:50</Text>
            <Text style={styles.paperTitle}>Greenhouse, deck C</Text>
            <Stagger delay={180} from={10} spring={Spring.file}>
              {dossier.map((l) => (
                <View key={l.time} style={styles.line}>
                  <Text style={styles.time}>{l.time}</Text>
                  <Text style={styles.lineText}>{l.text}</Text>
                </View>
              ))}
            </Stagger>
            <Text style={styles.private}>Only you can see this. Read it out.</Text>
          </View>
        </Enter>

        <View style={{ gap: 14 }}>
          <Text style={ui.label}>Shared theory</Text>
          <View style={styles.sentence}>
            <FlipFrom from={from} flipKey={culprit ?? 'none'} style={{ minWidth: 96 }}>
              <View style={[styles.slotChip, !culprit && styles.slotEmpty]}>
                <Text style={[ui.title2, !culprit && { color: Palette.faint }]}>
                  {culprit ? labSuspects.find((s) => s.id === culprit)!.name : '_____'}
                </Text>
              </View>
            </FlipFrom>
            <Text style={ui.title2}> took the seed.</Text>
          </View>
          <View style={styles.grid}>
            {labSuspects.map((s) => (
              <View key={s.id} ref={(n) => { cards.current[s.id] = n; }} collapsable={false} style={styles.cell}>
                <PressScale
                  haptic="select"
                  onPress={() => pick(s.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: culprit === s.id }}
                  style={[styles.suspect, culprit === s.id && styles.picked, wrong === s.id && styles.ruledOut]}>
                  <Text style={ui.title2}>{s.name}</Text>
                  <Text style={ui.callout}>{wrong === s.id ? 'Ruled out' : s.job}</Text>
                </PressScale>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.agreement}>
          <LockInRing seats={seats} />
          <View style={styles.outcome}>
            {checkSeq != null && checking ? (
              <Checking label="3 of 3 agree. Checking…" />
            ) : wrong ? (
              <NudgeEntrance key={revision} style={{ alignSelf: 'stretch' }}>
                <View style={[ui.card, { borderLeftWidth: 4, borderLeftColor: RoleColor.witness }]}>
                  <Text style={ui.title2}>Not {labSuspects.find((s) => s.id === wrong)!.name}.</Text>
                  <Text style={ui.callout}>{labNudge(wrong, revision).text}</Text>
                  <Text style={[ui.label, { color: RoleColor.witness }]}>Lena · Witness</Text>
                </View>
              </NudgeEntrance>
            ) : (
              <Text style={ui.callout}>
                {culprit == null ? 'Pick a suspect together.' : locked === 0 ? 'Lock in if you agree.' : `You're in. Waiting for ${3 - locked}.`}
              </Text>
            )}
          </View>
        </View>

        <PressScale
          disabled={!canLock}
          onPress={() => setLocked(1)}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canLock }}
          style={[styles.primary, !canLock && styles.primaryOff, { transitionProperty: ['backgroundColor', 'borderColor'], transitionDuration: 200 }]}>
          <Text style={[styles.primaryText, !canLock && styles.primaryTextOff]}>{burned ? 'Change the theory to try again' : 'I agree with this theory'}</Text>
        </PressScale>
        <Text style={[ui.callout, { textAlign: 'center' }]}>Lab: the mock server accepts {labSuspects.find((s) => s.id === LAB_MOCK_ANSWER)!.name}.</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  dossier: { borderLeftWidth: 4, borderLeftColor: RoleColor.detective, gap: 10 },
  paperTitle: { fontFamily: 'ui-serif', fontSize: 22, lineHeight: 28, color: Palette.ink },
  line: { flexDirection: 'row', gap: 12 },
  time: { width: 48, fontSize: 15, lineHeight: 24, fontWeight: '500', color: '#51504F', fontVariant: ['tabular-nums'] },
  lineText: { flex: 1, fontSize: 16, lineHeight: 24, color: '#3B3A3B' },
  private: { marginTop: 4, fontSize: 13, color: '#676563' },
  sentence: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', minHeight: 52 },
  slotChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: Palette.panel, borderWidth: 1, borderColor: Palette.brass },
  slotEmpty: { borderColor: Palette.hairline, borderStyle: 'dashed' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  cell: { width: '48%', flexGrow: 1 },
  suspect: { borderRadius: 14, padding: 14, backgroundColor: Palette.panel, borderWidth: 1, borderColor: Palette.hairline, gap: 2 },
  picked: { borderColor: Palette.brass },
  ruledOut: { opacity: 0.5 },
  agreement: { alignItems: 'center', gap: 8 },
  outcome: { minHeight: 140, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  primary: { height: 56, borderRadius: 14, borderWidth: 1, borderColor: Palette.ember, backgroundColor: Palette.ember, alignItems: 'center', justifyContent: 'center' },
  primaryOff: { backgroundColor: Palette.panel, borderColor: Palette.hairline },
  primaryTextOff: { color: Palette.faint },
  primaryText: { fontSize: 17, fontWeight: '600', color: Palette.ink },
});
