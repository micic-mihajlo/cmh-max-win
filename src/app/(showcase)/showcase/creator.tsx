import { useLocalSearchParams } from 'expo-router';

import { StreamerScreen } from '@/components/showcase/social/streamer';
import { feedFixtures } from '@/mocks/showcase/feed-load';

const fx = feedFixtures;

export default function Creator() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const streamer = fx?.streamers.find((s) => s.id === (id ?? 'nova')) ?? null;
  return <StreamerScreen key={streamer?.id} streamer={streamer} sample={!!fx} />;
}
