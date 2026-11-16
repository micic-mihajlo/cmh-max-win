import { useState, type ReactNode } from 'react';
import { Image, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

import { Screen } from '@/components/signal/backdrop';
import { Button } from '@/components/signal/primitives';
import { Txt } from '@/components/signal/txt';
import { FontFamily, Palette, Radius, Space } from '@/constants/signal';
import type { DropSummaryView, RealPayoutStatusView, WhopAccountView } from '@/lib/contract';
import type { HostedDropRow } from '@/lib/contract-host';
import { Enter, PressScale } from '@/motion';

import { CHALLENGES, type Challenge } from './creator-setup';
import { DropCard, money2 } from './ui';

export const PRESETS = [300, 1000, 2500];
export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 150;
const SQUAD = 3;
const WHOP_MIN_TRANSFER_CENTS = 100;
const BLURB: Record<string, string> = {
  'split-passphrase': 'Teams of 3 · about 2 min',
  mystery: 'Teams of 3 · about 10 min',
};

export type PrizeMode = 'real' | 'fun';
export type RunGameState = {
  challenge: Challenge;
  cents: number;
  mode: PrizeMode;
  minPlayers: number;
};

// Real prizes go to the first team alone, so each of its 3 players clears Whop's $1 minimum transfer.
export function prizeProblem({ cents, mode }: RunGameState, real: RealPayoutStatusView | undefined): string | null {
  if (mode === 'fun') return null;
  if (!real?.enabled) return 'Real payouts are off right now';
  if (cents < SQUAD * WHOP_MIN_TRANSFER_CENTS) return `Prizes start at ${money2(SQUAD * WHOP_MIN_TRANSFER_CENTS)}`;
  if (cents > real.remainingCents || cents > real.capPerSquadCents) return 'More than your balance';
  return null;
}

type Host = {
  account: WhopAccountView | null | undefined; // undefined: Whop sign-in isn't available here
  drops: HostedDropRow[];
  signingIn?: boolean;
  signInError?: string | null;
  onSignIn?: () => void;
  onSignOut?: () => void;
  onReopen?: (dropId: string) => void;
};

// "Run a game": the form is the build, the join card on the right is what players will see.
export function RunGameScreen({
  hostName,
  state,
  onChange,
  real,
  host,
  opening,
  error,
  onOpen,
}: {
  hostName: string;
  state: RunGameState;
  onChange: (next: RunGameState) => void;
  real: RealPayoutStatusView | undefined;
  host: Host;
  opening?: boolean;
  error?: string | null;
  onOpen?: () => void;
}) {
  const desktop = useWindowDimensions().width >= 1024;
  const set = (patch: Partial<RunGameState>) => onChange({ ...state, ...patch });
  const problem = prizeProblem(state, real);
  const summary = state.mode === 'fun' ? 'Just for fun · bragging rights' : `${money2(state.cents)} · first team`;
  const primary = <Primary label={opening ? 'Opening…' : (problem ?? 'Open the room')} enabled={!opening && !problem} onPress={onOpen} />;
  const form = (
    <View style={styles.form}>
      <Txt style={[styles.title, !desktop && styles.titlePhone]}>Run a game</Txt>
      <Section label="Challenge">
        <View style={[styles.cards, !desktop && styles.cardsPhone]}>
          {CHALLENGES.map((c) => (
            <View key={c.key} style={styles.cardCell}>
              <ChallengeCard challenge={c} compact={!desktop} selected={c.key === state.challenge.key} onPress={() => set({ challenge: c })} />
            </View>
          ))}
        </View>
      </Section>
      <Section label="Prize">
        <Prize state={state} set={set} real={real} desktop={desktop} problem={problem} />
      </Section>
      <Section label="Players">
        <Stepper value={state.minPlayers} onChange={(minPlayers) => set({ minPlayers })} />
      </Section>
      <Section label="Host">
        <HostRow host={host} />
      </Section>
      {error ? (
        <Txt variant="body" color={Palette.paperMuted}>
          {error}
        </Txt>
      ) : null}
    </View>
  );
  if (!desktop) {
    return (
      <Screen
        footer={
          <>
            <Txt variant="bodyStrong" numberOfLines={1}>
              {summary}
            </Txt>
            {primary}
          </>
        }>
        {form}
      </Screen>
    );
  }
  return (
    <Screen scroll={false} contentStyle={styles.desktopRoot}>
      <View style={styles.desktop}>
        <ScrollView style={styles.left} contentContainerStyle={styles.leftContent} showsVerticalScrollIndicator={false}>
          {form}
        </ScrollView>
        <View style={styles.right}>
          <Txt variant="label" color={Palette.paperMuted}>
            What players see
          </Txt>
          <Preview state={state} hostName={hostName} />
          {primary}
        </View>
      </View>
    </Screen>
  );
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Txt variant="label" color={Palette.paperMuted}>
        {label}
      </Txt>
      {children}
    </View>
  );
}

