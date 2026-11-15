import { HostScreen, type HostView } from '@/components/drops/host';

import type { MockState } from './gallery';

const names = ['Kit', 'Lou', 'Ana', 'Maya', 'Ravi', 'Jo', 'Ivy', 'Hal', 'Fay', 'Sam', 'Noor', 'Tess', 'Rio', 'Bea'];
const view = (count: number): HostView => ({
  dropId: 'demo-host',
  joinCode: 'KRQX',
  creatorName: 'Nova',
  entrants: names.slice(0, count).map((name) => ({ name })),
  entrantCount: count,
  bounty: { totalCents: 30000, winnerSlots: 3 },
});

export const HostStates: MockState[] = [
  { id: '20-host-empty', ref: 'host.md', section: 'Host', title: 'Host · code, nobody here yet', render: () => <HostScreen view={view(0)} /> },
  { id: '20-host-three', ref: 'host.md', section: 'Host', title: 'Host · 3 here (deal disabled)', render: () => <HostScreen view={view(3)} /> },
  { id: '20-host-ready', ref: 'host.md', section: 'Host', title: 'Host · 14 here, ready to deal', render: () => <HostScreen view={view(14)} /> },
];
