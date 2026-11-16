import type { BuilderPiece, BuilderRole, BuilderSuspect, PuzzleInput } from './validate';
import { validatePuzzle } from './validate';

export type Setting = 'station' | 'manor' | 'train' | 'gallery';
export type Difficulty = 'easy' | 'medium' | 'hard';

type World = {
  label: string;
  place: string;
  object: string;
  window: [string, string];
  people: { name: string; job: string; spot: string }[];
};

const worlds: Record<Setting, World> = {
  station: {
    label: 'Space station',
    place: 'Kestrel Station',
    object: 'the reactor key',
    window: ['02:10', '02:40'],
    people: [
      { name: 'Theo Marsh', job: 'Engineer', spot: 'the docking ring' },
      { name: 'Priya Okafor', job: 'Comms officer', spot: 'the comms deck' },
      { name: 'Ines Vale', job: 'Botanist', spot: 'the clean room' },
      { name: 'Jun Halloway', job: 'Galley chef', spot: 'the galley' },
      { name: 'Omar Steele', job: 'Medic', spot: 'the med bay' },
      { name: 'Wren Adair', job: 'Pilot', spot: 'the cockpit' },
    ],
  },
  manor: {
    label: 'Country manor',
    place: 'Hollowmere House',
    object: 'the Ashby emerald',
    window: ['22:00', '22:30'],
    people: [
      { name: 'Edith Crane', job: 'Housekeeper', spot: 'the linen room' },
      { name: 'Silas Pike', job: 'Gardener', spot: 'the glasshouse' },
      { name: 'Clara Voss', job: 'Niece', spot: 'the library' },
      { name: 'Hugo Ferris', job: 'Butler', spot: 'the wine cellar' },
      { name: 'Mabel Quint', job: 'Cook', spot: 'the kitchen' },
      { name: 'Rupert Lowe', job: 'Solicitor', spot: 'the study' },
    ],
  },
  train: {
    label: 'Night train',
    place: 'the Northern Star',
    object: 'the courier case',
    window: ['01:00', '01:30'],
    people: [
      { name: 'Anya Brook', job: 'Conductor', spot: 'the front carriage' },
      { name: 'Felix Rowe', job: 'Violinist', spot: 'the dining car' },
      { name: 'Dara Moss', job: 'Journalist', spot: 'compartment 4' },
      { name: 'Ivo Grant', job: 'Porter', spot: 'the luggage van' },
      { name: 'Emily Sato', job: 'Doctor', spot: 'the observation deck' },
      { name: 'Max Ortiz', job: 'Engineer', spot: 'the engine cab' },
    ],
  },
  gallery: {
    label: 'Art gallery',
    place: 'the Meridian Gallery',
    object: 'the Vermeer sketch',
    window: ['19:15', '19:45'],
    people: [
      { name: 'Nora Hale', job: 'Curator', spot: 'the archive' },
      { name: 'Basil Kerr', job: 'Guard', spot: 'the east hall' },
      { name: 'Tess Ward', job: 'Restorer', spot: 'the studio' },
      { name: 'Cyrus Bell', job: 'Donor', spot: 'the rooftop bar' },
      { name: 'Ruth Imai', job: 'Intern', spot: 'the gift shop' },
      { name: 'Leo Dunn', job: 'Caterer', spot: 'the loading bay' },
    ],
  },
};

export const settings = (Object.keys(worlds) as Setting[]).map((id) => ({ id, label: worlds[id].label }));

export const difficulties: { id: Difficulty; label: string; suspects: number }[] = [
  { id: 'easy', label: 'Easy', suspects: 3 },
  { id: 'medium', label: 'Medium', suspects: 4 },
  { id: 'hard', label: 'Hard', suspects: 5 },
];

const kinds: { role: BuilderRole; docLabel: string; line: (first: string, spot: string, from: string, to: string) => string }[] = [
  { role: 'hacker', docLabel: 'CAMERA LOG', line: (f, s, a, b) => `The camera in ${s} shows ${f} there from ${a} to ${b}. Never left the frame.` },
  { role: 'witness', docLabel: 'STATEMENT', line: (f, s, a, b) => `I sat with ${f} in ${s} from ${a} to ${b}. Neither of us got up.` },
  { role: 'detective', docLabel: 'SCENE NOTES', line: (f, s, a, b) => `${f} was sealed inside ${s} from ${a} to ${b}. Its only door stayed shut.` },
  { role: 'hacker', docLabel: 'BADGE LOG', line: (f, s, a, b) => `${f}'s badge was active in ${s} from ${a} to ${b}, with no other door used.` },
];

const rng = (seed: number) => {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
};

const shuffle = <T,>(items: T[], next: () => number) => {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

export type GeneratedPuzzle = PuzzleInput & { title: string; setup: string; setting: Setting; difficulty: Difficulty; seed: number };

export function generatePuzzle({ setting, difficulty, seed }: { setting: Setting; difficulty: Difficulty; seed: number }): GeneratedPuzzle {
  const world = worlds[setting];
  const count = difficulties.find((d) => d.id === difficulty)!.suspects;
  const next = rng(seed + count * 101 + setting.length * 7919);
  const cast = shuffle(world.people, next).slice(0, count);
  const answerIndex = Math.floor(next() * count);
  const [from, to] = world.window;
  const pieceKinds = shuffle(kinds, next);

  const suspects: BuilderSuspect[] = cast.map((p) => ({
    id: p.name.split(' ')[0].toLowerCase(),
    name: p.name,
    job: p.job,
    claim: `In ${p.spot}.`,
  }));

  const pieces: BuilderPiece[] = cast
    .map((p, i) => ({ p, i }))
    .filter(({ i }) => i !== answerIndex)
    .map(({ p }, k) => {
      const kind = pieceKinds[k % pieceKinds.length];
      const first = p.name.split(' ')[0];
      return {
        id: `${kind.docLabel.toLowerCase().replace(' ', '-')}-${k}`,
        docLabel: kind.docLabel,
        role: kind.role,
        text: kind.line(first, p.spot, from, to),
        places: [first.toLowerCase()],
      };
    });

  const puzzle: GeneratedPuzzle = {
    title: `The ${world.object.replace(/^the /, '').replace(/\b\w/g, (c) => c.toUpperCase())}`,
    setup: `At ${world.place}, between ${from} and ${to}, someone took ${world.object}.`,
    setting,
    difficulty,
    seed,
    suspects,
    pieces,
    answer: suspects[answerIndex].id,
  };
  if (!validatePuzzle(puzzle).pass) throw new Error('generator produced an invalid puzzle');
  return puzzle;
}
