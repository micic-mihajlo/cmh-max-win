import { Redirect, useLocalSearchParams } from 'expo-router';
import { Platform } from 'react-native';

import { JoinChooser } from '@/components/drops/join-chooser';
import { parseJoinCode } from '@/lib/join-code';

// The host QR's target. In the app it goes straight to the join screen; on the web it offers the app first.
export default function JoinCodeLink() {
  const params = useLocalSearchParams<{ code: string }>();
  const code = parseJoinCode(params.code ?? '') ?? (params.code ?? '').toUpperCase();
  if (Platform.OS !== 'web') return <Redirect href={{ pathname: '/join', params: { code } }} />;
  return <JoinChooser code={code} />;
}
