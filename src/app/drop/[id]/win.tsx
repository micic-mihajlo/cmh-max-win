import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { BountyResultScreen } from '@/components/drops/bounty-result';
import { Arrive, Pending } from '@/components/signal/backdrop';
import { useDrop, useMyAward } from '@/hooks/use-drops';
import { useFollowStreamer, useStreamerForDrop } from '@/hooks/use-feed';
import { useLinkForClaim } from '@/hooks/use-whop-account';
import { useRoom } from '@/hooks/use-signal';

export default function WinRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const drop = useDrop(id);
  const squad = drop?.me.squad ?? null;
  const award = useMyAward(squad?.code ?? null);
  const room = useRoom(squad?.code ?? null);
  const link = useLinkForClaim(squad?.code ?? null, `/drop/${id}/win`);
  const [signingIn, setSigningIn] = useState(false);
  const streamer = useStreamerForDrop(drop?.template ? id : null);
  const { follow } = useFollowStreamer(streamer?.streamerId ?? '');
  const [followed, setFollowed] = useState(false);
  if (drop === undefined || award === undefined || room === undefined) {
    return <Pending />;
  }
  if (!drop || !squad || !award || !room) return <Redirect href={{ pathname: '/drop/[id]/race', params: { id } }} />;
  return (
    <Arrive>
      <BountyResultScreen
        award={award}
        bounty={drop.bounty}
        signingIn={signingIn}
        host={
          streamer
            ? {
                name: streamer.name,
                following: streamer.following || followed,
                onFollow: () => {
                  setFollowed(true);
                  follow().catch(() => setFollowed(false));
                },
              }
            : undefined
        }
        on={{
          onSignIn: async () => {
            setSigningIn(true);
            try {
              await link();
            } finally {
              setSigningIn(false);
            }
          },
          onContinue: () => (drop.template ? router.replace({ pathname: '/drop/[id]/race', params: { id } }) : router.push({ pathname: '/room/[code]', params: { code: squad.code, reveal: '1' } })),
        }}
      />
    </Arrive>
  );
}
