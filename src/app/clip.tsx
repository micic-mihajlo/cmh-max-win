import { Redirect, router, useLocalSearchParams } from 'expo-router';

import { ClipCodeEntry } from '@/components/clip/code-entry';
import { parseJoinCode } from '@/lib/join-code';

// App Clip home: challenge links open /c/<CODE> directly; without one the viewer types the code here.
export default function ClipRoute() {
  const params = useLocalSearchParams<{ code?: string }>();
  const code = params.code ? parseJoinCode(params.code) : null;
  if (code) return <Redirect href={{ pathname: '/c/[code]', params: { code } }} />;
  return <ClipCodeEntry onCode={(next) => router.replace({ pathname: '/c/[code]', params: { code: next } })} />;
}
