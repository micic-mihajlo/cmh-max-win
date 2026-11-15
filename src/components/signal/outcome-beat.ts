import { useEffect, useState } from 'react';

import type { RoomView } from '@/mocks/contract';

export const SEAL_BEAT_MS = 1200;

const seenSeq = new Map<string, number>();

// Every phone plays the same seal beat when a new check lands, driven by room.lastCheck rather than by a tap.
// The first seq a phone observes for a room (first load or rejoin) is recorded without playing it.
export function useOutcomeBeat(room: Pick<RoomView, 'code' | 'lastCheck'>) {
  const seq = room.lastCheck?.seq ?? 0;
  const [settled, setSettled] = useState(() => {
    if (!seenSeq.has(room.code)) seenSeq.set(room.code, seq);
    return seenSeq.get(room.code) ?? seq;
  });
  const sealing = seq > settled;
  useEffect(() => {
    if (!sealing) return;
    const t = setTimeout(() => {
      seenSeq.set(room.code, seq);
      setSettled(seq);
    }, SEAL_BEAT_MS);
    return () => clearTimeout(t);
  }, [sealing, seq, room.code]);
  return sealing ? 'sealing' : 'settled';
}
