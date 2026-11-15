import type { FeedNotification, Streamer } from '@/mocks/showcase/feed';

export function notificationCopy(n: FeedNotification, s: Streamer) {
  if (n.kind === 'live') return { title: `${s.name} is live · ${n.challenge}`, body: `Join with ${n.code}.` };
  return { title: `${s.name}'s room opens in ${n.minutes} minutes`, body: 'Your squad is waiting.' };
}
