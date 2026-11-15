import { router } from 'expo-router';
import { useState } from 'react';

import { CreatorSetupScreen } from '@/components/drops/creator-setup';
import { useHostDrop } from '@/hooks/use-drops';

// Open a hosted drop from this device; it becomes the big shared screen.
export default function HostNewRoute() {
  const hostDrop = useHostDrop();
  const [opening, setOpening] = useState(false);
  return (
    <CreatorSetupScreen
      drop={{ title: 'The Aurora Seed', totalCents: 30000, winnerSlots: 3 }}
      onOpen={
        opening
          ? undefined
          : async () => {
              setOpening(true);
              try {
                const { dropId } = await hostDrop({ title: 'The Aurora Seed', totalCents: 30000, winnerSlots: 3 });
                router.replace({ pathname: '/drop/[id]/host', params: { id: dropId } });
              } finally {
                setOpening(false);
              }
            }
      }
    />
  );
}
