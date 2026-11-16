import { useQuery } from 'convex-helpers/react/cache/hooks';

import { HintRow } from './hint-row';
import { ThemedText } from './themed-text';

import { api } from '@convex/_generated/api';
import { convex } from '@/lib/convex';

function ConnectedStatus() {
  const count = useQuery(api.pings.count);
  return (
    <HintRow
      title="Convex"
      hint={<ThemedText type="code">{count === undefined ? 'connecting…' : `${count} pings`}</ThemedText>}
    />
  );
}

export function ConvexStatus() {
  if (!convex) {
    return <HintRow title="Convex" hint={<ThemedText type="code">EXPO_PUBLIC_CONVEX_URL unset</ThemedText>} />;
  }
  return <ConnectedStatus />;
}