function Motif({ challenge }: { challenge: Challenge }) {
  const stroke = {
    stroke: Palette.paper,
    strokeWidth: 1.5,
    fill: Palette.card,
  };
  return (
    <Svg width={56} height={28} viewBox="0 0 56 28">
      {challenge.template === 'split-passphrase'
        ? [0, 1, 2].map((i) => <Rect key={i} x={1 + i * 19} y={6} width={16} height={16} rx={4} {...stroke} />)
        : [0, 1, 2].map((i) => <Rect key={i} x={6 + i * 8} y={2 + i * 3} width={18} height={22} rx={3} {...stroke} />)}
    </Svg>
  );
}

function ChallengeCard({ challenge, selected, compact, onPress }: { challenge: Challenge; selected: boolean; compact?: boolean; onPress: () => void }) {
  return (
    <PressScale
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      haptic="tap"
      style={[styles.card, compact && styles.cardCompact, selected && styles.cardOn]}>
      <View style={styles.cardTop}>
        <Motif challenge={challenge} />
        {selected ? (
          <Enter from={0} style={styles.check}>
            <Txt variant="caption" color={Palette.onAccent} style={styles.checkMark}>
              ✓
            </Txt>
          </Enter>
        ) : null}
      </View>
      <View style={styles.cardText}>
        <Txt variant="name">{challenge.title}</Txt>
        <Txt variant="small" color={Palette.paperMuted}>
          {BLURB[challenge.key]}
        </Txt>
      </View>
    </PressScale>
  );
}

function Prize({
  state,
  set,
  real,
  desktop,
  problem,
}: {
  state: RunGameState;
  set: (patch: Partial<RunGameState>) => void;
  real: RealPayoutStatusView | undefined;
  desktop: boolean;
  problem: string | null;
}) {
  const [text, setText] = useState(String(state.cents / 100));
  const each = Math.floor(state.cents / SQUAD);
  return (
    <View style={styles.prize}>
      <Segmented
        options={[
          { key: 'real', label: 'Real money via Whop' },
          { key: 'fun', label: 'Just for fun' },
        ]}
        selected={state.mode}
        onPick={(mode) => set({ mode: mode as PrizeMode })}
      />
      {state.mode === 'fun' ? (
        <Enter from={0}>
          <Txt variant="name" color={Palette.paperMuted}>
            No prize · bragging rights
          </Txt>
        </Enter>
      ) : (
        <Enter from={0} style={styles.prize}>
          <View style={styles.amountRow}>
            <Txt style={[styles.amount, !desktop && styles.amountPhone]}>$</Txt>
            <TextInput
              value={text}
              onChangeText={(t) => {
                const clean = t.replace(/[^0-9.]/g, '');
                setText(clean);
                const n = Math.round(Number(clean) * 100);
                if (Number.isFinite(n)) set({ cents: n });
              }}
              keyboardType="decimal-pad"
              selectionColor={Palette.ember}
              maxLength={7}
              style={[styles.amount, styles.amountInput, !desktop && styles.amountPhone]}
              accessibilityLabel="Prize amount in dollars"
            />
          </View>
          <View style={styles.presets}>
            {PRESETS.map((c) => {
              const on = c === state.cents;
              return (
                <PressScale
                  key={c}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  onPress={() => {
                    setText(String(c / 100));
                    set({ cents: c });
                  }}
                  haptic="tap">
                  <Txt variant="bodyStrong" color={on ? Palette.paper : Palette.paperMuted} style={on && styles.underline}>
                    {money2(c).replace('.00', '')}
                  </Txt>
                </PressScale>
              );
            })}
          </View>
          <Enter key={each} from={0}>
            <Txt variant="body">{`First team · ${money2(each)} each player`}</Txt>
          </Enter>
          <Txt variant="small" color={problem === 'More than your balance' ? Palette.paper : Palette.paperMuted}>
            {problem === 'More than your balance'
              ? `More than your balance · ${money2(real?.remainingCents ?? 0)} available`
              : real?.enabled
                ? `Paid from your Whop balance · ${money2(real.remainingCents)} available`
                : 'Real payouts are off right now'}
          </Txt>
        </Enter>
      )}
    </View>
  );
}

