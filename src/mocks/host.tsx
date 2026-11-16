import { HostScreen } from '@/components/drops/host';
import { HostControls } from '@/components/drops/host-controls';
import type { HostView } from '@/lib/contract';

import type { MockState } from './gallery';

const names = ['Chris', 'Sarah', 'Jen', 'Ashley', 'Ryan', 'Josh', 'Megan', 'Hal', 'Fay', 'Sam', 'Noor', 'Tess', 'Rio', 'Bea'];
const view = (count: number): HostView => ({
  dropId: 'demo-host',
  title: 'The Aurora Seed',
  joinCode: 'KRQX',
  status: 'scheduled',
  bounty: { totalCents: 30000, currency: 'usd', winnerSlots: 3, perSquadCents: 10000, mode: 'concept' },
  entrantCount: count,
  entrants: names.slice(0, count).map((name, i) => ({ name, joinedAt: i })),
  squads: [],
  solves: [],
});

const order = ['Squad 3', 'Squad 1', 'Squad 4', 'Squad 2'];
const dealt = (solved: number): HostView => {
  const solves = order.slice(0, solved).map((squadLabel, i) => ({ place: i + 1, squadLabel, solvedAt: i, solveMs: 41_000 + i * 17_000, isWinner: i < 3 }));
  return {
    ...view(12),
    status: 'live',
    squads: [0, 1, 2, 3].map((i) => {
      const s = solves.find((x) => x.squadLabel === `Squad ${i + 1}`);
      return {
        squadLabel: `Squad ${i + 1}`,
        squadId: `mock-squad-${i + 1}`,
        memberNames: names.slice(i * 3, i * 3 + 3),
        status: s ? (s.isWinner ? 'winner' : 'solved') : 'solving',
        rank: s?.place ?? null,
      };
    }),
    solves,
  };
};

const first = [
  'Chris',
  'Sarah',
  'Jen',
  'Ashley',
  'Ryan',
  'Josh',
  'Megan',
  'Hal',
  'Fay',
  'Sam',
  'Noor',
  'Tess',
  'Rio',
  'Bea',
  'Ada',
  'Eli',
  'Zoe',
  'Max',
  'Uma',
  'Leo',
];
const crowd = Array.from({ length: 100 }, (_, i) =>
  i < first.length ? first[i] : `${first[i % first.length]} ${String.fromCharCode(65 + Math.floor(i / first.length))}.`,
);
const sizes = Array.from({ length: 34 }, (_, i) => (i < 32 ? 3 : 2));
const starts = sizes.map((_, i) => sizes.slice(0, i).reduce((a, b) => a + b, 0));
const scale = (solved: number): HostView => {
  const solves = Array.from({ length: solved }, (_, i) => ({
    place: i + 1,
    squadLabel: `Squad ${((i * 7) % 34) + 1}`,
    solvedAt: i,
    solveMs: 38_000 + i * 9_000,
    isWinner: i < 3,
  }));
  return {
    ...view(0),
    entrantCount: 100,
    entrants: crowd.map((name, i) => ({ name, joinedAt: i })),
    status: 'live',
    squads: sizes.map((n, i) => {
      const s = solves.find((x) => x.squadLabel === `Squad ${i + 1}`);
      return {
        squadLabel: `Squad ${i + 1}`,
        memberNames: crowd.slice(starts[i], starts[i] + n),
        status: s ? (s.isWinner ? 'winner' : 'solved') : 'solving',
        rank: s?.place ?? null,
      };
    }),
    solves,
  };
};

export const HostStates: MockState[] = [
  {
    id: '22-host-100',
    ref: 'scale',
    section: 'Scale',
    title: 'Host · 100 here',
    render: () => <HostScreen hostName="Danny" view={{ ...scale(0), status: 'scheduled', squads: [] }} />,
  },
  { id: '22-host-squads-34', ref: 'scale', section: 'Scale', title: 'Host · 34 squads dealt', render: () => <HostScreen hostName="Danny" view={scale(0)} /> },
  {
    id: '22-host-race-34',
    ref: 'scale',
    section: 'Scale',
    title: 'Host · 34 squads, 3 winners + 2 solved',
    render: () => <HostScreen hostName="Danny" view={scale(5)} />,
  },
  {
    id: '21-host-controls',
    ref: 'host controls',
    section: 'Host',
    title: 'Host · race with Host controls',
    render: () => <HostScreen hostName="Danny" view={dealt(1)} controls={<HostControls view={dealt(1)} onEnd={async () => {}} onAward={async () => {}} />} />,
  },
  { id: '20-host-empty', ref: 'host.md', section: 'Host', title: 'Host · code, nobody here yet', render: () => <HostScreen hostName="Danny" view={view(0)} /> },
  {
    id: '20-host-min-20',
    ref: 'CAP-86',
    section: 'Host',
    title: 'Host · 12 of 20 needed',
    render: () => <HostScreen hostName="Danny" view={view(12)} minToDeal={20} />,
  },
  {
    id: '20-host-three',
    ref: 'host.md',
    section: 'Host',
    title: 'Host · 3 here (deal disabled)',
    render: () => <HostScreen hostName="Danny" view={view(3)} />,
  },
  {
    id: '20-host-ready',
    ref: 'host.md',
    section: 'Host',
    title: 'Host · 14 here, ready to deal',
    render: () => <HostScreen hostName="Danny" view={view(14)} />,
  },
  { id: '21-host-dealt', ref: 'host.md', section: 'Host', title: 'Host · squads dealt', render: () => <HostScreen hostName="Danny" view={dealt(0)} /> },
  {
    id: '21-host-race',
    ref: 'host.md',
    section: 'Host',
    title: 'Host · race, 2 of 3 bounty bars',
    render: () => <HostScreen hostName="Danny" view={dealt(2)} />,
  },
  {
    id: '21-host-race-real',
    ref: 'host.md',
    section: 'Host',
    title: 'Host · real $3 pot, award committed',
    render: () => (
      <HostScreen
        hostName="Danny"
        view={{
          ...dealt(1),
          bounty: { totalCents: 300, currency: 'usd', winnerSlots: 1, perSquadCents: 300, mode: 'transfer' },
          solves: dealt(1).solves.map((s) => ({ ...s, isWinner: true })),
        }}
      />
    ),
  },
  {
    id: '21-host-race-full',
    ref: 'host.md',
    section: 'Host',
    title: 'Host · race, all slots taken',
    render: () => <HostScreen hostName="Danny" view={dealt(4)} />,
  },
];
