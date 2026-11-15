import { NotificationsScreen } from '@/components/showcase/social/notifications';
import { feedFixtures } from '@/mocks/showcase/feed-load';

const fx = feedFixtures;

export default function Notifications() {
  return <NotificationsScreen streamers={fx?.streamers ?? []} items={fx?.notifications ?? []} sample={!!fx} />;
}