function Segmented({ options, selected, onPick }: { options: { key: string; label: string }[]; selected: string; onPick: (key: string) => void }) {
  return (
    <View style={styles.track} accessibilityRole="tablist">
      {options.map((o) => {
        const on = o.key === selected;
        return (
          <PressScale
            key={o.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => onPick(o.key)}
            haptic="tap"
            style={[styles.seg, on && styles.segOn]}>
            <Txt variant="smallStrong" color={on ? Palette.ink : Palette.paperMuted}>
              {o.label}
            </Txt>
          </PressScale>
        );
      })}
    </View>
  );
}

function Stepper({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const step = (d: number) => onChange(Math.min(MAX_PLAYERS, Math.max(MIN_PLAYERS, value + d)));
  return (
    <View style={styles.stepRow}>
      <Txt variant="body">Start when</Txt>
      <View style={styles.stepper}>
        <PressScale
          accessibilityRole="button"
          accessibilityLabel="Fewer players"
          disabled={value <= MIN_PLAYERS}
          onPress={() => step(-1)}
          haptic="tap"
          style={styles.stepBtn}>
          <Txt variant="name" color={value <= MIN_PLAYERS ? Palette.paperMuted : Palette.paper}>
            −
          </Txt>
        </PressScale>
        <Enter key={value} from={0} style={styles.stepValue}>
          <Txt variant="name" style={styles.tabular}>
            {value}
          </Txt>
        </Enter>
        <PressScale
          accessibilityRole="button"
          accessibilityLabel="More players"
          disabled={value >= MAX_PLAYERS}
          onPress={() => step(1)}
          haptic="tap"
          style={styles.stepBtn}>
          <Txt variant="name" color={value >= MAX_PLAYERS ? Palette.paperMuted : Palette.paper}>
            +
          </Txt>
        </PressScale>
      </View>
      <Txt variant="body">players are in</Txt>
    </View>
  );
}

function HostRow({ host }: { host: Host }) {
  const open = host.drops.filter((d) => d.status !== 'finished');
  return (
    <View style={styles.hostBlock}>
      {host.account ? (
        <View style={styles.hostRow}>
          {host.account.avatarUrl ? (
            <Image source={{ uri: host.account.avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarEmpty]}>
              <Txt variant="smallStrong">{host.account.name.slice(0, 1)}</Txt>
            </View>
          )}
          <Txt variant="bodyStrong" style={styles.flex} numberOfLines={1}>
            {host.account.name}
          </Txt>
          <PressScale accessibilityRole="button" onPress={host.onSignOut} haptic="tap">
            <Txt variant="smallStrong" style={styles.underline}>
              Change
            </Txt>
          </PressScale>
        </View>
      ) : host.account === null ? (
        <>
          <Txt variant="body" color={Palette.paperMuted}>
            This device only
          </Txt>
          <Button
            title={host.signingIn ? 'Opening Whop…' : 'Sign in with Whop'}
            variant="secondary"
            disabled={host.signingIn}
            onPress={host.onSignIn}
            style={styles.signIn}
          />
        </>
      ) : (
        <Txt variant="body" color={Palette.paperMuted}>
          This device only
        </Txt>
      )}
      {host.signInError ? (
        <Txt variant="small" color={Palette.paperMuted}>
          {host.signInError}
        </Txt>
      ) : null}
      {open.map((d) => (
        <PressScale key={d.dropId} accessibilityRole="button" onPress={() => host.onReopen?.(d.dropId)} haptic="tap" style={styles.liveRow}>
          <View style={styles.flex}>
            <Txt variant="bodyStrong">{d.title}</Txt>
            <Txt variant="small" color={Palette.paperMuted}>
              {`${d.code} · ${d.players} in · ${d.status === 'live' ? 'racing' : 'waiting'}`}
            </Txt>
          </View>
          <Txt variant="smallStrong">Reopen</Txt>
        </PressScale>
      ))}
    </View>
  );
}

function Preview({ state, hostName }: { state: RunGameState; hostName: string }) {
  const totalCents = state.mode === 'fun' ? 0 : state.cents;
  const drop: DropSummaryView = {
    dropId: 'preview',
    title: state.challenge.title,
    creatorName: hostName,
    caseId: 'aurora01',
    squadSize: SQUAD,
    hosted: true,
    startsAt: 0,
    status: 'scheduled',
    entrantCount: 0,
    bounty: {
      totalCents,
      currency: 'usd',
      winnerSlots: 1,
      perSquadCents: totalCents,
      mode: state.mode === 'fun' ? 'concept' : 'transfer',
    },
    winnersSoFar: 0,
  };
  return (
    <Enter key={`${state.challenge.key}-${totalCents}`} from={0}>
      <DropCard drop={drop}>
        <View style={styles.fakeJoin}>
          <Txt variant="button" color={Palette.ink}>
            Join with code
          </Txt>
        </View>
      </DropCard>
    </Enter>
  );
}

function Primary({ label, enabled, onPress }: { label: string; enabled: boolean; onPress?: () => void }) {
  return <Button title={label} variant="accent" disabled={!enabled} onPress={onPress} />;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  desktopRoot: { paddingHorizontal: 0, paddingTop: 0, paddingBottom: 0 },
  desktop: {
    flex: 1,
    flexDirection: 'row',
    gap: 80,
    width: '100%',
    maxWidth: 1120,
    alignSelf: 'center',
    paddingHorizontal: Space.xl,
  },
  left: { flex: 1, maxWidth: 640 },
  leftContent: { paddingTop: Space.xxxl, paddingBottom: Space.xxxl },
  right: { width: 400, paddingTop: 112, gap: Space.m },
  form: { gap: 48, width: '100%' },
  title: {
    fontFamily: FontFamily.uiSemi,
    fontSize: 40,
    lineHeight: 48,
    letterSpacing: -0.8,
    color: Palette.paper,
  },
  titlePhone: { fontSize: 32, lineHeight: 40 },
  section: { gap: Space.m },
  cards: { flexDirection: 'row', gap: Space.m, width: '100%' },
  cardsPhone: { flexDirection: 'column', width: '100%' },
  cardCell: { flex: 1 },
  signIn: { alignSelf: 'flex-start', paddingHorizontal: Space.xl, borderWidth: 1, borderColor: Palette.hairline, backgroundColor: Palette.card },
  cardCompact: { minHeight: 120 },
  card: {
    flex: 1,
    minHeight: 168,
    padding: Space.l,
    borderRadius: 16,
    backgroundColor: Palette.card,
    borderWidth: 2,
    borderColor: Palette.hairline,
    justifyContent: 'space-between',
  },
  cardOn: { borderColor: Palette.paper },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardText: { gap: 2 },
  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Palette.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: { lineHeight: 22 },
  prize: { gap: Space.m },
  amountRow: { flexDirection: 'row', alignItems: 'center' },
  amount: {
    fontFamily: FontFamily.uiSemi,
    fontSize: 72,
    lineHeight: 84,
    color: Palette.paper,
    fontVariant: ['tabular-nums'],
  },
  amountPhone: { fontSize: 52, lineHeight: 62 },
  amountInput: {
    flex: 1,
    padding: 0,
    margin: 0,
    borderWidth: 0,
    outlineWidth: 0,
  } as object,
  presets: { flexDirection: 'row', gap: Space.xl },
  underline: { textDecorationLine: 'underline' },
  track: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: Radius.m,
    backgroundColor: Palette.paperShade,
    alignSelf: 'flex-start',
  },
  seg: {
    height: 40,
    paddingHorizontal: Space.l,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segOn: { backgroundColor: Palette.paper },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Space.m,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.m,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.hairline,
    backgroundColor: Palette.card,
  },
  stepBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepValue: { minWidth: 44, alignItems: 'center' },
  tabular: { fontVariant: ['tabular-nums'] },
  hostBlock: { gap: Space.m },
  hostRow: { flexDirection: 'row', alignItems: 'center', gap: Space.m },
  avatar: { width: 32, height: 32, borderRadius: 16 },
  avatarEmpty: {
    backgroundColor: Palette.paperShade,
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.m,
    paddingVertical: Space.s,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.hairline,
  },
  fakeJoin: {
    height: 48,
    borderRadius: 14,
    backgroundColor: Palette.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
