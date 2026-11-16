import { useLocalSearchParams } from 'expo-router';

import { ChallengePlayer } from '@/components/challenge/player/player';

export default function ChallengeCodeRoute() {
  const { code } = useLocalSearchParams<{ code: string }>();
  return <ChallengePlayer code={code ?? ''} />;
}
