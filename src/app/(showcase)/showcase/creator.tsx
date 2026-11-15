import { useLocalSearchParams } from 'expo-router';

import { Streamer } from '@/components/showcase/social/sources';

export default function Creator() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  return <Streamer key={id} id={id ?? null} />;
}
