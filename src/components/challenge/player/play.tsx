import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/signal/backdrop';
import { Txt } from '@/components/signal/txt';
import { Palette, Space, Type } from '@/constants/signal';
import { Enter, Haptic } from '@/motion';

import { AnswerTile, type TileState } from './answer-tile';
import { DrainBar, SecondsLeft } from './countdown';
import { points, type QuizQuestionView, type QuizSharedView } from './format';

function tileState(q: QuizQuestionView, choice: number, picked: number | null, mineIt: boolean): TileState {
  if (q.correctChoice !== null) {
    if (choice === q.correctChoice) return 'correct';
    return choice === picked ? 'missed' : 'dim';
  }
  if (picked === null) return 'idle';
  if (choice !== picked) return 'dim';
  return mineIt ? 'mine' : 'team';
}

function Verdict({ q, picked, mineIt }: { q: QuizQuestionView; picked: number | null; mineIt: boolean }) {
  if (picked !== null && picked === q.correctChoice) {
    const gained = `+${points(q.points ?? 0)}`;
    return <Txt variant="name">{mineIt ? `Correct · ${gained}` : `Your team got it · ${gained}`}</Txt>;
  }
  return <Txt variant="name">{picked === null ? 'No answer in time' : 'Not this one'}</Txt>;
}

export function PlayScreen({
  quiz,
  answeredByMe,
  serverNow,
  onAnswer,
}: {
  quiz: QuizSharedView;
  answeredByMe: number[];
  serverNow: number;
  onAnswer: (questionIndex: number, choice: number) => Promise<string | null>;
}) {
  const q = quiz.questions[quiz.questions.length - 1];
  const [offset] = useState(() => serverNow - Date.now());
  const [pending, setPending] = useState<{ index: number; choice: number } | null>(null);
  const [refused, setRefused] = useState<{ index: number; message: string } | null>(null);

  const error = refused?.index === q.index ? refused.message : null;
  const local = pending?.index === q.index ? pending.choice : null;
  const picked = q.answer?.choice ?? local;
  const mineIt = q.answer ? answeredByMe.includes(q.index) : local !== null;
  const open = !q.closed;
  const right = q.closed && picked !== null && picked === q.correctChoice;

  const watched = useRef<{ index: number; closed: boolean } | null>(null);
  useEffect(() => {
    const before = watched.current;
    watched.current = { index: q.index, closed: q.closed };
    if (right && before?.index === q.index && !before.closed) Haptic.success();
  }, [q.index, q.closed, right]);

  const answer = async (choice: number) => {
    setPending({ index: q.index, choice });
    const refused = await onAnswer(q.index, choice);
    if (refused) {
      setPending(null);
      setRefused({ index: q.index, message: refused });
    }
  };

  const status = q.closed ? null : picked !== null ? (mineIt ? 'Locked in' : 'Your team locked in') : null;

  return (
    <Screen scroll={false} contentStyle={styles.content}>
      <View style={styles.head}>
        <View style={styles.row}>
          <Txt variant="label" color={Palette.paperMuted}>
            {`Question ${q.index + 1} of ${quiz.questionCount}`}
          </Txt>
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

      <Enter key={`prompt-${q.index}`} style={styles.prompt}>
        <Txt style={q.prompt.length > 70 ? Type.quote : Type.title} accessibilityRole="header">
          {q.prompt}
        </Txt>
      </Enter>

      <View style={styles.bottom}>
        <View style={styles.status} accessibilityLiveRegion="polite">
          {q.closed ? (
            <Enter key={`verdict-${q.index}`} from={8}>
              <Verdict q={q} picked={picked} mineIt={mineIt} />
            </Enter>
          ) : error ? (
            <Txt variant="small" color={Palette.danger}>
              {error}
            </Txt>
          ) : status ? (
            <Txt variant="smallStrong">{status}</Txt>
          ) : null}
        </View>
        <View style={styles.tiles}>
          {q.choices.map((choice, i) => {
            const state = tileState(q, i, picked, mineIt);
            const note =
              state === 'mine' ? 'You' : state === 'team' ? 'Team' : state === 'correct' && picked === i ? 'You' : null;
            return (
              <Enter key={`${q.index}-${i}`} index={i + 1}>
                <AnswerTile label={choice} state={state} note={note} onPress={open && picked === null ? () => answer(i) : undefined} />
              </Enter>
            );
          })}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: Space.m, gap: 0 },
  head: { gap: Space.s },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  prompt: { marginTop: Space.xxl },
  bottom: { flex: 1, justifyContent: 'flex-end', gap: Space.m },
  status: { minHeight: 28, justifyContent: 'flex-end' },
  tiles: { gap: Space.m },
});
