import { Redirect, useLocalSearchParams } from "expo-router";

import { StudioChallenge } from "@/components/studio/challenge";
import { sampleStudio } from "@/components/studio/sample";

export default function StudioChallengeRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return sampleStudio ? (
    <Redirect href="/studio" />
  ) : (
    <StudioChallenge id={id} />
  );
}
