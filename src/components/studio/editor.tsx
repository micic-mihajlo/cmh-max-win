import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Txt } from '@/components/signal/txt';
import { Caption, Card, Chip, Field, G, PrimaryButton, Section, StudioScreen, studio } from '@/components/showcase/studio-ui';
import { FontFamily, Palette, Space } from '@/constants/signal';
import { usePublishChallenge, useUpdateChallengeDraft } from '@/hooks/use-challenges';
import type { ChallengeConfig, ChallengeConfigPatch, ChallengeDraftView } from '@/lib/contract';
import { Enter, Haptic, PressScale } from '@/motion';

import { errorMessage, money, teamSizeName, templateName } from './format';
import { blankQuestion, QUIZ, quizOf, type QuizQuestion } from './quiz-config';

const POOLS = [0, 2500, 10000, 25000];
const SAVE_AFTER_MS = 400;

export function DraftEditor({ draft }: { draft: ChallengeDraftView }) {
  const update = useUpdateChallengeDraft(draft.challengeId);
  const publish = usePublishChallenge(draft.challengeId);
  const [cfg, setCfg] = useState<ChallengeConfig>(draft.config);
  const pending = useRef<ChallengeConfigPatch>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const patch = pending.current;
    pending.current = {};
    if (!Object.keys(patch).length) return;
    setSaving(true);
    try {
      await update(patch);
    } finally {
      setSaving(false);
    }
  }, [update]);

  useEffect(() => () => void flush(), [flush]);

  const change = (patch: ChallengeConfigPatch) => {
    setCfg((c) => ({ ...c, ...patch }));
    pending.current = { ...pending.current, ...patch };
    setProblem(null);
    setSaving(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), SAVE_AFTER_MS);
  };

  const quiz = quizOf(cfg.templateConfig);
  const setQuestions = (questions: QuizQuestion[]) => change({ templateConfig: { questions } });
  const setQuestion = (i: number, q: Partial<QuizQuestion>) => setQuestions(quiz.questions.map((x, k) => (k === i ? { ...x, ...q } : x)));

  const submit = async () => {
    setPublishing(true);
    try {
      await flush();
      await publish();
      Haptic.success();
    } catch (e) {
      Haptic.warning();
      setProblem(errorMessage(e, 'Couldn’t publish. Try again.'));
      setPublishing(false);
    }
  };

  return (
    <StudioScreen
      title={templateName(cfg.templateId)}
      footer={<PrimaryButton variant="accent" title={publishing ? 'Publishing…' : 'Publish'} disabled={publishing} onPress={submit} />}>
      <Field value={cfg.title} onChange={(title) => change({ title })} placeholder="Title" big maxLength={60} autoFocus={!cfg.title} />

      {cfg.templateId === 'quick-quiz' ? (
        <Section title="Questions">
          {quiz.questions.map((q, i) => (
            <Enter key={i} from={6}>
              <QuestionCard
                n={i + 1}
                q={q}
                onChange={(patch) => setQuestion(i, patch)}
                onRemove={quiz.questions.length > QUIZ.minQuestions ? () => setQuestions(quiz.questions.filter((_, k) => k !== i)) : undefined}
              />
            </Enter>
          ))}
          {quiz.questions.length < QUIZ.maxQuestions ? (
            <Pressable accessibilityRole="button" hitSlop={12} style={styles.add} onPress={() => setQuestions([...quiz.questions, blankQuestion()])}>
              <Txt variant="label" color={G.ink}>
                Add question
              </Txt>
            </Pressable>
          ) : null}
        </Section>
      ) : (
        <Card>
          <Txt variant="bodyStrong" color={G.ink}>
            {draft.template.name}
          </Txt>
          <Txt variant="small" color={G.inkSoft}>
            {draft.template.blurb}
          </Txt>
        </Card>
      )}

      <Section title="Teams">
        <View style={studio.wrap}>
          {draft.template.teamSizes.map((n) => (
            <Chip key={n} label={teamSizeName(n)} selected={cfg.teamSize === n} onPress={() => change({ teamSize: n })} />
          ))}
        </View>
      </Section>

      <Section title="Prize pool">
        <View style={studio.wrap}>
          {POOLS.map((cents) => (
            <Chip key={cents} label={cents ? money(cents) : 'None'} selected={cfg.poolCents === cents} onPress={() => change({ poolCents: cents })} />
          ))}
        </View>
        {cfg.poolCents > 0 ? <Caption>Concept payout · split {rewardSplit(cfg)}</Caption> : null}
      </Section>

      {problem ? (
        <Enter from={4}>
          <Caption color={G.bad}>{problem}</Caption>
        </Enter>
      ) : saving ? (
        <Caption>Saving…</Caption>
      ) : null}
    </StudioScreen>
  );
}

