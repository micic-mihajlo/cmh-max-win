import { router } from 'expo-router';
import { useState } from 'react';

import { CreatorSetupScreen, POTS } from '@/components/drops/creator-setup';
import { NameEntryScreen } from '@/components/screens/name-entry';
import { useHostDrop } from '@/hooks/use-drops';
import { usePlayerName } from '@/hooks/use-player-name';
import { toSignalError } from '@/lib/signal-error';

const TITLE = 'The Aurora Seed';
const WINNER_SLOTS = 3;

// Open a hosted drop from this device; it becomes the big shared screen. The server owns the bounty from here on.
export default function HostNewRoute() {
  const hostDrop = useHostDrop();
  const { name, save } = usePlayerName();
  const [draft, setDraft] = useState('');
  const [pot, setPot] = useState(POTS[0]);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (name === undefined) return null;
  if (name === null) return <NameEntryScreen name={draft} onChangeName={setDraft} onContinue={() => save(draft.trim())} />;
  return (
    <CreatorSetupScreen
      drop={{ title: TITLE, totalCents: pot.totalCents, winnerSlots: WINNER_SLOTS }}
      pot={pot}
      onPot={(p) => {
        setPot(p);
        setError(null);
      }}
      error={error}
      onOpen={
        opening
          ? undefined
          : async () => {
              setOpening(true);
              setError(null);
              try {
                const { dropId } = await hostDrop({ title: TITLE, totalCents: pot.totalCents, winnerSlots: WINNER_SLOTS, creatorName: name });
                router.replace({ pathname: '/drop/[id]/host', params: { id: dropId } });
              } catch (e) {
                setError(toSignalError(e)?.message ?? 'That didn’t go through. Try again.');
              } finally {
                setOpening(false);
              }
            }
      }
    />
  );
}
