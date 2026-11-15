import { auroraPuzzle, auroraWorld } from '@/mocks/showcase/aurora';

import type { PuzzleInput } from './validate';

export type Draft = PuzzleInput & { title: string; setting: string; setup: string; squadSize: 2 | 3; bounty: number; winners: number; when: string };

export const auroraDraft: Draft = { ...auroraPuzzle, ...auroraWorld, squadSize: 3, bounty: 300, winners: 3, when: 'Fri 8 PM' };

let current: Draft = auroraDraft;

export const draftStore = {
  get: () => current,
  set: (next: Draft) => {
    current = next;
  },
};