function rewardSplit(cfg: ChallengeConfig) {
  const r = cfg.reward;
  if (r.kind === 'placement') return r.percents.join(' / ');
  if (r.kind === 'winner_takes_all') return 'winner takes all';
  return `top ${r.places} equally`;
}

function QuestionCard({
  n,
  q,
  onChange,
  onRemove,
}: {
  n: number;
  q: QuizQuestion;
  onChange: (q: Partial<QuizQuestion>) => void;
  onRemove?: () => void;
}) {
  return (
    <Card>
      <View style={studio.between}>
        <Caption>Question {n}</Caption>
        {onRemove ? (
          <Pressable accessibilityRole="button" accessibilityLabel={`Remove question ${n}`} hitSlop={12} onPress={onRemove}>
            <Caption>Remove</Caption>
          </Pressable>
        ) : null}
      </View>
      <TextInput
        value={q.prompt}
        onChangeText={(prompt) => onChange({ prompt })}
        placeholder="Ask something"
        placeholderTextColor={Palette.disabledText}
        multiline
        numberOfLines={1}
        maxLength={200}
        style={styles.prompt}
      />
      <View style={styles.choices}>
        {q.choices.map((choice, i) => (
          <View key={i} style={styles.choice}>
            <PressScale
              accessibilityRole="radio"
              accessibilityState={{ checked: q.correct === i }}
              accessibilityLabel={`Mark choice ${i + 1} correct`}
              haptic="tap"
              onPress={() => onChange({ correct: i })}>
              <View style={[styles.mark, q.correct === i && styles.markOn]}>{q.correct === i ? <Txt style={styles.tick}>✓</Txt> : null}</View>
            </PressScale>
            <TextInput
              value={choice}
              onChangeText={(t) =>
                onChange({
                  choices: q.choices.map((c, k) => (k === i ? t : c)),
                })
              }
              placeholder={`Choice ${i + 1}`}
              placeholderTextColor={Palette.disabledText}
              maxLength={80}
              style={styles.choiceInput}
            />
            {q.choices.length > QUIZ.minChoices ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove choice ${i + 1}`}
                hitSlop={10}
                onPress={() =>
                  onChange({
                    choices: q.choices.filter((_, k) => k !== i),
                    correct: q.correct === i ? 0 : q.correct > i ? q.correct - 1 : q.correct,
                  })
                }>
                <Txt variant="body" color={G.inkSoft}>
                  ×
                </Txt>
              </Pressable>
            ) : null}
          </View>
        ))}
      </View>
      <View style={studio.between}>
        <View style={studio.row}>
          {QUIZ.times.map((ms) => (
            <Chip key={ms} label={`${ms / 1000}s`} selected={q.timeLimitMs === ms} onPress={() => onChange({ timeLimitMs: ms })} />
          ))}
        </View>
        {q.choices.length < QUIZ.maxChoices ? (
          <Pressable accessibilityRole="button" hitSlop={10} onPress={() => onChange({ choices: [...q.choices, ''] })}>
            <Txt variant="label" color={G.ink}>
              Add choice
            </Txt>
          </Pressable>
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  prompt: {
    fontFamily: FontFamily.uiSemi,
    fontSize: 17,
    lineHeight: 24,
    color: G.ink,
    padding: 0,
    minHeight: 24,
  },
  choices: { gap: Space.s },
  add: { alignSelf: 'flex-start', paddingVertical: Space.s },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.m,
    backgroundColor: G.fill,
    borderRadius: 12,
    paddingHorizontal: Space.m,
    minHeight: 48,
  },
  choiceInput: {
    flex: 1,
    fontFamily: FontFamily.ui,
    fontSize: 17,
    lineHeight: 24,
    color: G.ink,
    paddingVertical: Space.s,
  },
  mark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: G.line,
    backgroundColor: G.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markOn: { backgroundColor: G.ink, borderColor: G.ink },
  tick: {
    color: G.onInk,
    fontSize: 13,
    lineHeight: 16,
    fontFamily: FontFamily.uiBold,
  },
});
