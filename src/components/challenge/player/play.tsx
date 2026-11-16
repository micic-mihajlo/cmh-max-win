import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/signal/backdrop';
import { Txt } from '@/components/signal/txt';
import Animated, { FadeIn } from 'react-native-reanimated';

import { FontFamily, Palette, Space, Type } from '@/constants/signal';
import { Duration, Enter, Haptic, useReduced } from '@/motion';

import { AnswerTile, type TileState } from './answer-tile';
import { useCount } from './count';
import { DrainBar, Heartbeat, SecondsLeft } from './countdown';
import { points, type QuizQuestionView, type QuizSharedView } from './format';
import { Takeover } from './takeover';
import type { TeamStyle } from '@/lib/teams';

function tileState(q: QuizQuestionView, choice: number, picked: number | null, mineIt: boolean): TileState {
  if (q.correctChoice !== null) {
    if (choice === q.correctChoice) return 'correct';
    return choice === picked ? 'missed' : 'dim';
  }
  if (picked === null) return 'idle';
  if (choice !== picked) return 'dim';
  return mineIt ? 'mine' : 'team';
}

function verdict(q: QuizQuestionView, picked: number | null, mineIt: boolean) {
  if (picked !== null && picked === q.correctChoice) return mineIt ? 'Correct' : 'Your team got it';
  return picked === null ? 'No answer in time' : 'Not this one';
}

// The full-bleed result moment after a question closes: the verdict, the points counting up, and the right answer.
function RevealBeat({ q, picked, mineIt, onDone }: { q: QuizQuestionView; picked: number | null; mineIt: boolean; onDone: () => void }) {
  const right = picked !== null && picked === q.correctChoice;
  const gained = useCount(right ? (q.points ?? 0) : null, 0);
  return (
    <Takeover holdMs={1200} onDone={onDone}>
      <Txt variant="label" color={Palette.paperMuted}>
        {`Question ${q.index + 1}`}
      </Txt>
      <Txt variant="title" color={Palette.paper}>
        {verdict(q, picked, mineIt)}
      </Txt>
      {right ? (
        <Text maxFontSizeMultiplier={1.2} style={styles.gain}>{`+${points(gained ?? 0)}`}</Text>
      ) : q.correctChoice !== null ? (
        <View style={styles.answer}>
          <Txt variant="caption" color={Palette.paperMuted}>
            The answer
          </Txt>
          <Txt variant="name" color={Palette.paper}>
            {q.choices[q.correctChoice]}
          </Txt>
        </View>
      ) : null}
    </Takeover>
  );
}

