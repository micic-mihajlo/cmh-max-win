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
  startsAt: null,
  squads: null,
  solves: [],
});

const dealtAt = Date.now() - 90_000;
const squads = [0, 1, 2, 3].map((i) => ({ label: `Squad ${i + 11}`, members: names.slice(i * 3, i * 3 + 3) }));
const dealt = (solved: number): HostView => ({
  ...view(12),
  startsAt: dealtAt,
  squads,
  solves: ['Squad 13', 'Squad 11', 'Squad 14', 'Squad 12'].slice(0, solved).map((squadLabel, i) => ({ squadLabel, at: dealtAt + 2400 + 41_000 + i * 17_000 })),
});

export const HostStates: MockState[] = [
  { id: '20-host-empty', ref: 'host.md', section: 'Host', title: 'Host · code, nobody here yet', render: () => <HostScreen view={view(0)} /> },
  { id: '20-host-three', ref: 'host.md', section: 'Host', title: 'Host · 3 here (deal disabled)', render: () => <HostScreen view={view(3)} /> },
  { id: '20-host-ready', ref: 'host.md', section: 'Host', title: 'Host · 14 here, ready to deal', render: () => <HostScreen view={view(14)} /> },
  { id: '21-host-dealt', ref: 'host.md', section: 'Host', title: 'Host · squads dealt', render: () => <HostScreen view={dealt(0)} /> },
  { id: '21-host-race', ref: 'host.md', section: 'Host', title: 'Host · race, 2 of 3 bounty bars', render: () => <HostScreen view={dealt(2)} /> },
  { id: '21-host-race-full', ref: 'host.md', section: 'Host', title: 'Host · race, all slots taken', render: () => <HostScreen view={dealt(4)} /> },
];
