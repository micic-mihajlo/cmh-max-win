import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Screen } from '@/components/signal/backdrop';
import { CodeCells } from '@/components/signal/code-cells';
import { Button, Label } from '@/components/signal/primitives';
import { Txt } from '@/components/signal/txt';
import { Wordmark } from '@/components/wordmark';
import { FontFamily, Palette, Radius, Space } from '@/constants/signal';
import { useChallengeByCode, useJoinChallenge, useMyPayout } from '@/hooks/use-challenges';
import { usePlayerAction, useTeamSessionView } from '@/hooks/use-live';
import { usePlayerName } from '@/hooks/use-player-name';
import type { PlayerChallengeView } from '@/lib/contract';
import { parseJoinCode } from '@/lib/join-code';
import { toSignalError } from '@/lib/signal-error';
import type { QuizSharedView } from '@convex/templates/quickQuiz';

import { isAppClip, promptFullApp } from '../../../modules/app-clip';

// The App Clip's player path: code from the invocation URL, then join, play and result on the existing hooks.
// A stand-in until the player route /c/[code] is on main; then the clip renders that screen instead.
export function ClipPlayer({ code: invoked }: { code: string | null }) {
  const [code, setCode] = useState(invoked);
  return code ? <Challenge key={code} code={code} onReset={() => setCode(null)} /> : <CodeEntry onCode={setCode} />;
}

function GetApp() {
  if (!isAppClip) return null;
  return <Button title="Get the full SIGNAL app" variant="ghost" onPress={promptFullApp} />;
}

function CodeEntry({ onCode }: { onCode: (code: string) => void }) {
  const [draft, setDraft] = useState('');
  const code = parseJoinCode(draft);
  return (
    <Screen contentStyle={styles.center} footer={<Button title="Find challenge" disabled={!code} onPress={() => code && onCode(code)} />}>
      <Wordmark style={styles.brand} />
      <Txt variant="title" style={styles.centerText}>
        Enter the code on stream
      </Txt>
      <Pressable accessibilityLabel="Challenge code">
        <CodeCells value={draft.toUpperCase()} />
        <TextInput
          autoFocus
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={4}
          value={draft}
          onChangeText={(t) => {
            const next = t.replace(/[^a-z0-9]/gi, '').toUpperCase();
            setDraft(next);
            const full = parseJoinCode(next);
            if (full) onCode(full);
          }}
          onSubmitEditing={() => code && onCode(code)}
          style={styles.hiddenInput}
        />
      </Pressable>
    </Screen>
  );
}

function Challenge({ code, onReset }: { code: string; onReset: () => void }) {
  const view = useChallengeByCode(code);
  if (view === undefined) return <Loading />;
  if (view === null || view.status === 'draft') {
    return (
      <Screen contentStyle={styles.center} footer={<Button title="Try another code" variant="secondary" onPress={onReset} />}>
        <Txt variant="title" style={styles.centerText}>
          No live challenge for {code}
        </Txt>
        <Txt color={Palette.paperMuted} style={styles.centerText}>
          Check the code on stream and try again.
        </Txt>
      </Screen>
    );
  }
  if (view.cancelled) {
    return <Message view={view} title="This challenge was cancelled" body={view.cancelled.reason} />;
  }
  return view.me.entered ? <Entered view={view} /> : <Join view={view} code={code} />;
}

function Loading() {
  return (
    <Screen contentStyle={styles.center}>
      <ActivityIndicator color={Palette.paperMuted} />
    </Screen>
  );
}

function Header({ view }: { view: PlayerChallengeView }) {
  const prize = view.poolCents > 0 ? `$${Math.round(view.poolCents / 100)} prize${view.payoutAdapter === 'concept' ? ' · concept' : ''}` : null;
  return (
    <View style={styles.header}>
      <Label>{view.creator.displayName}</Label>
      <Txt variant="title">{view.title}</Txt>
      {view.blurb ? <Txt color={Palette.paperMuted}>{view.blurb}</Txt> : null}
      <Txt variant="small" color={Palette.paperMuted}>
        {[`${view.entrantCount} playing`, view.teamSize > 1 ? `teams of ${view.teamSize}` : null, prize].filter(Boolean).join(' · ')}
      </Txt>
    </View>
  );
}

function Message({ view, title, body }: { view: PlayerChallengeView; title: string; body?: string }) {
  return (
    <Screen footer={<GetApp />}>
      <Header view={view} />
      <View style={styles.card}>
        <Txt variant="name">{title}</Txt>
        {body ? <Txt color={Palette.paperMuted}>{body}</Txt> : null}
      </View>
    </Screen>
  );
}

function Join({ view, code }: { view: PlayerChallengeView; code: string }) {
  const { name, save } = usePlayerName();
  const join = useJoinChallenge();
  const [draft, setDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const value = draft ?? name ?? '';
  const trimmed = value.trim();

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await save(trimmed);
      await join({ code, name: trimmed });
    } catch (e) {
      const err = toSignalError(e);
      setError(err?.code === 'WHOP_SIGN_IN_REQUIRED' ? 'This one needs Whop sign-in. Join it from the full SIGNAL app.' : (err?.message ?? 'Could not join. Try again.'));
    } finally {
      setBusy(false);
    }
  };

  if (view.status === 'ended') return <Message view={view} title="This challenge has ended" />;
  return (
    <Screen
      footer={
        <>
          <Button title={busy ? 'Joining…' : 'Join'} disabled={!trimmed || busy} onPress={submit} />
          <GetApp />
        </>
      }>
      <Header view={view} />
      <View style={styles.card}>
        <Label>Your name</Label>
        <TextInput
          value={value}
          onChangeText={setDraft}
          placeholder="First name"
          placeholderTextColor={Palette.paperFaint}
          autoCapitalize="words"
          autoCorrect={false}
          maxLength={24}
          returnKeyType="join"
          onSubmitEditing={() => trimmed && submit()}
          style={styles.input}
        />
        {error ? (
          <Txt variant="small" color={Palette.danger}>
            {error}
          </Txt>
        ) : null}
      </View>
    </Screen>
  );
}

