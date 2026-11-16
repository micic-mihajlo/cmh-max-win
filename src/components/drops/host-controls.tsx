import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/signal/primitives';
import { Txt } from '@/components/signal/txt';
import { Palette, Radius, Space } from '@/constants/signal';
import type { HostView } from '@/lib/contract';
import { toSignalError } from '@/lib/signal-error';
import { PressScale } from '@/motion';

import { money2, ordinal } from './ui';

type Step = 'menu' | 'end' | 'pick';

// Backup controls kept off the projected view: a small link at the end of the host screen opens a sheet with End now and Pick winners.
export function HostControls({ view, onEnd, onAward }: { view: HostView; onEnd: () => Promise<void>; onAward: (squadIds: string[]) => Promise<void> }) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (view.status === 'ended') return null;
  const slots = view.bounty.winnerSlots;
  const real = view.bounty.mode !== 'concept';
  const close = () => {
    setStep(null);
    setPicked([]);
    setError(null);
  };
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      close();
    } catch (e) {
      const code = toSignalError(e)?.code as string | undefined;
      setError(
        code === 'DROP_NOT_LIVE' ? 'This drop isn’t running.' : code === 'TOO_MANY_WINNERS' ? `Pick up to ${slots}.` : 'That didn’t go through. Try again.',
      );
    } finally {
      setBusy(false);
    }
  };
  const toggle = (label: string) => setPicked((p) => (p.includes(label) ? p.filter((l) => l !== label) : p.length < slots ? [...p, label] : p));
  const awardTitle = !picked.length
    ? `Tap up to ${slots} squad${slots === 1 ? '' : 's'} in order`
    : real
      ? `Pay ${money2(view.bounty.perSquadCents)} to ${picked.join(', ')} via Whop`
      : `Confirm ${picked.length === 1 ? picked[0] : `${picked.length} winners`}`;
  return (
    <>
      <PressScale accessibilityRole="button" onPress={() => setStep('menu')} haptic="tap" style={styles.trigger}>
        <Txt variant="smallStrong" color={Palette.paperMuted}>
          Host controls
        </Txt>
      </PressScale>
      <Modal visible={step !== null} transparent animationType="fade" onRequestClose={close}>
        <Pressable style={styles.scrim} onPress={busy ? undefined : close} accessibilityLabel="Close host controls" />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + Space.l }]}>
          {step === 'menu' ? (
            <>
              <Txt variant="name">Host controls</Txt>
              <Button title="End now" variant="secondary" onPress={() => setStep('end')} style={styles.option} />
              {view.squads.length ? <Button title="Pick winners" variant="secondary" onPress={() => setStep('pick')} style={styles.option} /> : null}
              <Button title="Close" variant="ghost" onPress={close} />
            </>
          ) : null}
          {step === 'end' ? (
            <>
              <Txt variant="name">End the race now?</Txt>
              <Txt variant="body" color={Palette.paperMuted}>
                Squads still solving stop here. Places already taken stay.
              </Txt>
              <Button title={busy ? 'Ending…' : 'End now'} variant="accent" disabled={busy} onPress={() => run(onEnd)} />
              <Button title="Cancel" variant="ghost" disabled={busy} onPress={close} />
            </>
          ) : null}
          {step === 'pick' ? (
            <>
              <Txt variant="name">Pick winners</Txt>
              <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
                {view.squads
                  .filter((s) => s.squadId)
                  .map((s) => {
                    const place = picked.indexOf(s.squadLabel);
                    return (
                      <PressScale
                        key={s.squadLabel}
                        accessibilityRole="button"
                        accessibilityState={{ selected: place >= 0 }}
                        onPress={() => toggle(s.squadLabel)}
                        haptic="tap"
                        style={[styles.row, place >= 0 && styles.rowOn]}>
                        <View style={styles.flex}>
                          <Txt variant="bodyStrong">{s.squadLabel}</Txt>
                          <Txt variant="small" color={Palette.paperMuted} numberOfLines={1}>
                            {s.memberNames.join(', ')}
                          </Txt>
                        </View>
                        <Txt variant="bodyStrong">{place >= 0 ? ordinal(place + 1) : ''}</Txt>
                      </PressScale>
                    );
                  })}
              </ScrollView>
              <Button
                title={busy ? 'Confirming…' : awardTitle}
                variant="accent"
                disabled={busy || !picked.length}
                onPress={() => run(() => onAward(picked.map((label) => view.squads.find((s) => s.squadLabel === label)?.squadId ?? '')))}
              />
              <Button title="Cancel" variant="ghost" disabled={busy} onPress={close} />
            </>
          ) : null}
          {error ? (
            <Txt variant="small" color={Palette.paperMuted}>
              {error}
            </Txt>
          ) : null}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  trigger: { alignSelf: 'center', paddingHorizontal: Space.m, paddingVertical: Space.s },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(33,32,28,0.32)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignSelf: 'center',
    width: '100%',
    maxWidth: 520,
    gap: Space.m,
    padding: Space.xl,
    borderTopLeftRadius: Radius.l,
    borderTopRightRadius: Radius.l,
    backgroundColor: Palette.ink,
  },
  option: { borderWidth: 1, borderColor: Palette.hairline, backgroundColor: Palette.card },
  list: { maxHeight: 360 },
  listContent: { gap: Space.s },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.m,
    padding: Space.l,
    borderRadius: Radius.m,
    backgroundColor: Palette.card,
    borderWidth: 1,
    borderColor: Palette.hairline,
  },
  rowOn: { borderColor: Palette.paper, borderWidth: 2 },
});
