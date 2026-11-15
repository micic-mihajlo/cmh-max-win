import type { PuzzleInput } from '@/components/showcase/validate';

export const auroraWorld = {
  title: 'The Aurora Seed',
  setting: 'Kestrel Station',
  setup: 'Between 21:30 and 21:50, someone stole the Aurora Seed from the greenhouse.',
};

export const auroraPuzzle: PuzzleInput = {
  suspects: [
    { id: 'theo', name: 'Theo Marsh', job: 'Engineer', claim: 'At the docking ring.' },
    { id: 'priya', name: 'Priya Okafor', job: 'Comms officer', claim: 'In the lounge.' },
    { id: 'ines', name: 'Ines Vale', job: 'Botanist', claim: 'In the clean room.' },
    { id: 'jun', name: 'Jun Halloway', job: 'Galley chef', claim: 'In the galley, baking.' },
  ],
  pieces: [
    {
      id: 'camera',
      docLabel: 'CAMERA LOG',
      role: 'hacker',
      text: 'The dock camera shows Theo at the docking ring from 21:30 to 21:50. He never left.',
      places: ['theo'],
    },
    {
      id: 'witness',
      docLabel: 'STATEMENT',
      role: 'witness',
      text: 'Priya played Go with me in the lounge from 21:30 to 21:50. Neither of us got up.',
      places: ['priya'],
    },
    {
      id: 'scene',
      docLabel: 'SCENE NOTES',
      role: 'detective',
      text: 'Ines was locked inside the clean room from 21:30 to 21:50. Its only door never opened.',
      places: ['ines'],
    },
  ],
  answer: 'jun',
};

export const auroraBroken: PuzzleInput = {
  ...auroraPuzzle,
  pieces: auroraPuzzle.pieces.map((p) =>
    p.id === 'camera'
      ? { ...p, text: 'The dock camera shows Theo and Priya at the docking ring from 21:30 to 21:50. Jun was not on it.', places: ['theo', 'priya'] }
      : p,
  ),
};
