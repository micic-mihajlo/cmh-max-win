import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { Space } from "@/constants/signal";
import { Txt } from "@/components/signal/txt";
import { auroraDraft, draftStore } from "@/components/showcase/draft-store";
import {
  difficulties,
  generatePuzzle,
  settings,
  type Difficulty,
  type Setting,
} from "@/components/showcase/generate";
import {
  Card,
  Chip,
  G,
  PrimaryButton,
  RoleCaption,
  Section,
  StudioScreen,
  studio,
} from "@/components/showcase/studio-ui";
import { validatePuzzle } from "@/components/showcase/validate";
import {
  challengeTemplates,
  type ChallengeTemplateId,
} from "@/mocks/showcase/templates";
import { Enter } from "@/motion";

export default function Generate() {
  const [template, setTemplate] = useState<ChallengeTemplateId>("mystery");
  const picked = challengeTemplates.find((t) => t.id === template)!;
  const [setting, setSetting] = useState<Setting>("manor");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [seed, setSeed] = useState(1);
  const puzzle = generatePuzzle({ setting, difficulty, seed });
  const report = validatePuzzle(puzzle);
  const passed = report.checks.filter((c) => c.pass).length;
  const answer = puzzle.suspects.find((s) => s.id === puzzle.answer)!;

  return (
    <StudioScreen
      kicker="From templates"
      title="Generate a puzzle"
      footer={
        !picked.ready ? undefined : (
          <>
            <PrimaryButton
              title="Another"
              variant="text"
              onPress={() => setSeed(seed + 1)}
            />
            <PrimaryButton
              title="Open in builder"
              onPress={() => {
                draftStore.set({
                  ...auroraDraft,
                  ...puzzle,
                  setting: settings.find((s) => s.id === setting)!.label,
                });
                router.push("/studio/builder?step=check");
              }}
            />
          </>
        )
      }
    >
      <Section title="Template">
        <View style={studio.wrap}>
          {challengeTemplates.map((t) => (
            <Chip
              key={t.id}
              label={t.name}
              selected={template === t.id}
              onPress={() => setTemplate(t.id)}
            />
          ))}
        </View>
        <Txt variant="body" color={G.inkSoft}>
          {picked.line}
        </Txt>
        {picked.ready ? null : (
          <Txt variant="smallStrong" color={G.ink}>
            Coming after Mystery.
          </Txt>
        )}
      </Section>

      {picked.ready ? (
        <>
          <Section title="Setting">
            <View style={studio.wrap}>
              {settings.map((s) => (
                <Chip
                  key={s.id}
                  label={s.label}
                  selected={setting === s.id}
                  onPress={() => setSetting(s.id)}
                />
              ))}
            </View>
          </Section>
          <Section title="Difficulty">
            <View style={studio.wrap}>
              {difficulties.map((d) => (
                <Chip
                  key={d.id}
                  label={`${d.label} · ${d.suspects} suspects`}
                  selected={difficulty === d.id}
                  onPress={() => setDifficulty(d.id)}
                />
              ))}
            </View>
          </Section>

          <Enter key={`${setting}-${difficulty}-${seed}`} from={10}>
            <View style={studio.gap}>
              <View style={styles.head}>
                <Txt variant="name" color={G.ink}>
                  {puzzle.title}
                </Txt>
                <Txt variant="body" color={G.ink}>
                  {puzzle.setup}
                </Txt>
                <Txt variant="smallStrong" color={report.pass ? G.ok : G.bad}>
                  {report.pass ? "✓" : "✕"} Puzzle check {passed}/
                  {report.checks.length} · answer {answer.name}
                </Txt>
              </View>
              <Card>
                {puzzle.suspects.map((s) => (
                  <View key={s.id}>
                    <Txt variant="bodyStrong">{s.name}</Txt>
                    <Txt variant="small" color={G.inkSoft}>
                      {s.job} · “{s.claim}”
                    </Txt>
                  </View>
                ))}
              </Card>
              {puzzle.pieces.map((p) => (
                <Card key={p.id} style={{ backgroundColor: G.role[p.role] }}>
                  <RoleCaption role={p.role} docLabel={p.docLabel} />
                  <Txt variant="body" color={G.ink}>
                    {p.text}
                  </Txt>
                </Card>
              ))}
            </View>
          </Enter>
        </>
      ) : null}
    </StudioScreen>
  );
}

const styles = StyleSheet.create({
  head: { gap: Space.s, marginTop: Space.s },
});
