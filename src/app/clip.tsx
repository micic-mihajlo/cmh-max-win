import { useLocalSearchParams } from 'expo-router';

import { ClipPlayer } from '@/components/clip/clip-player';
import { parseJoinCode } from '@/lib/join-code';

// App Clip entry: /c/<CODE> links are rewritten here by +native-intent.
export default function ClipRoute() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  const parsed = code ? parseJoinCode(code) : null;
  return <ClipPlayer key={parsed ?? 'entry'} code={parsed} />;
}
