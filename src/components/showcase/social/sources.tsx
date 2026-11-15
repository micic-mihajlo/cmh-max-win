import { router, type Href } from 'expo-router';
import { useState } from 'react';

import { useFollowingFeed, useFollowStreamer, useRemindMe, useStreamerPage, useStreamers } from '@/hooks/use-feed';
import type { FeedUpcomingRow, StreamerCardView } from '@/lib/contract';
import { feedFixtures } from '@/mocks/showcase/feed-load';

import { inboxFromFeed } from './copy';
import { FeedScreen, streamerHref } from './feed';
import { TextAction } from './kit';
import { Toggle, NotificationSettingsScreen } from './notification-settings';
import { NotificationsScreen } from './notifications';
import { StreamerScreen } from './streamer';
import { StreamersScreen } from './streamers';

// Each screen has a live source (the feed hooks) and, in EXPO_PUBLIC_MOCKS=1 bundles only, a sample source.
const fx = feedFixtures;
const openDrop = (dropId: string) => router.push({ pathname: '/drop/[id]', params: { id: dropId } } as unknown as Href);

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
  return <LiveFeed />;
}

function LiveFeed() {
  return <FeedScreen view={useFollowingFeed()} Remind={LiveRemind} onOpenLive={(l) => openDrop(l.dropId)} />;
}

export function Streamer({ id }: { id: string | null }) {
  if (fx) return <SampleStreamer id={id ?? 'nova'} />;
  return <LiveStreamer id={id} />;
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
  return <StreamerScreen page={id ? page : null} onFollow={() => void follow()} onUnfollow={() => void unfollow()} onOpenLive={(l) => openDrop(l.dropId)} />;
}

export function Notifications() {
  if (fx) return <NotificationsScreen items={inboxFromFeed(fx.feed)} onOpen={() => {}} sample />;
  return <LiveNotifications />;
}

function LiveNotifications() {
  const feed = useFollowingFeed();
  return <NotificationsScreen key={feed ? 'ready' : 'loading'} items={feed ? inboxFromFeed(feed) : []} onOpen={(n) => openDrop(n.dropId)} />;
}

export function NotificationSettings() {
  if (fx) return <NotificationSettingsScreen streamers={fx.feed.following} FollowToggle={SampleFollowToggle} sample />;
  return <LiveNotificationSettings />;
}

function LiveNotificationSettings() {
  return <NotificationSettingsScreen streamers={useFollowingFeed()?.following} FollowToggle={LiveFollowToggle} />;
}

export function Streamers() {
  if (fx) return <StreamersScreen streamers={fx.streamers} sample />;
  return <LiveStreamers />;
}

function LiveStreamers() {
  return <StreamersScreen streamers={useStreamers()} />;
}
