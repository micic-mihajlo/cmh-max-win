import { NotificationSettingsScreen } from '@/components/showcase/social/notification-settings';
import { feedFixtures } from '@/mocks/showcase/feed-load';

const fx = feedFixtures;

export default function NotificationSettings() {
  return <NotificationSettingsScreen streamers={fx?.streamers ?? []} sample={!!fx} />;
}
