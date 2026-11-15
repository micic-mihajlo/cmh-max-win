import { useLocalSearchParams } from 'expo-router';

import { LiveCreator } from '@/components/challenge/creator/live-creator';
import { Streamer } from '@/components/showcase/social/sources';
import { LiveBoundary } from '@/components/showcase/social/live-boundary';

const mocks = process.env.EXPO_PUBLIC_MOCKS === '1';

export default function Creator() {
  const { id, handle } = useLocalSearchParams<{ id?: string; handle?: string }>();
  if (handle && !mocks)
    return (
      <LiveBoundary>
        <LiveCreator key={handle} handle={handle} />
      </LiveBoundary>
    );
  return <Streamer key={id} id={id ?? null} />;
}
