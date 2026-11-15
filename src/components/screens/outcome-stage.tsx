import type { ReactNode } from 'react';

import { AgreementScreen } from '@/components/screens/agreement';
import { useOutcomeBeat } from '@/components/signal/outcome-beat';
import type { RoomView } from '@/lib/contract';

export function OutcomeStage({ room, children }: { room: RoomView; children: ReactNode }) {
  const beat = useOutcomeBeat(room);
  return beat === 'sealing' ? <AgreementScreen room={room} phase="checking" /> : children;
}
