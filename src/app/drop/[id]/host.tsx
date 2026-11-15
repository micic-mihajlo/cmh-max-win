import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { CreatorSetupScreen } from '@/components/drops/creator-setup';
import { useDrop } from '@/hooks/use-drops';

// Nova's creator screen for a drop that already exists (creating one is server-only): the prefilled card, then
// after Open drop the live card with the real entrant count.
export default function HostRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const drop = useDrop(id);
  const [open, setOpen] = useState(false);
  const card = { title: drop?.title ?? 'The Aurora Seed', totalCents: drop?.bounty.totalCents ?? 30000, winnerSlots: drop?.bounty.winnerSlots ?? 3 };
  return (
    <CreatorSetupScreen
      drop={card}
      live={open && drop ? { entrantCount: drop.entrantCount, shareUrl: `cmhmaxwin://drop/${id}` } : undefined}
      onOpen={() => setOpen(true)}
    />
  );
}
