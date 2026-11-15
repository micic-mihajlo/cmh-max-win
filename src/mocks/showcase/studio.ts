import type { Difficulty, Setting } from '@/components/showcase/generate';

export const creator = { name: 'Nova', handle: '@nova', followers: 1284, drops: 12 };

export const liveDrop = { title: 'The Aurora Seed', code: 'KQZT', here: 38, squads: 12, bounty: 300, winners: 3 };

export const upcomingDrops = [
  { title: 'The Courier Case', when: 'Fri · 8:00 PM', bounty: 500, winners: 5, reminders: 212 },
  { title: 'The Ashby Emerald', when: 'Sat · 2:00 PM', bounty: 150, winners: 3, reminders: 96 },
];

export const lastDrop = { title: 'The Vermeer Sketch', entrants: 42, squads: 14, solveRate: 0.86, medianSolve: '2:41', firstSolve: '0:58' };

export type CommunityCase = {
  id: string;
  title: string;
  creator: string;
  plays: number;
  solveRate: number;
  tone: string;
  setting: Setting;
  difficulty: Difficulty;
  seed: number;
};

export const communityCases: CommunityCase[] = [
  { id: 'c1', title: 'The Courier Case', creator: 'Mara Lin', plays: 3420, solveRate: 0.71, tone: '#EEF0F5', setting: 'train', difficulty: 'hard', seed: 4 },
  { id: 'c2', title: 'The Ashby Emerald', creator: 'Theo Grant', plays: 2180, solveRate: 0.83, tone: '#EEF2EC', setting: 'manor', difficulty: 'medium', seed: 11 },
  { id: 'c3', title: 'The Vermeer Sketch', creator: 'Nova', plays: 1904, solveRate: 0.86, tone: '#F3EDE0', setting: 'gallery', difficulty: 'medium', seed: 2 },
  { id: 'c4', title: 'The Reactor Key', creator: 'Jules Park', plays: 1266, solveRate: 0.64, tone: '#F4E6E1', setting: 'station', difficulty: 'hard', seed: 9 },
  { id: 'c5', title: 'Last Stop, Platform 9', creator: 'Ade Okoro', plays: 812, solveRate: 0.92, tone: '#E7EDF4', setting: 'train', difficulty: 'easy', seed: 3 },
];
