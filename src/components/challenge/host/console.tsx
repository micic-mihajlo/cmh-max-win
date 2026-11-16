import { router, type Href } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, LinearTransition, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { money, ordinal } from '@/components/drops/ui';
import { JoinQR } from '@/components/share/JoinQR';
import { Screen } from '@/components/signal/backdrop';
import { Txt } from '@/components/signal/txt';
import { FontFamily, Palette, Radius, Space } from '@/constants/signal';
import { useApprovePayouts, useEndChallenge, useHostConsole } from '@/hooks/use-challenges';
import { useShareChallenge } from '@/hooks/use-share-challenge';
import { useLiveView, useLockEntries, useRunHostAction, useStartLive } from '@/hooks/use-live';
import type { HostConsoleView, LivePhase, LiveView } from '@/lib/contract';
import { toSignalError } from '@/lib/signal-error';
import { Ease, Enter, PressScale, Stagger, useReduced } from '@/motion';

import { useServerNow } from './use-server-now';

type RoundPhase = 'lobby' | 'question' | 'leaderboard' | 'finished';
type Round = {
  phase: RoundPhase;
  questionCount: number;
  index: number | null;
  prompt: string | null;
  opensAt: number | null;
  closesAt: number | null;
  correctText: string | null;
};
type BoardRow = {
  label: string;
  points: number;
  answeredCurrent: boolean;
  rank: number;
};
type Board = { round: Round | null; rows: BoardRow[] };

function readBoard(view: unknown): Board | null {
  if (!view || typeof view !== 'object' || !Array.isArray((view as Board).rows)) return null;
  return view as Board;
}

type QuizQuestion = { prompt: string; choices: string[]; correct: number; timeLimitMs: number };
type Optimistic = { from: string; phase: LivePhase; round: Round | null };

function lobbyRound(questionCount: number): Round {
  return { phase: 'lobby', questionCount, index: null, prompt: null, opensAt: null, closesAt: null, correctText: null };
}

// The round the host's Next leads to, from the quiz content the creator wrote: open the next question, or close the open one.
function advance(round: Round | null, questions: QuizQuestion[], questionCount: number): Round | null {
  if (!round) return null;
  if (round.phase === 'question' && round.index !== null) {
    const q = questions[round.index];
    return {
      ...round,
      phase: round.index + 1 >= questionCount ? 'finished' : 'leaderboard',
      closesAt: null,
      correctText: q ? q.choices[q.correct] : null,
    };
  }
  const index = (round.index ?? -1) + 1;
  const q = questions[index];
  if (!q) return round;
  const now = Date.now();
  return { phase: 'question', questionCount, index, prompt: q.prompt, opensAt: now, closesAt: now + q.timeLimitMs, correctText: null };
}

const TEMPLATE_NAME: Record<string, string> = {
  'quick-quiz': 'Quick quiz',
  'mystery-aurora': 'The Aurora Seed',
  'split-passphrase': 'Split passphrase',
};

export function HostConsole({ challengeId }: { challengeId: string | null }) {
  const host = useHostConsole(challengeId);
  const live = useLiveView(host?.joinCode ?? null);
  if (host === undefined || (host?.joinCode && live === undefined)) {
    return (
      <Screen scroll={false} contentStyle={styles.centered}>
        <ActivityIndicator color={Palette.paperMuted} />
      </Screen>
    );
  }
  if (host === null || !challengeId) {
    return (
      <Screen scroll={false} contentStyle={styles.centered}>
        <Txt variant="title" style={styles.center}>
          Not your challenge
        </Txt>
        <Txt variant="small" color={Palette.paperMuted} style={styles.center}>
          Only its creator can run it from this device.
        </Txt>
      </Screen>
    );
  }
  return <Console id={challengeId} host={host} live={live ?? null} />;
}

