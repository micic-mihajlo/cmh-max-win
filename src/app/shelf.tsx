import { router, useLocalSearchParams } from 'expo-router';

import { ShelfScreen } from '@/components/screens/shelf';
import { useSeasonPack } from '@/hooks/use-season-pack';

// Real Whop card when the pack hook answers; the concept card is a separate component kept for the cut.
export default function Shelf() {
  const { attempts, crew } = useLocalSearchParams<{ attempts?: string; crew?: string }>();
  const { view, buy } = useSeasonPack();
  return (
    <ShelfScreen
      attempts={Number(attempts ?? 1)}
      crew={crew ? crew.split(',') : []}
      pack={view ?? { pack: 'season01', state: 'locked', real: true, environment: null, error: null }}
      onBuy={buy}
      onNewCase={() => router.replace('/')}
    />
  );
}
