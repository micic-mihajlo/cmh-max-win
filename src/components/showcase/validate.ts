export type BuilderRole = 'detective' | 'hacker' | 'witness';

export type BuilderSuspect = { id: string; name: string; job: string; claim: string };

export type BuilderPiece = {
  id: string;
  docLabel: string;
  role: BuilderRole;
  text: string;
  places: string[];
};

export type PuzzleInput = { suspects: BuilderSuspect[]; pieces: BuilderPiece[]; answer: string };

export type CheckRow = { id: string; label: string; pass: boolean; detail: string };

export type RemovalRow = { pieceId: string; docLabel: string; remaining: string[]; pass: boolean };

export type PuzzleReport = {
  pass: boolean;
  checks: CheckRow[];
  allTogether: string[];
  removals: RemovalRow[];
  smallestSolvingSubset: string[] | null;
};

const doc = (label: string) => label.charAt(0) + label.slice(1).toLowerCase();

const remainingAfter = (suspects: BuilderSuspect[], pieces: BuilderPiece[]) => {
  const placed = new Set(pieces.flatMap((p) => p.places));
  return suspects.filter((s) => !placed.has(s.id)).map((s) => s.id);
};

const nameTokens = (s: BuilderSuspect) =>
  s.name
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 1);

const mentions = (text: string, suspect: BuilderSuspect) => {
  const words = new Set(text.toLowerCase().match(/[\p{L}']+/gu) ?? []);
  return nameTokens(suspect).some((t) => words.has(t));
};

export function validatePuzzle({ suspects, pieces, answer }: PuzzleInput): PuzzleReport {
  const byId = new Map(suspects.map((s) => [s.id, s]));
  const name = (id: string) => byId.get(id)?.name.split(' ')[0] ?? id;
  const answerSuspect = byId.get(answer);

  const badPlaces = pieces.filter((p) => p.places.length !== 1 || !byId.has(p.places[0]));
  const placesAnswer = pieces.filter((p) => p.places.includes(answer));
  const namesAnswer = answerSuspect ? pieces.filter((p) => mentions(p.text, answerSuspect)) : [];

  const allTogether = remainingAfter(suspects, pieces);
  const solvesTogether = allTogether.length === 1 && allTogether[0] === answer;

  const removals: RemovalRow[] = pieces.map((p) => {
    const remaining = remainingAfter(
      suspects,
      pieces.filter((q) => q !== p),
    );
    return { pieceId: p.id, docLabel: p.docLabel, remaining, pass: remaining.length >= 2 };
  });

  let smallestSolvingSubset: string[] | null = null;
  const n = pieces.length;
  for (let mask = 1; mask < (1 << n) - 1 && n <= 12; mask++) {
    const subset = pieces.filter((_, i) => mask & (1 << i));
    if (remainingAfter(suspects, subset).length <= 1 && (!smallestSolvingSubset || subset.length < smallestSolvingSubset.length)) {
      smallestSolvingSubset = subset.map((p) => p.id);
    }
  }

  const singleSolver = pieces.find((p) => remainingAfter(suspects, [p]).length <= 1);

  const checks: CheckRow[] = [
    {
      id: 'answer',
      label: 'The answer is a suspect',
      pass: !!answerSuspect,
      detail: answerSuspect ? answerSuspect.name : 'Pick who did it.',
    },
    {
      id: 'one-each',
      label: 'Every piece clears exactly one suspect',
      pass: pieces.length > 0 && badPlaces.length === 0 && placesAnswer.length === 0,
      detail:
        pieces.length === 0
          ? 'Add at least one piece.'
          : badPlaces.length
            ? badPlaces.map((p) => `${doc(p.docLabel)} clears ${p.places.length}`).join(' · ')
            : placesAnswer.length
              ? `${placesAnswer.map((p) => doc(p.docLabel)).join(', ')} clears the answer`
              : `${pieces.length} pieces, ${pieces.length} suspects cleared`,
    },
    {
      id: 'together',
      label: 'All pieces together leave only the answer',
      pass: solvesTogether,
      detail: allTogether.length ? `Left: ${allTogether.map(name).join(', ')}` : 'Nobody is left.',
    },
    {
      id: 'single',
      label: 'No single piece solves it',
      pass: !singleSolver,
      detail: singleSolver ? `${doc(singleSolver.docLabel)} solves it alone` : 'Every piece alone leaves 2 or more',
    },
    {
      id: 'subset',
      label: 'Only the full set solves it',
      pass: smallestSolvingSubset === null,
      detail: smallestSolvingSubset ? `Solved with only ${smallestSolvingSubset.length} of ${n}` : `Needs all ${n}`,
    },
    {
      id: 'names',
      label: 'No piece names the answer',
      pass: namesAnswer.length === 0,
      detail: namesAnswer.length ? `${namesAnswer.map((p) => doc(p.docLabel)).join(', ')} names ${name(answer)}` : 'Clean',
    },
  ];

  return { pass: checks.every((c) => c.pass), checks, allTogether, removals, smallestSolvingSubset };
}

export function splitPieces(pieceCount: number, squadSize: number) {
  const hands = Array.from({ length: squadSize }, () => 0);
  for (let i = 0; i < pieceCount; i++) hands[i % squadSize]++;
  return hands;
}