function Entered({ view }: { view: PlayerChallengeView }) {
  const session = useTeamSessionView(view.status === 'live' ? view.challengeId : null);
  const payout = useMyPayout(view.status === 'ended' ? view.challengeId : null);
  const who = view.me.name ? `You're in, ${view.me.name}` : "You're in";

  if (view.status === 'published') return <Message view={view} title={who} body={`Waiting for ${view.creator.displayName} to start.`} />;
  if (view.status === 'ended') {
    if (payout === undefined) return <Loading />;
    return payout ? (
      <Message view={view} title={`#${payout.place} · ${payout.teamLabel}`} body={`$${(payout.cents / 100).toFixed(2)} · ${payout.label}`} />
    ) : (
      <Message view={view} title="That's a wrap" body="Thanks for playing." />
    );
  }
  if (session === undefined) return <Loading />;
  if (session === null) return <Message view={view} title={who} body="Teams are forming. Hang tight." />;
  const quiz = session.shared as QuizSharedView | null;
  if (view.templateId === 'quick-quiz' && quiz?.questions) return <Quiz view={view} team={session.teamLabel} quiz={quiz} />;
  return <Message view={view} title={session.teamLabel} body="This challenge plays in the full SIGNAL app." />;
}

function Quiz({ view, team, quiz }: { view: PlayerChallengeView; team: string; quiz: QuizSharedView }) {
  const act = usePlayerAction(view.challengeId);
  const [error, setError] = useState<string | null>(null);
  const open = quiz.questions.find((q) => !q.closed);
  const last = quiz.questions[quiz.questions.length - 1];
  const q = open ?? last;

  const answer = async (choice: number) => {
    setError(null);
    try {
      await act({ type: 'answer', questionIndex: q.index, choice });
    } catch (e) {
      setError(toSignalError(e)?.message ?? 'That answer did not go through.');
    }
  };

  return (
    <Screen footer={<GetApp />}>
      <View style={styles.header}>
        <Label>
          {team} · {quiz.points} pts
        </Label>
        {q ? (
          <Txt variant="small" color={Palette.paperMuted}>
            Question {q.index + 1} of {quiz.questionCount}
          </Txt>
        ) : null}
      </View>
      {!q ? (
        <Txt variant="title">First question soon</Txt>
      ) : (
        <>
          <Txt variant="title">{q.prompt}</Txt>
          <View style={styles.choices}>
            {q.choices.map((choice, i) => {
              const picked = q.answer?.choice === i;
              const correct = q.correctChoice === i;
              return (
                <Pressable
                  key={i}
                  accessibilityRole="button"
                  accessibilityState={{ selected: picked, disabled: !!q.answer || q.closed }}
                  disabled={!!q.answer || q.closed}
                  onPress={() => answer(i)}
                  style={({ pressed }) => [
                    styles.choice,
                    picked && styles.choicePicked,
                    q.closed && correct && styles.choiceCorrect,
                    pressed && styles.choicePressed,
                  ]}>
                  <Txt variant="bodyStrong" color={picked ? Palette.onAccent : Palette.paper}>
                    {choice}
                  </Txt>
                </Pressable>
              );
            })}
          </View>
          <Txt variant="small" color={Palette.paperMuted}>
            {quiz.finished ? `Done · ${quiz.points} points` : q.closed ? 'Next question soon' : q.answer ? 'Locked in for your team' : 'One answer per team'}
          </Txt>
        </>
      )}
      {error ? (
        <Txt variant="small" color={Palette.danger}>
          {error}
        </Txt>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flexGrow: 1, justifyContent: 'center', gap: Space.xl },
  centerText: { textAlign: 'center' },
  brand: { alignSelf: 'center' },
  hiddenInput: { ...StyleSheet.absoluteFill, opacity: 0.02, color: 'transparent' },
  header: { gap: Space.s },
  card: {
    gap: Space.m,
    padding: Space.l,
    borderRadius: Radius.m,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.hairline,
    backgroundColor: Palette.card,
  },
  input: {
    fontFamily: FontFamily.uiSemi,
    fontSize: 22,
    color: Palette.paper,
    paddingVertical: Space.s,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Palette.hairline,
  },
  choices: { gap: Space.m },
  choice: {
    minHeight: 56,
    justifyContent: 'center',
    paddingHorizontal: Space.l,
    borderRadius: Radius.m,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.hairline,
    backgroundColor: Palette.card,
  },
  choicePicked: { backgroundColor: Palette.ember, borderColor: Palette.ember },
  choiceCorrect: { borderColor: Palette.ok, borderWidth: 2 },
  choicePressed: { transform: [{ scale: 0.98 }] },
});
