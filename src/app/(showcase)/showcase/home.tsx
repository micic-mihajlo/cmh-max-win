import { FeedScreen } from '@/components/showcase/social/feed';
import { feedFixtures } from '@/mocks/showcase/feed-load';

const fx = feedFixtures;

export default function Home() {
  return <FeedScreen streamers={fx?.streamers ?? []} live={fx?.live ?? []} upcoming={fx?.upcoming ?? []} sample={!!fx} />;
}
