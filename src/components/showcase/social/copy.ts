import type { FeedLiveRow, FeedUpcomingRow, FollowingFeedView } from '@/lib/contract';

export type InboxItem = { id: string; kind: 'live' | 'starting'; streamerName: string; challenge: string; joinCode: string; dropId: string; when: string };

export function notificationCopy(n: InboxItem) {
  if (n.kind === 'live') return { title: `${n.streamerName} is live · ${n.challenge}`, body: `Join with ${n.joinCode}.` };
  return { title: `${n.streamerName}'s room opens in 2 minutes`, body: 'Your squad is waiting.' };
}

export function dropTime(ms: number, now: number) {
  const d = new Date(ms);
  const day = d.toDateString() === new Date(now).toDateString() ? 'Today' : d.toLocaleDateString('en-US', { weekday: 'long' });
  const h = d.getHours();
  const m = d.getMinutes();
  return `${day} ${h % 12 || 12}${m ? `:${String(m).padStart(2, '0')}` : ''} ${h < 12 ? 'am' : 'pm'}`;
}

export function ago(ms: number, now: number) {
  const min = Math.max(0, Math.round((now - ms) / 60_000));
  if (min < 1) return 'Now';
  if (min < 60) return `${min} min ago`;
  return `${Math.round(min / 60)} h ago`;
}

export const followers = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k` : String(n));

const STARTING_WINDOW = 10 * 60_000;

// The inbox is derived from the feed: streamers you follow who are live now, and reminded drops about to open.
export function inboxFromFeed(feed: FollowingFeedView): InboxItem[] {
  const live = feed.live.map((l: FeedLiveRow) => ({
    id: `live-${l.dropId}`,
    kind: 'live' as const,
    streamerName: l.streamerName,
    challenge: l.title,
    joinCode: l.joinCode,
    dropId: l.dropId,
    when: ago(l.liveSince, feed.serverNow),
  }));
  const starting = feed.upcoming
    .filter((u: FeedUpcomingRow) => u.reminded && u.startsAt - feed.serverNow <= STARTING_WINDOW)
    .map((u) => ({
      id: `starting-${u.dropId}`,
      kind: 'starting' as const,
      streamerName: u.streamerName,
      challenge: u.title,
      joinCode: u.joinCode,
      dropId: u.dropId,
      when: 'Now',
    }));
  return [...starting, ...live];
}
