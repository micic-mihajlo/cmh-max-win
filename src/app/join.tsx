import { useLocalSearchParams } from 'expo-router';

import { JoinFlow } from '@/components/drops/join-flow';
import { parseJoinCode } from '@/lib/join-code';

export default function JoinRoute() {
  const params = useLocalSearchParams<{ code?: string }>();
  return <JoinFlow initial={params.code ? parseJoinCode(params.code) : null} />;
}
