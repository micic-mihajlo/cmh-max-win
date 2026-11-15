import { api } from '@convex/_generated/api';
import { useQuery } from 'convex/react';

import { useDeviceToken } from '@/hooks/use-device-token';
import { useDrop } from '@/hooks/use-drops';
import type { DropTemplateId } from '@/lib/contract';

// The drop behind the cover's active room, so the rejoin banner and route match the drop's template.
// Reads the room without presence: the cover shouldn't mark the player as back in the squad.
export function useActiveDrop(code: string | null): { dropId: string; template?: DropTemplateId } | null | undefined {
  const deviceToken = useDeviceToken();
  const room = useQuery(api.signal.room, deviceToken && code ? { deviceToken, code } : 'skip');
  const drop = useDrop(room?.drop?.dropId ?? null);
  if (!code) return null;
  if (room === undefined || (room?.drop && drop === undefined)) return undefined;
  if (!room?.drop || !drop) return null;
  return { dropId: room.drop.dropId, template: drop.template };
}
