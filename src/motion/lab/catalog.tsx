import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { ScrollView, Share, StyleSheet, Switch, Text, View, type HostInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { SeasonPackState, SuspectId } from '@/lib/contract';
import { LAB_ROOM_CODE, labCrew, labNudge, labReveal, labSuspects } from '@/mocks/motion-fixtures';
import {
  Checking,
  FlipFrom,
  InviteCode,
  LockInRing,
  measureRect,
  NudgeEntrance,
  PackButton,
  Palette,
  PressScale,
  ReducedMotionOverride,
  RoleColor,
  RoleInitial,
  RoleLabel,
  Seal,
  Stagger,
  StatusBanner,
  useCheckingHold,
  type Rect,
} from '@/motion';

import { Chip, Row, Section, ui } from './ui';

export default function MotionCatalog() {
  const insets = useSafeAreaInsets();
  const [reduced, setReduced] = useState(false);

  const [sealLocked, setSealLocked] = useState(false);
  const [lockedCount, setLockedCount] = useState(0);
  const [away, setAway] = useState(false);

  const [checkKey, setCheckKey] = useState<number | null>(null);
  const checking = useCheckingHold(checkKey);

  const [culprit, setCulprit] = useState<SuspectId | null>(null);
  const [from, setFrom] = useState<Rect | null>(null);
  const cards = useRef<Partial<Record<SuspectId, HostInstance | null>>>({});

  const [inviteKey, setInviteKey] = useState(0);
  const [revealKey, setRevealKey] = useState(0);
  const [pack, setPack] = useState<SeasonPackState>('locked');
  const [reconnecting, setReconnecting] = useState(false);
  const [steppedAway, setSteppedAway] = useState(false);

  const pick = async (id: SuspectId) => {
    setFrom(await measureRect(cards.current[id] ?? null));
    setCulprit(id);
  };

  const buy = () => {
    setPack('checkout');
    setTimeout(() => setPack('verifying'), 900);
    setTimeout(() => setPack('owned'), 2700);
  };

  const seats = labCrew.map((m, i) => ({
    key: m.memberId,
    name: m.name,
    color: RoleColor[m.role!],
    initial: RoleInitial[m.role!],
    locked: i < lockedCount,
    away: away && m.name === 'Lena',
    isMe: m.isMe,
  }));

  return (
    <ReducedMotionOverride value={reduced ? true : null}>
      <View style={ui.screen}>
        <ScrollView contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 48, paddingHorizontal: 20 }}>
          <Text style={ui.label}>SIGNAL · motion lab</Text>
          <Text style={[ui.title, { marginTop: 6 }]}>Micro-interactions</Text>
          <Text style={[ui.note, { marginTop: 6, marginBottom: 18 }]}>
            Fixture data only. Every primitive lives in src/motion and takes play / onDone props.
          </Text>
          <View style={styles.reduceRow}>
            <Text style={ui.body}>Reduce motion</Text>
            <Switch value={reduced} onValueChange={setReduced} trackColor={{ true: Palette.ember }} />
          </View>
          <PressScale onPress={() => router.push('/lab/flow')} accessibilityRole="button" style={styles.flowButton}>
            <Text style={styles.flowText}>Play the full flow →</Text>
          </PressScale>

          <Section title="1 · Press" note="Scale 0.97 on touch-down (100ms ease-out), spring back on release. No haptic: too frequent.">
            <PressScale onPress={() => {}} accessibilityRole="button" style={styles.primary}>
              <Text style={styles.primaryText}>I agree with this theory</Text>
            </PressScale>
            <Row>
              <Chip label="Secondary" onPress={() => {}} />
              <Chip label="Share invite" onPress={() => {}} />
            </Row>
          </Section>

          <Section title="2 · Seal stamp" note="1.35× and −8° to rest on a stiff spring, ink-bleed ring on landing, light haptic on your own seal.">
            <View style={styles.center}>
              <Seal locked={sealLocked} color={RoleColor.detective} initial="D" size={88} haptic />
            </View>
            <Row>
              <Chip tone="action" label={sealLocked ? 'Someone edited' : 'Lock in'} onPress={() => setSealLocked((v) => !v)} />
            </Row>
          </Section>

          <Section title="3 · Lock-in ring" note="Three seals on one ring. The count ticks up as each lands; an edit clears all three in 200ms.">
            <View style={styles.center}>
              <LockInRing seats={seats} />
            </View>
            <Row>
              <Chip tone="action" label="Next lock-in" onPress={() => setLockedCount((c) => Math.min(3, c + 1))} />
              <Chip label="Edit theory" onPress={() => setLockedCount(0)} />
              <Chip label={away ? 'Lena is back' : 'Lena steps away'} onPress={() => setAway((v) => !v)} />
            </Row>
          </Section>

          <Section title="4 · Checking → nudge" note="Checking… holds ≥1.2s on every phone, then the nudge rises in with one warning haptic.">
            <View style={styles.checkStage}>
              {checkKey == null ? (
                <Text style={ui.callout}>3 of 3 agree on Theo.</Text>
              ) : checking ? (
                <Checking label="3 of 3 agree. Checking…" />
              ) : (
                <NudgeEntrance key={checkKey} style={{ alignSelf: 'stretch' }}>
                  <View style={[ui.card, styles.nudge]}>
                    <Text style={ui.title2}>Not Theo.</Text>
                    <Text style={ui.callout}>{labNudge('theo', 3).text}</Text>
                    <Text style={[ui.label, { color: RoleColor.witness }]}>Lena · Witness</Text>
                  </View>
                </NudgeEntrance>
              )}
            </View>
            <Row>
              <Chip tone="action" label="Run check" onPress={() => setCheckKey(Date.now())} />
              <Chip label="Reset" onPress={() => setCheckKey(null)} />
            </Row>
          </Section>

          <Section title="5 · Suspect → theory slot" note="Your pick flies from the card you tapped into the sentence. Someone else's edit cross-fades in place.">
            <View style={styles.sentence}>
              <FlipFrom from={from} flipKey={culprit ?? 'none'} style={styles.slot}>
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
                    style={[styles.suspect, culprit === s.id && styles.suspectPicked]}>
                    <Text style={ui.title2}>{s.name}</Text>
                    <Text style={ui.callout}>{s.job}</Text>
                  </PressScale>
                </View>
              ))}
            </View>
            <Row>
              <Chip
                label="Ravi changes it"
                onPress={() => {
                  setFrom(null);
                  setCulprit((c) => (c === 'ines' ? 'jun' : 'ines'));
                }}
              />
              <Chip label="Clear" onPress={() => { setFrom(null); setCulprit(null); }} />
            </Row>
          </Section>

          <Section title="6 · Invite code" note="Letters deal in left to right, 50ms apart, so the eye reads the code in order.">
            <InviteCode key={inviteKey} code={LAB_ROOM_CODE} />
            <Row>
              <Chip label="Replay" onPress={() => setInviteKey((k) => k + 1)} />
              <Chip label="Share invite" onPress={() => Share.share({ message: `Join my SIGNAL case: ${LAB_ROOM_CODE}` })} />
            </Row>
          </Section>

          <Section title="7 · Reveal credits" note="One card per player, 90ms apart, each with its role edge. Rare moment, so it gets the slower settle.">
            <View key={revealKey} style={{ gap: 10 }}>
              <Stagger stagger={90} from={24}>
                {labReveal.credits.map((c) => (
                  <View key={c.role} style={[ui.paper, styles.credit, { borderLeftColor: RoleColor[c.role] }]}>
                    <Text style={[ui.label, { color: '#51504F' }]}>{RoleLabel[c.role]} · {c.memberName}</Text>
                    <Text style={styles.creditLine}>{c.line}</Text>
                  </View>
                ))}
              </Stagger>
            </View>
            <Row>
              <Chip label="Replay" onPress={() => setRevealKey((k) => k + 1)} />
            </Row>
          </Section>

          <Section title="8 · Whop season pack" note="locked → checkout → verifying → owned on one surface. Owned is sealed with the lock-in stamp.">
            <PackButton state={pack} onBuy={buy} price="$4.99" sandbox />
            <Row>
              <Chip label="Reset" onPress={() => setPack('locked')} />
            </Row>
          </Section>

          <Section title="9 · System banners" note="Reconnecting waits 1s and stepped-away 3s before showing, so a blip never flashes.">
            <Row>
              <Chip label={reconnecting ? 'Reconnect' : 'Drop connection'} onPress={() => setReconnecting((v) => !v)} />
              <Chip label={steppedAway ? 'Ravi is back' : 'Ravi steps away'} onPress={() => setSteppedAway((v) => !v)} />
            </Row>
          </Section>
        </ScrollView>
        <StatusBanner visible={reconnecting} showAfterMs={1000}>
          Reconnecting… your place is saved.
        </StatusBanner>
        <StatusBanner visible={steppedAway && !reconnecting} showAfterMs={3000} tone="away">
          Ravi stepped away. The case waits for all three.
        </StatusBanner>
      </View>
    </ReducedMotionOverride>
  );
}

