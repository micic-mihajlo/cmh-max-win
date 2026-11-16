import { Redirect, useLocalSearchParams } from 'expo-router';
import { Platform } from 'react-native';

import { JoinChooser } from '@/components/drops/join-chooser';
import { JoinFlow } from '@/components/drops/join-flow';
import { useDropByCode } from '@/hooks/use-drops';
import { parseJoinCode } from '@/lib/join-code';

// The host QR's target. In the app it is the join itself, name gate included; on the web it offers the app first.
// A device already seated in that drop skips both and goes back to its squad.
export default function JoinCodeLink() {
  const params = useLocalSearchParams<{ code: string }>();
  const code = parseJoinCode(params.code ?? '');
  const drop = useDropByCode(code);
  if (drop?.me.entered) return <Redirect href={{ pathname: '/drop/[id]', params: { id: drop.dropId } }} />;
  if (Platform.OS !== 'web') return <JoinFlow initial={code} />;
  return <JoinChooser code={code ?? (params.code ?? '').toUpperCase()} />;
}