function Console({ id, host, live }: { id: string; host: HostConsoleView; live: LiveView | null }) {
  const lock = useLockEntries(id);
  const start = useStartLive(id);
  const run = useRunHostAction(id);
  const end = useEndChallenge(id);
  const approve = useApprovePayouts(id);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [optimistic, setOptimistic] = useState<Optimistic | null>(null);

  const serverPhase: LivePhase = live?.phase ?? (host.status === 'published' ? 'open' : host.status);
  const serverBoard = readBoard(live?.view);
  const serverRound = serverBoard?.round ?? null;
  const serverKey = [serverPhase, serverRound?.phase, serverRound?.index].join('|');
  const quiz = host.config.templateId === 'quick-quiz';
  const questions = (host.config.templateConfig as { questions?: QuizQuestion[] } | undefined)?.questions ?? [];
  const questionCount = serverRound?.questionCount ?? questions.length;

  // The next state shows on release and stays until the server moves past the state it started from, or the call fails.
  const opt = optimistic?.from === serverKey ? optimistic : null;
  const phase = opt?.phase ?? serverPhase;
  const round = opt?.round ?? serverRound;
  const board = quiz && phase === 'live' ? { round, rows: serverBoard?.rows ?? [] } : serverBoard;

  const commit = async (next: Omit<Optimistic, 'from'> | null, fn: () => Promise<unknown>) => {
    setError(null);
    if (next) setOptimistic({ ...next, from: serverKey });
    try {
      await fn();
    } catch (e) {
      setOptimistic(null);
      setError(toSignalError(e)?.message ?? 'That didn’t go through. Try again.');
    }
  };
  const once = async (name: string, fn: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(name);
    await commit(null, fn);
    setBusy(null);
  };

  const next = () => {
    const seen = { expectedIndex: round?.index ?? null, expectedPhase: round?.phase };
    commit({ phase: 'live', round: advance(round, questions, questionCount) }, () => run('next', seen));
  };
  const endNow = () => once('end', end);

  let primary: ReactNode = null;
  let secondary: ReactNode = null;
  if (phase === 'open' || phase === 'locked') {
    primary = (
      <Primary
        title="Start"
        accent
        disabled={host.entrantCount === 0}
        onPress={() => commit({ phase: 'live', round: quiz ? advance(lobbyRound(questionCount), questions, questionCount) : null }, () => start({ openFirst: quiz }))}
      />
    );
    secondary =
      phase === 'open' ? (
        <Quiet title="Lock entries" onPress={() => commit({ phase: 'locked', round: null }, lock)} />
      ) : (
        <Txt variant="label" color={Palette.paperMuted}>
          Locked
        </Txt>
      );
  } else if (phase === 'live') {
    const label =
      !quiz || !round
        ? 'End'
        : round.phase === 'lobby'
          ? 'First question'
          : round.phase === 'question'
            ? 'Close question'
            : round.phase === 'leaderboard'
              ? 'Next question'
              : 'Finish';
    const onPress = !quiz || round?.phase === 'finished' ? endNow : next;
    primary = <Primary title={label} disabled={label === 'End' && busy === 'end'} onPress={onPress} />;
    secondary = quiz ? <EndControl busy={busy === 'end'} onEnd={endNow} /> : null;
  } else if (phase === 'ended') {
    const approved = host.payouts.length > 0;
    primary =
      host.can.approvePayouts && !approved && host.payoutPreview && host.payoutPreview.paidCents > 0 ? (
        <Primary title="Approve payouts" disabled={busy === 'approve'} onPress={() => once('approve', approve)} />
      ) : (
        <Primary title="See recap" onPress={() => router.push(('/studio/recap/' + id) as Href)} />
      );
  }

  return (
    <Screen
      header={<Header />}
      footer={
        primary ? (
          <View style={styles.footerStack}>
            {error ? (
              <Animated.View entering={FadeIn.duration(150)}>
                <Txt variant="small" color={Palette.danger} style={styles.center}>
                  {error}
                </Txt>
              </Animated.View>
            ) : null}
            <View style={styles.footer}>
              {secondary}
              <View style={styles.flex}>{primary}</View>
            </View>
          </View>
        ) : null
      }>
      <Enter from={8}>
        <View style={styles.titleBlock}>
          <Txt variant="title">{host.config.title}</Txt>
          <Txt variant="small" color={Palette.paperMuted}>
            {[
              TEMPLATE_NAME[host.config.templateId] ?? host.config.templateId,
              quiz && questionCount ? questionCount + ' questions' : null,
              host.config.poolCents ? money(host.config.poolCents) + ' pool, concept' : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </Txt>
        </View>
      </Enter>
      {phase === 'open' || phase === 'locked' ? <Lobby host={host} /> : null}
      {phase === 'live' ? (
        quiz && board ? (
          <QuizBoard host={host} board={board} serverNow={live?.serverNow ?? null} />
        ) : (
          <TeamBoard host={host} />
        )
      ) : null}
      {phase === 'ended' ? <Final host={host} live={live} board={board} /> : null}
      {phase === 'cancelled' ? (
        <Txt variant="body" color={Palette.paperMuted}>
          {host.cancelReason ? 'Cancelled: ' + host.cancelReason : 'Cancelled'}
        </Txt>
      ) : null}
    </Screen>
  );
}

function Header() {
  return (
    <View style={styles.header}>
      <PressScale
        haptic="tap"
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        accessibilityRole="button"
        accessibilityLabel="Back">
        <Txt variant="label" color={Palette.paperMuted}>
          Back
        </Txt>
      </PressScale>
    </View>
  );
}

function Lobby({ host }: { host: HostConsoleView }) {
  const code = host.joinCode ?? '';
  const { share, label, copied } = useShareChallenge(code, host.shareUrl);
  const newest = [...host.entrants].reverse().slice(0, 12);
  return (
    <>
      <Enter from={8} delay={60}>
        <View style={styles.codeBlock}>
          <JoinQR code={code} shareUrl={host.shareUrl} variant="stage" />
          <PressScale haptic="tap" accessibilityRole="button" onPress={share} style={styles.share}>
            <Txt variant="label" color={copied ? Palette.ok : Palette.paper}>
              {label}
            </Txt>
          </PressScale>
        </View>
      </Enter>
      <View style={styles.entrants}>
        <View style={styles.countRow}>
          <Txt style={styles.count}>{host.entrantCount}</Txt>
          <Txt variant="body" color={Palette.paperMuted}>
            {host.entrantCount === 1 ? 'player in' : 'players in'}
          </Txt>
        </View>
        {newest.length ? (
          <View style={styles.names}>
            {newest.map((e) => (
              <Animated.View key={e.name + e.joinedAt} entering={FadeIn.duration(180)} layout={LinearTransition.duration(200)} style={styles.chip}>
                <Txt variant="small">{e.name}</Txt>
              </Animated.View>
            ))}
            {host.entrantCount > newest.length ? (
              <Txt variant="small" color={Palette.paperMuted} style={styles.more}>
                {'+' + (host.entrantCount - newest.length)}
              </Txt>
            ) : null}
          </View>
        ) : null}
      </View>
    </>
  );
}

function QuizBoard({ host, board, serverNow }: { host: HostConsoleView; board: Board; serverNow: number | null }) {
  const round = board.round;
  const open = round?.phase === 'question';
  const { now, read } = useServerNow(serverNow, open);
  const members = new Map(host.teams.map((t) => [t.label, t.memberNames]));
  const answered = board.rows.filter((r) => r.answeredCurrent).length;
  const scored = board.rows.some((r) => r.points > 0);
  const n = round?.questionCount ?? 0;
  const position = round?.index !== null && round?.index !== undefined ? 'Question ' + (round.index + 1) + ' of ' + n : '';
  const left = open && round?.closesAt ? Math.max(0, Math.min(round.closesAt - now, round.closesAt - (round.opensAt ?? now))) : 0;
  return (
    <>
      <View style={styles.round}>
        <View style={styles.roundHead}>
          <Txt variant="label" color={Palette.paperMuted} style={styles.flex}>
            {round?.phase === 'finished' ? 'All questions closed' : round?.phase === 'lobby' ? '' : position}
          </Txt>
          {open ? <Txt style={styles.timer}>{Math.ceil(left / 1000) + 's'}</Txt> : null}
        </View>
        <Countdown opensAt={round?.opensAt ?? null} closesAt={open ? (round?.closesAt ?? null) : null} read={read} />
        {round?.prompt ? (
          <Animated.View key={round.index} entering={FadeIn.duration(200)}>
            <Txt variant="quote">{round.prompt}</Txt>
          </Animated.View>
        ) : (
          <Txt variant="quote" color={Palette.paperMuted}>
            {board.rows.length ? board.rows.length + (board.rows.length === 1 ? ' team' : ' teams') + ' ready' : 'Dealing teams'}
          </Txt>
        )}
        {open ? (
          <Txt variant="small" color={Palette.paperMuted}>
            {answered + ' of ' + board.rows.length + ' answered'}
          </Txt>
        ) : round?.correctText ? (
          <Animated.View entering={FadeIn.duration(200)} style={styles.answer}>
            <Txt variant="small" color={Palette.paperMuted}>
              Answer
            </Txt>
            <Txt variant="bodyStrong">{round.correctText}</Txt>
          </Animated.View>
        ) : null}
      </View>
      <View style={styles.rows}>
        {board.rows.map((r) => (
          <Animated.View key={r.label} layout={LinearTransition.springify().damping(20).stiffness(240)} style={styles.row}>
            {scored ? (
              <Txt style={styles.rank} numberOfLines={1}>
                {r.points > 0 ? ordinal(r.rank) : ''}
              </Txt>
            ) : null}
            <TeamCell label={r.label} members={members.get(r.label) ?? []} />
            {open ? <View style={[styles.tick, r.answeredCurrent && styles.tickOn]} /> : null}
            <Txt style={styles.points}>{r.points.toLocaleString('en-US')}</Txt>
          </Animated.View>
        ))}
      </View>
    </>
  );
}

function Countdown({ opensAt, closesAt, read }: { opensAt: number | null; closesAt: number | null; read: () => number }) {
  const reduced = useReduced();
  const progress = useSharedValue(0);
  useEffect(() => {
    if (!closesAt || !opensAt) {
      progress.set(withTiming(0, { duration: 200, easing: Ease.out }));
      return;
    }
    const left = Math.max(0, closesAt - read());
    progress.set(left / Math.max(1, closesAt - opensAt));
    progress.set(withTiming(0, { duration: left, easing: Ease.linear }));
  }, [opensAt, closesAt, progress, read]);
  const fill = useAnimatedStyle(() => ({
    transform: [{ scaleX: progress.get() }],
  }));
  if (reduced && !closesAt) return null;
  return (
    <View style={styles.track}>
      <Animated.View style={[styles.fill, fill]} />
    </View>
  );
}

function TeamBoard({ host }: { host: HostConsoleView }) {
  const teams = [...host.teams].sort((a, b) => (a.place ?? Infinity) - (b.place ?? Infinity));
  return (
    <View style={styles.rows}>
      {teams.map((t) => (
        <Animated.View key={t.teamId} layout={LinearTransition.springify().damping(20).stiffness(240)} style={styles.row}>
          <Txt style={styles.rank}>{t.place ?? ''}</Txt>
          <TeamCell label={t.label} members={t.memberNames} />
          <Txt variant="label" color={Palette.paperMuted}>
            {t.status === 'finished' ? 'Finished' : 'Playing'}
          </Txt>
        </Animated.View>
      ))}
    </View>
  );
}

function Final({ host, live, board }: { host: HostConsoleView; live: LiveView | null; board: Board | null }) {
  const points = new Map(board?.rows.map((r) => [r.label, r.points]) ?? []);
  const cents = new Map(host.payoutPreview?.lines.map((l) => [l.place, l.players.reduce((s, p) => s + p.cents, 0)]) ?? []);
  const rows =
    live?.leaderboard ??
    host.results.map((r) => ({
      place: r.place,
      label: r.teamLabel,
      memberNames: r.memberNames,
      inMoney: r.inMoney,
    }));
  const approved = host.payouts.length > 0;
  return (
    <>
      <View style={styles.rows}>
        <Stagger from={8}>
          {rows.map((r) => (
            <View key={r.label} style={styles.row}>
              <Txt style={styles.rank} numberOfLines={1}>
                {ordinal(r.place)}
              </Txt>
              <TeamCell label={r.label} members={r.memberNames} />
              <View style={styles.right}>
                {points.has(r.label) ? <Txt style={styles.points}>{points.get(r.label)!.toLocaleString('en-US')}</Txt> : null}
                {r.inMoney && cents.get(r.place) ? (
                  <Txt variant="small" color={Palette.paperMuted}>
                    {money(cents.get(r.place)!)}
                  </Txt>
                ) : null}
              </View>
            </View>
          ))}
        </Stagger>
      </View>
      {rows.length === 0 ? (
        <Txt variant="body" color={Palette.paperMuted}>
          No team placed.
        </Txt>
      ) : null}
      {host.payoutPreview && host.payoutPreview.poolCents > 0 ? (
        <Txt variant="small" color={Palette.paperMuted}>
          {money(host.payoutPreview.paidCents) +
            (approved ? ' approved' : ' to pay out') +
            (host.payoutPreview.returnedCents ? ', ' + money(host.payoutPreview.returnedCents) + ' back to you' : '') +
            '. Concept · no real money moves.'}
        </Txt>
      ) : null}
    </>
  );
}

// Solo teams read as the player; bigger teams show their label over the members.
function TeamCell({ label, members }: { label: string; members: string[] }) {
  const solo = members.length === 1;
  return (
    <View style={styles.flex}>
      <Txt variant="bodyStrong" numberOfLines={1}>
        {solo ? members[0] : label}
      </Txt>
      {solo || !members.length ? null : (
        <Txt variant="small" color={Palette.paperMuted} numberOfLines={1}>
          {members.join(', ')}
        </Txt>
      )}
    </View>
  );
}

function Primary({ title, onPress, disabled, accent }: { title: string; onPress: () => void; disabled?: boolean; accent?: boolean }) {
  return (
    <PressScale
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      haptic="tap"
      onPress={onPress}
      style={[styles.primary, accent ? styles.accent : styles.ink, disabled && styles.disabled]}>
      <Animated.View key={title} entering={FadeIn.duration(120)}>
        <Txt variant="button" color={disabled ? Palette.disabledText : accent ? Palette.onAccent : Palette.ink}>
          {title}
        </Txt>
      </Animated.View>
    </PressScale>
  );
}

function Quiet({ title, onPress, busy, color = Palette.paper }: { title: string; onPress: () => void; busy?: boolean; color?: string }) {
  return (
    <PressScale accessibilityRole="button" disabled={busy} haptic="tap" onPress={onPress} style={styles.quiet}>
      <Txt variant="label" color={color}>
        {title}
      </Txt>
    </PressScale>
  );
}

// Ending is final, so the first release arms it and a second release within three seconds commits.
function EndControl({ busy, onEnd }: { busy: boolean; onEnd: () => void }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <Quiet
      title={armed ? 'Confirm end' : 'End'}
      busy={busy}
      color={armed ? Palette.danger : Palette.paperMuted}
      onPress={() => {
        if (!armed) return setArmed(true);
        setArmed(false);
        onEnd();
      }}
    />
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space.s,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Space.xl,
    paddingTop: Space.s,
    minHeight: 40,
  },
  titleBlock: { gap: Space.xs },
  share: { minHeight: 44, justifyContent: 'center', paddingHorizontal: Space.m },
  codeBlock: { alignItems: 'center', gap: Space.l, paddingTop: Space.s },
  entrants: { gap: Space.m, paddingTop: Space.s },
  countRow: { flexDirection: 'row', alignItems: 'baseline', gap: Space.s },
  count: {
    fontFamily: FontFamily.uiBold,
    fontSize: 40,
    lineHeight: 46,
    letterSpacing: -1,
    color: Palette.paper,
    fontVariant: ['tabular-nums'],
  },
  names: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Space.s,
    alignItems: 'center',
  },
  chip: {
    paddingHorizontal: Space.m,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    backgroundColor: Palette.paperShade,
  },
  more: { paddingHorizontal: Space.xs },
  round: { gap: Space.m },
  roundHead: { flexDirection: 'row', alignItems: 'baseline' },
  timer: {
    fontFamily: FontFamily.uiSemi,
    fontSize: 20,
    lineHeight: 24,
    color: Palette.paper,
    fontVariant: ['tabular-nums'],
  },
  track: {
    height: 4,
    borderRadius: 2,
    backgroundColor: Palette.hairline,
    overflow: 'hidden',
  },
  fill: { flex: 1, backgroundColor: Palette.paper, transformOrigin: 'left' },
  answer: { flexDirection: 'row', alignItems: 'baseline', gap: Space.s },
  rows: { gap: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.m,
    minHeight: 52,
    paddingVertical: Space.s,
  },
  rank: {
    width: 40,
    fontFamily: FontFamily.uiSemi,
    fontSize: 15,
    lineHeight: 20,
    color: Palette.paperMuted,
    fontVariant: ['tabular-nums'],
  },
  right: { alignItems: 'flex-end' },
  points: {
    fontFamily: FontFamily.uiSemi,
    fontSize: 17,
    lineHeight: 22,
    color: Palette.paper,
    fontVariant: ['tabular-nums'],
  },
  tick: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: Palette.hairline,
  },
  tickOn: { backgroundColor: Palette.paper, borderColor: Palette.paper },
  footerStack: { gap: Space.s },
  footer: { flexDirection: 'row', alignItems: 'center', gap: Space.l },
  quiet: {
    minHeight: 56,
    justifyContent: 'center',
    paddingHorizontal: Space.xs,
  },
  primary: {
    minHeight: 56,
    borderRadius: Radius.m,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Space.xl,
  },
  accent: { backgroundColor: Palette.ember },
  ink: { backgroundColor: Palette.paper },
  disabled: { backgroundColor: Palette.paperShade },
});
