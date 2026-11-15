import { StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { Screen } from '@/components/signal/backdrop';
import { Txt } from '@/components/signal/txt';
import { Wordmark } from '@/components/wordmark';
import { FontFamily, Palette, Radius, Space } from '@/constants/signal';
import { Enter, PressScale, Seal, Stagger } from '@/motion';
import type { HostView } from '@/lib/contract';

import { money, short } from './ui';

export const MIN_TO_DEAL = 4;

// The shared big screen before the deal: the code is the hero, the QR (code only) is secondary.
export function HostScreen({ view, hostName, dealing, onDeal }: { view: HostView; hostName: string; dealing?: boolean; onDeal?: () => void }) {
  if (view.squads.length) return <HostBoard view={view} />;
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
      <Wordmark style={styles.brand} />
      <Txt variant="display" style={styles.center}>
        {`Join ${hostName}’s drop`}
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

// After the deal: squads with their chips, then the race. Solved squads stamp in commit order and fill the bounty bars.
function HostBoard({ view }: { view: HostView }) {
  const solve = new Map(view.solves.map((s) => [s.squadLabel, s]));
  const order = [...view.squads].sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity));
  const filled = Math.min(view.solves.length, view.bounty.winnerSlots);
  return (
    <Screen>
      <View style={styles.boardHead}>
        <Txt variant="display" style={styles.flex}>
          {view.solves.length ? 'Race' : 'Squads'}
        </Txt>
        <Txt variant="bodyStrong">{`${money(view.bounty.totalCents)} · first ${view.bounty.winnerSlots} squads`}</Txt>
      </View>
      <View style={styles.bars}>
        {Array.from({ length: view.bounty.winnerSlots }, (_, i) => (
          <View key={i} style={styles.bar}>
            {i < filled ? (
              <Enter from={0} style={StyleSheet.absoluteFill}>
                <View style={styles.barFill} />
              </Enter>
            ) : null}
          </View>
        ))}
      </View>
      <View style={styles.squads}>
        <Stagger stagger={30}>
          {order.map((s) => {
            const solved = solve.get(s.squadLabel);
            return (
              <View key={s.squadLabel} style={[styles.squad, solved?.isWinner && styles.squadWinner]}>
                <View style={styles.squadHead}>
                  <Txt variant="name" style={styles.flex}>
                    {s.squadLabel}
                  </Txt>
                  {solved ? (
                    <>
                      <Txt variant="time">{short(solved.solveMs)}</Txt>
                      <Seal locked color={solved.isWinner ? Palette.ember : Palette.paperMuted} initial={String(solved.place)} size={32} />
                    </>
                  ) : null}
                </View>
                <View style={styles.chips}>
                  {s.memberNames.map((m, i) => (
                    <View key={`${m}-${i}`} style={styles.chip}>
                      <Txt variant="small">{m}</Txt>
                    </View>
                  ))}
                </View>
              </View>
            );
          })}
        </Stagger>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  boardHead: { flexDirection: 'row', alignItems: 'baseline', gap: Space.m },
  bars: { flexDirection: 'row', gap: Space.s },
  bar: { flex: 1, height: 10, borderRadius: Radius.pill, backgroundColor: Palette.hairline, overflow: 'hidden' },
  barFill: { flex: 1, backgroundColor: Palette.ember },
  squads: { gap: Space.s },
  squad: {
    gap: Space.s,
    padding: Space.l,
    borderRadius: Radius.m,
    backgroundColor: Palette.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.hairline,
  },
  squadWinner: { borderColor: Palette.ember, borderWidth: 1 },
  squadHead: { flexDirection: 'row', alignItems: 'center', gap: Space.m },
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  brand: { alignSelf: 'center' },
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
