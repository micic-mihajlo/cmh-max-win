import { useLocalSearchParams } from "expo-router";

import { HostConsole } from "@/components/challenge/host/console";

export default function HostConsoleRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <HostConsole challengeId={id ?? null} />;
}
