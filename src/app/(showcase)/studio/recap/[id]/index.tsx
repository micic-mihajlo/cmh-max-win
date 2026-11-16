import { useLocalSearchParams } from 'expo-router';

import { RecapScreen } from '@/components/challenge/recap/recap-screen';
import { useChallengeRecap } from '@/hooks/use-challenges';
import { useChallengeGrowth } from '@/hooks/use-creator-growth';

export default function Recap() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <RecapScreen recap={useChallengeRecap(id ?? null)} growth={useChallengeGrowth(id ?? null)} />;
}