const styles = StyleSheet.create({
  reduceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  flowButton: { height: 52, borderRadius: 14, borderWidth: 1, borderColor: Palette.ember, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  flowText: { fontSize: 17, fontWeight: '600', color: Palette.ember },
  primary: { height: 56, borderRadius: 14, backgroundColor: Palette.ember, alignItems: 'center', justifyContent: 'center' },
  primaryText: { fontSize: 17, fontWeight: '600', color: Palette.ink },
  center: { alignItems: 'center', paddingVertical: 8 },
  checkStage: { minHeight: 150, alignItems: 'center', justifyContent: 'center' },
  nudge: { borderLeftWidth: 4, borderLeftColor: RoleColor.witness },
  sentence: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', minHeight: 56 },
  slot: { minWidth: 96 },
  slotChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: Palette.panel, borderWidth: 1, borderColor: Palette.brass },
  slotEmpty: { borderColor: Palette.hairline, borderStyle: 'dashed' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  cell: { width: '48%', flexGrow: 1 },
  suspect: { borderRadius: 14, padding: 14, backgroundColor: Palette.panel, borderWidth: 1, borderColor: Palette.hairline, gap: 2 },
  suspectPicked: { borderColor: Palette.brass },
  credit: { borderLeftWidth: 4 },
  creditLine: { fontSize: 17, lineHeight: 24, color: '#3B3A3B' },
});
