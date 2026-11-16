import { router, type Href } from 'expo-router';
import { useEffect, useState } from 'react';

import { useFollowingFeed, useFollowStreamer, useRegisterPushToken, useRemindMe, useStreamerPage, useStreamers } from '@/hooks/use-feed';
import type { FeedUpcomingRow, StreamerCardView } from '@/lib/contract';
import { feedFixtures } from '@/mocks/showcase/feed-load';

import { inboxFromFeed } from './copy';
import { FeedScreen, streamerHref } from './feed';
import { TextAction } from './kit';
import { LiveBoundary } from './live-boundary';
import { Toggle, NotificationSettingsScreen } from './notification-settings';
import { NotificationsScreen } from './notifications';
import { existingPushToken, requestPushToken } from './push';
import { StreamerScreen } from './streamer';
import { StreamersScreen } from './streamers';

// Each screen has a live source (the feed hooks) and, in EXPO_PUBLIC_MOCKS=1 bundles only, a sample source.
const fx = feedFixtures;
const openDrop = (dropId: string) => router.push({ pathname: '/drop/[id]', params: { id: dropId } } as unknown as Href);
const openLive = (l: { dropId: string; streamerId: string; inProgress?: boolean; dropStatus?: string }) =>
  l.inProgress || l.dropStatus === 'live' ? router.push(streamerHref(l.streamerId)) : openDrop(l.dropId);

function RemindLabel({ on, onPress }: { on: boolean; onPress: () => void }) {
  return <TextAction title={on ? '✓ Reminded' : 'Remind me'} muted={on} onPress={onPress} />;
}

function LiveRemind({ row }: { row: FeedUpcomingRow }) {
  const { remind, cancel } = useRemindMe(row.dropId);
  return <RemindLabel on={row.reminded} onPress={() => void (row.reminded ? cancel() : remind())} />;
}

function SampleRemind({ row }: { row: FeedUpcomingRow }) {
  const [on, setOn] = useState(row.reminded);
  return <RemindLabel on={on} onPress={() => setOn(!on)} />;
}

function LiveFollowToggle({ streamer }: { streamer: StreamerCardView }) {
  const { follow, unfollow } = useFollowStreamer(streamer.streamerId);
  return <Toggle label={`${streamer.name} going live`} value={streamer.following} onChange={(v) => void (v ? follow() : unfollow())} />;
}

function SampleFollowToggle({ streamer }: { streamer: StreamerCardView }) {
  const [on, setOn] = useState(streamer.following);
  return <Toggle label={`${streamer.name} going live`} value={on} onChange={setOn} />;
}

export function Feed() {
  if (fx) return <FeedScreen view={fx.feed} Remind={SampleRemind} onOpenLive={(l) => router.push(streamerHref(l.streamerId))} sample />;
  return (
    <LiveBoundary title="Following">
      <LiveFeed />
    </LiveBoundary>
  );
}

function LiveFeed() {
  const register = useRegisterPushToken();
  useEffect(() => {
    existingPushToken()
      .then((t) => t && register(t))
      .catch(() => {});
  }, [register]);
  return <FeedScreen view={useFollowingFeed()} Remind={LiveRemind} onOpenLive={openLive} />;
}

export function Streamer({ id }: { id: string | null }) {
  if (fx) return <SampleStreamer id={id ?? 'danny'} />;
  return (
    <LiveBoundary>
      <LiveStreamer id={id} />
    </LiveBoundary>
  );
}

function SampleStreamer({ id }: { id: string }) {
  const page = fx!.streamerPage(id);
  const [following, setFollowing] = useState(false);
  return (
    <StreamerScreen
      page={page && { ...page, following }}
      onFollow={() => setFollowing(true)}
      onUnfollow={() => setFollowing(false)}
      onOpenLive={() => {}}
      sample
    />
  );
}

function LiveStreamer({ id }: { id: string | null }) {
  const page = useStreamerPage(id);
  const { follow, unfollow } = useFollowStreamer(id ?? '');
  const register = useRegisterPushToken();
  const turnOn = () =>
    requestPushToken()
      .then((t) => t && register(t))
      .catch(() => {});
  return (
    <StreamerScreen
      page={id ? page : null}
      onFollow={() => void follow()}
      onUnfollow={() => void unfollow()}
      onOpenLive={(l) => openDrop(l.dropId)}
      onTurnOnPings={() => void turnOn()}
    />
  );
}

export function Notifications() {
  if (fx) return <NotificationsScreen items={inboxFromFeed(fx.feed)} onOpen={() => {}} sample />;
  return (
    <LiveBoundary title="Notifications">
      <LiveNotifications />
    </LiveBoundary>
  );
}

function LiveNotifications() {
  const feed = useFollowingFeed();
  return <NotificationsScreen key={feed ? 'ready' : 'loading'} items={feed ? inboxFromFeed(feed) : []} onOpen={openLive} />;
}

export function NotificationSettings() {
  if (fx) return <NotificationSettingsScreen streamers={fx.feed.following} FollowToggle={SampleFollowToggle} sample />;
  return (
    <LiveBoundary title="Notifications">
      <LiveNotificationSettings />
    </LiveBoundary>
  );
}

function LiveNotificationSettings() {
  return <NotificationSettingsScreen streamers={useFollowingFeed()?.following} FollowToggle={LiveFollowToggle} />;
}

export function Streamers() {
  if (fx) return <StreamersScreen streamers={fx.streamers} sample />;
  return (
    <LiveBoundary title="Streamers">
      <LiveStreamers />
    </LiveBoundary>
  );
}

function LiveStreamers() {
  return <StreamersScreen streamers={useStreamers()} />;
}
