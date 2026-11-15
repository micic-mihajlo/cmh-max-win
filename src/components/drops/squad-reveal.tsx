import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/signal/backdrop';
import { Txt } from '@/components/signal/txt';
import { Palette, Radius, RoleColors, Space } from '@/constants/signal';
import { Enter, PressScale, Stagger } from '@/motion';

import { RACE_REVEAL_MS, type DossierView, type DropView, type MemberView } from '@/lib/contract';

export type SquadMemberView = Pick<MemberView, 'memberId' | 'name' | 'role' | 'roles' | 'isMe'>;

// The reveal is held for RACE_REVEAL_MS on every phone: squad card at 900 ms, piece at 1400 ms, CTA at the end.
export function SquadRevealScreen({
  drop,
  members,
  pieces,
  play = true,
  onOpen,
}: {
  drop: DropView;
  members: SquadMemberView[];
  pieces: DossierView[] | undefined;
  play?: boolean;
  onOpen?: () => void;
}) {
  const squad = drop.me.squad;
  const ordered = [...members].sort((a, b) => Number(b.isMe) - Number(a.isMe));
  return (
    <Screen
      footer={
        <Enter play={play} delay={RACE_REVEAL_MS - 400}>
          <View style={styles.footer}>
            <PressScale style={styles.cta} onPress={onOpen}>
              <Txt variant="button" color={Palette.ink}>
                Open the case
              </Txt>
            </PressScale>
          </View>
        </Enter>
      }>
      <Enter play={play} delay={900}>
        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Txt variant="title">{squad?.label ?? 'Your squad'}</Txt>
          </View>
          <View style={styles.members}>
            <Stagger play={play} delay={900}>
              {ordered.map((m) => (
                <View key={m.memberId} style={styles.mem}>
                  <View style={[styles.avatar, { backgroundColor: m.isMe ? Palette.paper : m.role ? RoleColors[m.role] : Palette.paperMuted }]}>
                    <Txt variant="smallStrong" color={Palette.ink}>
                      {m.name.charAt(0)}
                    </Txt>
                  </View>
                  <Txt variant="bodyStrong" style={styles.flex}>
                    {m.isMe ? `${m.name} · you` : m.name}
                  </Txt>
                </View>
              ))}
            </Stagger>
          </View>
        </View>
      </Enter>
      {(pieces ?? []).map((p, i) => (
        <Enter key={p.role} play={play} delay={1400 + i * 120}>
          <View style={[styles.piece, { borderColor: Palette.hairline }]}>
            <Txt variant="bodyStrong">{p.docLabel.split(' · ')[0].charAt(0) + p.docLabel.split(' · ')[0].slice(1).toLowerCase()}</Txt>
            <Txt variant="quote">{`“${p.lines.map((l) => l.text).join(' ')}”`}</Txt>
            <Txt variant="small" color={Palette.paperFaint}>
              Only you can see this. Read it out.
            </Txt>
          </View>
        </Enter>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  footer: { gap: Space.s },
  cta: { height: 54, borderRadius: 16, backgroundColor: Palette.paper, alignItems: 'center', justifyContent: 'center' },
  card: { padding: 18, borderRadius: 16, backgroundColor: Palette.panel, borderWidth: StyleSheet.hairlineWidth, borderColor: Palette.hairline },
  cardHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  members: { gap: 10, marginTop: 14 },
  mem: { flexDirection: 'row', alignItems: 'center', gap: Space.m },
  avatar: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  mini: { flexDirection: 'row', gap: 3 },
  miniPiece: { width: 10, height: 14, borderRadius: 2 },
  piece: { gap: 6, padding: Space.l, borderRadius: Radius.l, backgroundColor: Palette.panel, borderWidth: 1.5 },
});