export function PlayScreen({
  quiz,
  answeredByMe,
  serverNow,
  team,
  onAnswer,
}: {
  quiz: QuizSharedView;
  team: TeamStyle | null;
  answeredByMe: number[];
  serverNow: number;
  onAnswer: (questionIndex: number, choice: number) => Promise<string | null>;
}) {
  const q = quiz.questions[quiz.questions.length - 1];
  const [offset] = useState(() => serverNow - Date.now());
  const [pending, setPending] = useState<{ index: number; choice: number } | null>(null);
  const [refused, setRefused] = useState<{ index: number; message: string } | null>(null);
  const [shake, setShake] = useState({ index: -1, choice: -1, n: 0 });
  const reduced = useReduced();

  const error = refused?.index === q.index ? refused.message : null;
  const local = pending?.index === q.index ? pending.choice : null;
  const picked = q.answer?.choice ?? local;
  const mineIt = q.answer ? answeredByMe.includes(q.index) : local !== null;
  const open = !q.closed;
  const right = q.closed && picked !== null && picked === q.correctChoice;

  const [seen, setSeen] = useState({ index: q.index, closed: q.closed });
  const [beat, setBeat] = useState<number | null>(null);
  if (seen.index !== q.index || seen.closed !== q.closed) {
    if (q.closed && seen.index === q.index && !seen.closed) setBeat(q.index);
    setSeen({ index: q.index, closed: q.closed });
  }
  const beatOn = beat === q.index;
  useEffect(() => {
    if (beatOn && right) Haptic.success();
  }, [beatOn, right]);

  const answer = async (choice: number) => {
    setPending({ index: q.index, choice });
    const refused = await onAnswer(q.index, choice);
    if (refused) {
      setPending(null);
      setRefused({ index: q.index, message: refused });
      setShake((s) => ({ index: q.index, choice, n: s.n + 1 }));
    }
  };

  const status = q.closed ? null : picked !== null ? (mineIt ? 'Locked in' : 'Your team locked in') : null;

  return (
    <Screen
      scroll={false}
      contentStyle={styles.content}
      overlay={beatOn ? <RevealBeat q={q} picked={picked} mineIt={mineIt} onDone={() => setBeat(null)} /> : null}>
      <View style={styles.head}>
        <View style={styles.row}>
          <View style={styles.where}>
            {team ? <View style={[styles.marker, { backgroundColor: team.ink }]} /> : null}
            <Txt variant="label" color={Palette.paperMuted}>
              {team ? `${team.name} · ${q.index + 1} of ${quiz.questionCount}` : `Question ${q.index + 1} of ${quiz.questionCount}`}
            </Txt>
          </View>
          {q.closed ? (
            <Txt variant="time" color={Palette.paperMuted}>
              {`${points(quiz.points)} pts`}
            </Txt>
          ) : (
            <SecondsLeft closesAt={q.closesAt} offset={offset} />
          )}
        </View>
        <DrainBar opensAt={q.opensAt} closesAt={q.closesAt} offset={offset} stopped={q.closed} />
      </View>

      <Animated.View key={`prompt-${q.index}`} entering={reduced ? undefined : FadeIn.duration(Duration.swap)} style={styles.prompt}>
        <Txt style={q.prompt.length > 70 ? Type.quote : Type.title} accessibilityRole="header">
          {q.prompt}
        </Txt>
      </Animated.View>

      <View style={styles.band}>{open ? <Heartbeat closesAt={q.closesAt} offset={offset} /> : null}</View>

      <View style={styles.bottom}>
        <View style={styles.status} accessibilityLiveRegion="polite">
          {q.closed ? (
            <Enter key={`verdict-${q.index}`} from={8}>
              <Txt variant="name">{right ? `${verdict(q, picked, mineIt)} · +${points(q.points ?? 0)}` : verdict(q, picked, mineIt)}</Txt>
            </Enter>
          ) : error ? (
            <Txt variant="small" color={Palette.danger}>
              {error}
            </Txt>
          ) : status ? (
            <Txt variant="smallStrong">{status}</Txt>
          ) : null}
        </View>
        <Enter index={1} style={styles.tiles}>
          {q.choices.map((choice, i) => {
            const state = tileState(q, i, picked, mineIt);
            const note =
              state === 'mine' ? 'You' : state === 'team' ? 'Team' : state === 'correct' && picked === i ? 'You' : null;
            return (
              <AnswerTile
                key={`tile-${i}`}
                label={choice}
                state={state}
                note={note}
                shake={shake.index === q.index && shake.choice === i ? shake.n : 0}
                onPress={open && picked === null ? () => answer(i) : undefined}
              />
            );
          })}
        </Enter>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: Space.m, gap: 0 },
  head: { gap: Space.s },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  prompt: { marginTop: Space.xxl },
  where: { flexDirection: 'row', alignItems: 'center', gap: Space.s },
  marker: { width: 10, height: 10, borderRadius: 5 },
  band: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  bottom: { gap: Space.m },
  gain: { fontFamily: FontFamily.uiBold, fontSize: 88, lineHeight: 96, letterSpacing: -3, color: Palette.paper, fontVariant: ['tabular-nums'] },
  answer: { marginTop: Space.l, gap: 2 },
  status: { minHeight: 28, justifyContent: 'flex-end' },
  tiles: { gap: Space.m },
});
