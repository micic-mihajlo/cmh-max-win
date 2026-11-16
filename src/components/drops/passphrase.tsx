import { useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { Screen } from '@/components/signal/backdrop';
import { Button, Label } from '@/components/signal/primitives';
import { useSecondsUntil } from '@/components/signal/theory-sheet';
import { Txt } from '@/components/signal/txt';
import { FontFamily, Palette, Radius, Space } from '@/constants/signal';
import { Enter, NudgeEntrance, Seal } from '@/motion';
import type { PassphrasePieceView } from '@/lib/contract';

import { names, ordinal } from './ui';

function placeLine(piece: PassphrasePieceView) {
  const of = `${ordinal(piece.position + 1)} of ${piece.slotCount}`;
  if (piece.position === 0) return `You’re ${of} · you go first`;
  const before = piece.teammates.find((t) => t.position === piece.position - 1);
  return `You’re ${of}${before ? ` · after ${before.name}` : ''}`;
}

// Mounts open and stamps on the next frame, so a confirm lands with the stamp instead of appearing already sealed.
function ConfirmSeal({ initial, haptic }: { initial: string; haptic: boolean }) {
  const [locked, setLocked] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setLocked(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  return <Seal locked={locked} color={Palette.paper} initial={initial} size={40} haptic={haptic} />;
}

// Split passphrase: my word big, the shared slots in order with a name under each, one proposal, everyone confirms.
export function PassphraseScreen({
  piece,
  offset = 0,
  busy,
  onPropose,
  onConfirm,
}: {
  piece: PassphrasePieceView;
  offset?: number;
  busy?: boolean;
  onPropose?: (answer: string) => void;
  onConfirm?: (revision: number) => void;
}) {
  const { squad } = piece;
  const proposal = squad.proposal;
  const slots = [...piece.teammates].sort((a, b) => a.position - b.position);
  const fresh = () => slots.map((t) => (t.isMe ? piece.word : ''));
  const [draft, setDraft] = useState<string[]>(fresh);
  const [editingRevision, setEditingRevision] = useState<number | null>(null);
  const cooldown = useSecondsUntil(squad.cooldownUntil, offset);
  const me = slots.find((t) => t.isMe);
  const waitingOn = proposal ? slots.filter((t) => !(t.isMe ? proposal.confirmedByMe : proposal.confirmedBy.includes(t.name))) : [];
  const reviewing = squad.status === 'confirming' && proposal && editingRevision !== proposal.revision;
  const cooling = squad.status === 'cooldown' && cooldown > 0;

  const footer = reviewing ? (
    proposal.confirmedByMe ? (
      <Txt variant="small" color={Palette.paperMuted} style={styles.center}>
        {waitingOn.length ? `Waiting for ${names(waitingOn.map((t) => t.name))}` : 'Checking…'}
      </Txt>
    ) : (
      <>
        <Button title={busy ? 'Confirming…' : 'Confirm'} disabled={busy} onPress={() => onConfirm?.(proposal.revision)} />
        <Button title="Change it" variant="ghost" onPress={() => (setDraft(proposal.words), setEditingRevision(proposal.revision))} />
      </>
    )
  ) : (
    <Button
      title={cooling ? `Try again in 0:${String(cooldown).padStart(2, '0')}` : busy ? 'Sending…' : 'Send the passphrase'}
      disabled={cooling || busy || draft.some((w) => !w.trim())}
      onPress={() => onPropose?.(draft.map((w) => w.trim()).join(' '))}
    />
  );

  return (
    <Screen footer={footer}>
      <Enter from={8}>
        <View style={styles.head}>
          <Label>{`${piece.squadLabel} · ${names(slots.map((t) => (t.isMe ? 'you' : t.name)))}`}</Label>
          <Txt variant="small" color={Palette.paperMuted}>
            Your word
          </Txt>
          <Txt style={styles.word}>{piece.word}</Txt>
          <Txt variant="bodyStrong">{placeLine(piece)}</Txt>
        </View>
      </Enter>

      {cooling && squad.lastNudge ? (
        <NudgeEntrance style={styles.nudge}>
          <Txt variant="bodyStrong">Not quite.</Txt>
          <Txt variant="body" color={Palette.paperMuted}>
            {squad.lastNudge.holderName ? `Check ${squad.lastNudge.holderName}’s word.` : squad.lastNudge.text}
          </Txt>
        </NudgeEntrance>
      ) : null}

      {reviewing ? (
        <View style={styles.card}>
          <Txt variant="small" color={Palette.paperMuted}>
            {proposal.proposedBy === me?.name ? 'You proposed' : `${proposal.proposedBy} proposed`}
          </Txt>
          <View style={styles.slots}>
            {proposal.words.map((w, i) => (
              <View key={i} style={styles.slot}>
                <View style={[styles.cell, styles.cellFilled]}>
                  <Txt variant="bodyStrong" numberOfLines={1}>
                    {w}
                  </Txt>
                </View>
                <Txt variant="caption" color={Palette.paperMuted} numberOfLines={1}>
                  {slots[i]?.isMe ? 'You' : slots[i]?.name}
                </Txt>
              </View>
            ))}
          </View>
          <View style={styles.seals}>
            {slots.map((t) => {
              const done = t.isMe ? proposal.confirmedByMe : proposal.confirmedBy.includes(t.name);
              return (
                <View key={t.position} style={styles.sealCol}>
                  {done ? (
                    <ConfirmSeal initial={t.name.charAt(0).toUpperCase()} haptic={t.isMe} />
                  ) : (
                    <View style={styles.pending}>
                      <Txt variant="smallStrong" color={Palette.paperMuted}>
                        {t.name.charAt(0).toUpperCase()}
                      </Txt>
                    </View>
                  )}
                  <Txt variant="caption" color={Palette.paperMuted}>
                    {t.isMe ? 'You' : t.name}
                  </Txt>
                </View>
              );
            })}
          </View>
        </View>
      ) : (
        <View style={styles.card}>
          <Txt variant="small" color={Palette.paperMuted}>
            {`Every word in order, 1 to ${piece.slotCount}`}
          </Txt>
          <View style={styles.slots}>
            {slots.map((t, i) => (
              <View key={t.position} style={styles.slot}>
                <TextInput
                  value={draft[i]}
                  editable={!cooling}
                  onChangeText={(text) => setDraft((d) => d.map((w, j) => (j === i ? text : w)))}
                  placeholder={String(i + 1)}
                  placeholderTextColor={Palette.paperMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={[styles.cell, styles.input, draft[i] ? styles.cellFilled : null]}
                />
                <Txt variant="caption" color={Palette.paperMuted} numberOfLines={1}>
                  {t.isMe ? 'You' : t.name}
                </Txt>
              </View>
            ))}
          </View>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { textAlign: 'center' },
  head: { gap: Space.s },
  word: { fontFamily: FontFamily.displayBold, fontSize: 48, lineHeight: 56, letterSpacing: -1.2, color: Palette.paper },
  nudge: { gap: 2, padding: Space.l, borderRadius: Radius.m, backgroundColor: Palette.paperShade },
  card: { gap: Space.m, padding: Space.l, borderRadius: Radius.m, backgroundColor: Palette.card, borderWidth: StyleSheet.hairlineWidth, borderColor: Palette.hairline },
  slots: { flexDirection: 'row', gap: Space.s },
  slot: { flex: 1, gap: 4, alignItems: 'center' },
  cell: {
    alignSelf: 'stretch',
    height: 52,
    borderRadius: Radius.m,
    borderWidth: 1,
    borderColor: Palette.hairline,
    backgroundColor: Palette.ink,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  input: { fontFamily: FontFamily.uiSemi, fontSize: 17, color: Palette.paper, textAlign: 'center' },
  cellFilled: { borderColor: Palette.paper, backgroundColor: Palette.card },
  seals: { flexDirection: 'row', justifyContent: 'center', gap: Space.l },
  sealCol: { alignItems: 'center', gap: 4 },
  pending: { width: 40, height: 40, borderRadius: 20, backgroundColor: Palette.inkDeep, alignItems: 'center', justifyContent: 'center' },
});
