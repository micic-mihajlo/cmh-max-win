import { StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { Screen } from '@/components/signal/backdrop';
import { Txt } from '@/components/signal/txt';
import { FontFamily, Palette, Radius, Space } from '@/constants/signal';
import { Enter, PressScale, Stagger } from '@/motion';

import { money } from './ui';

// The host's view of a drop (drops:hostView, CMHM-10's join-code PR). Mirrors that shape until it's in the contract.
export type HostView = {
  dropId: string;
  joinCode: string;
  creatorName: string;
  entrants: { name: string }[];
  entrantCount: number;
  bounty: { totalCents: number; winnerSlots: number };
};

export const MIN_TO_DEAL = 4;

// The shared big screen before the deal: the code is the hero, the QR (code only) is secondary.
export function HostScreen({ view, dealing, onDeal }: { view: HostView; dealing?: boolean; onDeal?: () => void }) {
  const canDeal = view.entrantCount >= MIN_TO_DEAL && !dealing;
  return (
    <Screen
      footer={
        <View style={styles.footer}>
          <Txt variant="bodyStrong" style={styles.flex}>
            {`${money(view.bounty.totalCents)} · first ${view.bounty.winnerSlots} squads`}
          </Txt>
          <PressScale disabled={!canDeal} onPress={onDeal} style={[styles.deal, !canDeal && styles.dealOff]}>
            <Txt variant="button" color={canDeal ? Palette.onAccent : Palette.disabledText}>
              {dealing ? 'Dealing…' : 'Deal squads'}
            </Txt>
          </PressScale>
        </View>
      }>
      <Txt variant="display" style={styles.center}>
        {`Join ${view.creatorName}’s drop`}
      </Txt>
      <View style={styles.codeRow}>
        <View style={styles.tiles}>
          <Stagger from={8}>
            {view.joinCode.split('').map((ch, i) => (
              <View key={i} style={styles.tile}>
                <Txt style={styles.letter}>{ch}</Txt>
              </View>
            ))}
          </Stagger>
        </View>
      </View>
      <Txt variant="body" color={Palette.paperMuted} style={styles.center}>
        Open Signal → Join → type the code
      </Txt>
      <View style={styles.qrCard}>
        <QRCode value={view.joinCode} size={96} color={Palette.paper} backgroundColor={Palette.card} />
        <Txt variant="small" color={Palette.paperMuted}>
          or scan in the app
        </Txt>
      </View>
      <View style={styles.here}>
        <Txt variant="title">{`${view.entrantCount} here`}</Txt>
        <View style={styles.chips}>
          {view.entrants.map((e, i) => (
            <Enter key={`${e.name}-${i}`} from={4}>
              <View style={styles.chip}>
                <Txt variant="body">{e.name}</Txt>
              </View>
            </Enter>
          ))}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  codeRow: { alignItems: 'center' },
  tiles: { flexDirection: 'row', gap: 10 },
  tile: {
    width: 72,
    height: 88,
    borderRadius: Radius.m,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.hairline,
    backgroundColor: Palette.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letter: { fontFamily: FontFamily.uiBold, fontSize: 48, lineHeight: 58, color: Palette.paper },
  qrCard: { alignSelf: 'center', alignItems: 'center', gap: Space.s, padding: Space.m, borderRadius: Radius.m, backgroundColor: Palette.card },
  here: { gap: Space.m },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Space.s },
  chip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: Radius.pill, backgroundColor: Palette.accentSoft },
  footer: { flexDirection: 'row', alignItems: 'center', gap: Space.l },
  deal: { height: 54, paddingHorizontal: Space.xl, borderRadius: 16, backgroundColor: Palette.ember, alignItems: 'center', justifyContent: 'center' },
  dealOff: { backgroundColor: Palette.inkDeep },
});
