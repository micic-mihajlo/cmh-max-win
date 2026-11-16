import { api } from '@convex/_generated/api';
import { useMutation } from 'convex/react';
import { useKeepAwake } from 'expo-keep-awake';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { HostScreen } from '@/components/drops/host';
import { HostControls } from '@/components/drops/host-controls';
import { readMyRooms } from '@/components/drops/my-rooms';
import { ClosedScreen } from '@/components/screens/closed';
import { Arrive, Pending } from '@/components/signal/backdrop';
import { Toast } from '@/components/signal/primitives';
import { useDealSquads, useHostAwardSquads, useHostEndDrop, useHostView } from '@/hooks/use-drops';
import { useMyHostedDrops } from '@/hooks/use-host-account';
import { usePlayerName } from '@/hooks/use-player-name';
import { getDeviceToken } from '@/lib/device';
import { toSignalError } from '@/lib/signal-error';

export default function HostRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  useKeepAwake();
  const view = useHostView(id);
  const { name } = usePlayerName();
  const deal = useDealSquads(id);
  const endDrop = useHostEndDrop(id);
  const awardSquads = useHostAwardSquads(id);
  const endAny = useMutation(api.drops.hostEndDrop);
  const hosted = useMyHostedDrops();
  const resetRooms = async () => {
    const deviceToken = await getDeviceToken();
    const ids = new Set([...(await readMyRooms()), ...(hosted ?? []).filter((d) => d.status === 'live').map((d) => d.dropId)]);
    await Promise.all([...ids].map((dropId) => endAny({ deviceToken, dropId }).catch(() => {})));
  };
  const [dealing, setDealing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [minToDeal, setMinToDeal] = useState<number>();
  if (view === undefined) return <Pending />;
  if (view === null) return <ClosedScreen code={id} />;
  return (
    <Arrive>
      <HostScreen
        view={view}
        hostName={name ?? 'Danny'}
        dealing={dealing}
        minToDeal={minToDeal}
        controls={<HostControls view={view} onEnd={endDrop} onAward={awardSquads} onResetRooms={resetRooms} />}
        onDeal={async () => {
          setDealing(true);
          setError(null);
          try {
            await deal();
          } catch (e) {
            const err = toSignalError(e);
            const least = err?.code === 'NOT_ENOUGH_PLAYERS' ? Number(err.message.match(/at least (\d+)/)?.[1]) : NaN;
            if (least) setMinToDeal(least);
            else setError(err?.code === 'NOT_ENOUGH_PLAYERS' ? 'Not enough players to deal yet.' : 'That didn’t go through. Try again.');
          } finally {
            setDealing(false);
          }
        }}
      />
      {error ? <Toast text={error} tone="warn" /> : null}
    </Arrive>
  );
}
