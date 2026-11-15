import type { SuspectId } from '@/mocks/contract';

// Public case content: the intro and the suspect directory are the same on every phone.
// Dossiers, nudges and the reveal never live here; they come from the server (fixtures in src/mocks).

export const Case01 = {
  number: '01',
  title: 'The Aurora Seed',
  location: 'Kestrel Station',
  logline: 'Kestrel Station. Ten minutes until the shuttle docks.',
  intro: [
    'Kestrel Station, 21:50. The greenhouse alarm goes off.',
    'The Aurora Seed, the last viable seed of a lost alpine flower bound for a vault on Earth, is gone from its case.',
    'The 21:30 inventory check logged it safe. The supply shuttle docks in ten minutes, and whoever took it may be on it.',
  ],
  question: 'Who took the Aurora Seed?',
  rule: 'Each of you can clear someone. The thief is the one nobody can clear.',
} as const;

export type Suspect = { id: SuspectId; name: string; first: string; job: string; pronouns: string; claim: string; walk: string };

export const Suspects: Suspect[] = [
  { id: 'theo', name: 'Theo Marsh', first: 'Theo', job: 'Engineer', pronouns: 'he/him', claim: 'At the docking ring, testing the shuttle seal.', walk: '6 min' },
  { id: 'priya', name: 'Priya Okafor', first: 'Priya', job: 'Comms officer', pronouns: 'she/her', claim: 'Off duty in the lounge.', walk: '3 min' },
  { id: 'ines', name: 'Ines Vale', first: 'Ines', job: 'Botanist', pronouns: 'she/her', claim: 'In the clean room, prepping samples.', walk: '2 min' },
  { id: 'jun', name: 'Jun Halloway', first: 'Jun', job: 'Galley chef', pronouns: 'she/her', claim: 'In the galley, proving bread for tomorrow.', walk: '2 min' },
];

export const suspectById = (id: SuspectId) => Suspects.find((s) => s.id === id)!;

