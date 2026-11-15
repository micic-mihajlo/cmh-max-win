import { useLocalSearchParams } from 'expo-router';
import { Platform } from 'react-native';

import { JoinChooser } from '@/components/drops/join-chooser';
import { JoinFlow } from '@/components/drops/join-flow';
import { parseJoinCode } from '@/lib/join-code';

// The host QR's target. In the app it is the join itself, name gate included; on the web it offers the app first.
export default function JoinCodeLink() {
  const params = useLocalSearchParams<{ code: string }>();
  const code = parseJoinCode(params.code ?? '');
  if (Platform.OS !== 'web') return <JoinFlow initial={code} />;
  return <JoinChooser code={code ?? (params.code ?? '').toUpperCase()} />;
}
