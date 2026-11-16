import { useState } from 'react';
import { StyleSheet, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { Screen } from '@/components/signal/backdrop';
import { Txt } from '@/components/signal/txt';
import { Wordmark } from '@/components/wordmark';
import { FontFamily, Palette, Radius, Space } from '@/constants/signal';
import { Enter, PressScale, Seal, Stagger } from '@/motion';
import type { HostView } from '@/lib/contract';

import { Brass, money, short } from './ui';

export const MIN_TO_DEAL = 4;
const NEWEST = 3;
// Past this many squads the board switches to one-line cells so 34 squads fit a 1280×720 projector.
// Cells share one width per row so a short last row stays on the grid.
const DENSE_AFTER = 12;
const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL;

// The shared big screen before the deal: the code is the hero, the QR is the way in. On a phone the QR takes the
// full width so the room can scan it at arm's length or off an AirPlay mirror.
export function HostScreen({ view, hostName, dealing, onDeal }: { view: HostView; hostName: string; dealing?: boolean; onDeal?: () => void }) {
  const { width } = useWindowDimensions();
  const wide = width >= 768;
  if (view.squads.length) return wide ? <HostBoard view={view} /> : <PhoneBoard view={view} />;
  const qr = wide ? 260 : Math.min(width - Space.xl * 2 - Space.m * 2, 280);
  const canDeal = view.entrantCount >= MIN_TO_DEAL && !dealing;
  return (
    <Screen
      footer={
        <View style={styles.footer}>
          <Pot view={view} style={styles.flex} />
          <PressScale disabled={!canDeal} onPress={onDeal} haptic="tap" style={[styles.deal, !canDeal && styles.dealOff]}>
            <Txt variant="button" color={canDeal ? Palette.onAccent : Palette.disabledText}>
              {dealing ? 'Dealing…' : 'Deal squads'}
            </Txt>
          </PressScale>
        </View>
      }>
      {wide ? <Wordmark style={styles.brand} /> : null}
      <Txt variant={wide ? 'display' : 'title'} style={styles.center}>
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
      {wide ? (
        <Txt variant="body" color={Palette.paperMuted} style={styles.center}>
          Open Signal → Join → type the code
        </Txt>
      ) : null}
      <View style={styles.qrCard}>
        <QRCode value={WEB_URL ? `${WEB_URL}/join/${view.joinCode}` : view.joinCode} size={qr} color={Palette.paper} backgroundColor={Palette.card} />
        <Txt variant="small" color={Palette.paperMuted} style={styles.center}>
          {wide ? 'Scan with your camera' : 'Scan with your camera, or open Signal → Join → type the code'}
        </Txt>
      </View>
      <View style={styles.here}>
        <Txt variant="title">{`${view.entrantCount} here`}</Txt>
        <View style={styles.chips}>
          {view.entrants.slice(-NEWEST).map((e) => (
            <Enter key={`${e.name}-${e.joinedAt}`} from={0}>
              <View style={styles.chip}>
                <Txt variant="body">{e.name.split(' ')[0]}</Txt>
              </View>
            </Enter>
          ))}
          {view.entrantCount > NEWEST ? (
            <View style={[styles.chip, styles.more]}>
              <Txt variant="body" color={Palette.paperMuted}>{`+${view.entrantCount - NEWEST} more`}</Txt>
            </View>
          ) : null}
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
  const dense = order.length > DENSE_AFTER;
  const [boardWidth, setBoardWidth] = useState(0);
  const basis = dense ? 220 : 280;
  const columns = Math.max(1, Math.floor((boardWidth + Space.s) / (basis + Space.s)));
  const cellWidth = boardWidth ? (boardWidth - Space.s * (columns - 1)) / columns : undefined;
  return (
    <Screen>
      <View style={styles.boardHead}>
        <Txt variant="display" style={styles.flex}>
          {view.solves.length ? 'Race' : 'Squads'}
        </Txt>
        <Pot view={view} style={styles.potRight} />
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
      <View style={styles.squads} onLayout={(e) => setBoardWidth(e.nativeEvent.layout.width)}>
        <Stagger stagger={30} itemStyle={cellWidth ? { width: cellWidth } : styles.squadCell}>
          {order.map((s) => {
            const solved = solve.get(s.squadLabel);
            return (
              <View key={s.squadLabel} style={[styles.squad, dense && styles.squadDense, solved?.isWinner && styles.squadWinner]}>
                <View style={styles.squadHead}>
                  <Txt variant={dense ? 'bodyStrong' : 'name'} style={styles.flex}>
                    {s.squadLabel}
                  </Txt>
                  {solved ? (
                    <>
                      <Txt variant="time">{short(solved.solveMs)}</Txt>
                      <Seal locked color={solved.isWinner ? Palette.paper : Palette.paperMuted} initial={String(solved.place)} size={dense ? 24 : 32} />
                    </>
                  ) : null}
                </View>
                {dense ? (
                  <Txt variant="small" color={Palette.paperMuted} numberOfLines={1}>
                    {s.memberNames.join(', ')}
                  </Txt>
                ) : (
                  <View style={styles.chips}>
                    {s.memberNames.map((m, i) => (
                      <View key={`${m}-${i}`} style={styles.chip}>
                        <Txt variant="small">{m}</Txt>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            );
          })}
        </Stagger>
      </View>
    </Screen>
  );
}

// Phone portrait: one compact row per squad, solved squads first in place order, winners revealed on top once
// the bounty slots are full or the drop ends.
function PhoneBoard({ view }: { view: HostView }) {
  const solve = new Map(view.solves.map((s) => [s.squadLabel, s]));
  const order = [...view.squads].sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity));
  const filled = Math.min(view.solves.length, view.bounty.winnerSlots);
  const done = view.status === 'ended' || filled === view.bounty.winnerSlots;
  const winners = view.solves.filter((s) => s.isWinner);
  return (
    <Screen>
      <View style={styles.boardHead}>
        <Txt variant="title" style={styles.flex}>
          {done ? 'Winners' : view.solves.length ? 'Race' : 'Squads'}
        </Txt>
        <Txt variant="bodyStrong" color={Palette.paperMuted}>{`${filled} of ${view.bounty.winnerSlots} slots`}</Txt>
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
      {done && winners.length ? (
        <View style={styles.podium}>
          <Stagger stagger={120}>
            {winners.map((w) => (
              <View key={w.squadLabel} style={styles.podiumRow}>
                <Seal locked color={Palette.paper} initial={String(w.place)} size={44} />
                <View style={styles.flex}>
                  <Txt variant="name">{w.squadLabel}</Txt>
                  <Txt variant="small" color={Palette.paperMuted} numberOfLines={1}>
                    {view.squads.find((s) => s.squadLabel === w.squadLabel)?.memberNames.join(', ')}
                  </Txt>
                </View>
                <View style={styles.potRight}>
                  <Txt variant="bodyStrong">{money(view.bounty.perSquadCents)}</Txt>
                  <Txt variant="time" color={Palette.paperMuted}>
                    {short(w.solveMs)}
                  </Txt>
                </View>
              </View>
            ))}
          </Stagger>
        </View>
      ) : null}
      <View style={styles.rows}>
        {order.map((s) => {
          const solved = solve.get(s.squadLabel);
          if (done && solved?.isWinner) return null;
          return (
            <View key={s.squadLabel} style={[styles.row, solved?.isWinner && styles.squadWinner]}>
              <View style={styles.flex}>
                <Txt variant="bodyStrong">{s.squadLabel}</Txt>
                <Txt variant="small" color={Palette.paperMuted} numberOfLines={1}>
                  {s.memberNames.join(', ')}
                </Txt>
              </View>
              {solved ? (
                <>
                  <Txt variant="time">{short(solved.solveMs)}</Txt>
                  <Seal locked color={solved.isWinner ? Palette.paper : Palette.paperMuted} initial={String(solved.place)} size={32} />
                </>
              ) : (
                <Txt variant="small" color={Palette.paperMuted}>
                  solving
                </Txt>
              )}
            </View>
          );
        })}
      </View>
      <Pot view={view} />
    </Screen>
  );
}

function Pot({ view, style }: { view: HostView; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={style}>
      <Txt variant="bodyStrong">{`${money(view.bounty.totalCents)} · ${view.bounty.winnerSlots === 1 ? 'first squad' : `first ${view.bounty.winnerSlots} squads`}`}</Txt>
      {view.bounty.mode === 'concept' ? (
        <Txt variant="label" color={Brass}>
          Concept · no real money moves
        </Txt>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  potRight: { alignItems: 'flex-end' },
  boardHead: { flexDirection: 'row', alignItems: 'baseline', gap: Space.m },
  bars: { flexDirection: 'row', gap: Space.s },
  bar: { flex: 1, height: 10, borderRadius: Radius.pill, backgroundColor: Palette.hairline, overflow: 'hidden' },
  barFill: { flex: 1, backgroundColor: Palette.paper },
  squads: { flexDirection: 'row', flexWrap: 'wrap', gap: Space.s },
  squadCell: { flexGrow: 1, flexBasis: 280 },
  squad: {
    gap: Space.s,
    padding: Space.l,
    borderRadius: Radius.m,
    backgroundColor: Palette.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.hairline,
  },
  squadWinner: { borderColor: Palette.paper, borderWidth: 1 },
  squadDense: { gap: 2, paddingVertical: Space.s, paddingHorizontal: Space.m },
  podium: { gap: Space.m, padding: Space.l, borderRadius: Radius.m, backgroundColor: Palette.paperShade },
  podiumRow: { flexDirection: 'row', alignItems: 'center', gap: Space.m },
  rows: { gap: Space.s },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.m,
    paddingHorizontal: Space.l,
    paddingVertical: Space.m,
    borderRadius: Radius.m,
    backgroundColor: Palette.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.hairline,
  },
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
  here: { gap: Space.m, alignItems: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: Space.s },
  more: { backgroundColor: 'transparent' },
  chip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: Radius.pill, backgroundColor: Palette.paperShade },
  footer: { flexDirection: 'row', alignItems: 'center', gap: Space.l },
  deal: { height: 52, paddingHorizontal: Space.xl, borderRadius: 16, backgroundColor: Palette.paper, alignItems: 'center', justifyContent: 'center' },
  dealOff: { backgroundColor: Palette.inkDeep },
});
