import { describe, expect, it } from 'vitest';

import { auroraBroken, auroraPuzzle } from '@/mocks/showcase/aurora';

import { generatePuzzle } from './generate';
import { splitPieces, validatePuzzle } from './validate';

describe('validatePuzzle', () => {
  it('passes the Aurora Seed', () => {
    const report = validatePuzzle(auroraPuzzle);
    expect(report.pass).toBe(true);
    expect(report.allTogether).toEqual(['jun']);
    expect(report.removals.map((r) => r.remaining.length)).toEqual([2, 2, 2]);
  });

  it('fails a variant where one piece clears two and names the answer', () => {
    const report = validatePuzzle(auroraBroken);
    expect(report.pass).toBe(false);
    const failed = report.checks.filter((c) => !c.pass).map((c) => c.id);
    expect(failed).toEqual(expect.arrayContaining(['one-each', 'subset', 'names']));
  });

  it('fails when the pieces leave two suspects', () => {
    const report = validatePuzzle({ ...auroraPuzzle, pieces: auroraPuzzle.pieces.slice(0, 2) });
    expect(report.pass).toBe(false);
    expect(report.checks.find((c) => c.id === 'together')?.pass).toBe(false);
  });

  it('fails when a piece clears the answer', () => {
    const pieces = auroraPuzzle.pieces.map((p) => (p.id === 'scene' ? { ...p, places: ['jun'] } : p));
    expect(validatePuzzle({ ...auroraPuzzle, pieces }).pass).toBe(false);
  });

  it('splits pieces across duos and trios', () => {
    expect(splitPieces(3, 3)).toEqual([1, 1, 1]);
    expect(splitPieces(3, 2)).toEqual([2, 1]);
    expect(splitPieces(4, 3)).toEqual([2, 1, 1]);
  });
});

describe('generatePuzzle', () => {
  it('always produces puzzles that pass the validator', () => {
    for (const setting of ['station', 'manor', 'train', 'gallery'] as const) {
      for (const difficulty of ['easy', 'medium', 'hard'] as const) {
        for (let seed = 0; seed < 20; seed++) {
          const puzzle = generatePuzzle({ setting, difficulty, seed });
          expect(validatePuzzle(puzzle).pass).toBe(true);
        }
      }
    }
  });

  it('is deterministic', () => {
    expect(generatePuzzle({ setting: 'manor', difficulty: 'hard', seed: 7 })).toEqual(
      generatePuzzle({ setting: 'manor', difficulty: 'hard', seed: 7 }),
    );
  });
});
