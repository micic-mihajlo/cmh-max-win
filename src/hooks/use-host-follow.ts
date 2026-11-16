import { useState } from 'react';

import type { HostFollowProps } from '@/components/drops/host-follow';
import { useFollowStreamer, useRemindMe, useStreamerForDrop, useStreamerPage } from '@/hooks/use-feed';

// The follow-the-host prompt for a hosted drop's end screens; undefined when the host has no streamer profile.
export function useHostFollow(dropId: string | null): HostFollowProps | undefined {
  const streamer = useStreamerForDrop(dropId);
  const page = useStreamerPage(streamer?.streamerId ?? null);
  const { follow } = useFollowStreamer(streamer?.streamerId ?? '');
  const nextDrop = page?.nextDrop ?? null;
  const { remind } = useRemindMe(nextDrop?.dropId ?? '');
  const [followed, setFollowed] = useState(false);
  const [reminded, setReminded] = useState<boolean | null>(null);
  if (!streamer) return undefined;
  return {
    name: streamer.name,
    following: streamer.following || followed,
    onFollow: () => {
      setFollowed(true);
      follow().catch(() => setFollowed(false));
    },
    next: nextDrop
      ? {
          startsAt: nextDrop.startsAt,
          reminded: reminded ?? nextDrop.reminded,
          onRemind: () => {
            setReminded(true);
            remind().catch(() => setReminded(null));
          },
        }
      : null,
  };
}
