// aurora01: the drops squad cut of Case 01 (signal/design/demo-challenge.md). Server-only content: this module
// exports no Convex functions, so pieces, nudges and the reveal are reachable only through gated queries.
import type { Dossier, Role, SuspectId } from './case01';

export type PieceId = 'camera' | 'witness' | 'scene';

export type Piece = Dossier & { pieceId: PieceId; label: string; places: Exclude<SuspectId, 'jun'> };

export const PIECES: Record<Role, Piece> = {
  hacker: {
    pieceId: 'camera',
    role: 'hacker',
    label: 'Camera Log',
    docLabel: 'CAMERA LOG',
    title: 'Station systems',
    places: 'theo',
    lines: [{ text: 'The dock camera shows Theo at the docking ring from 21:30 to 21:50. He never left.' }],
  },
  witness: {
    pieceId: 'witness',
    role: 'witness',
    label: 'Witness statement',
    docLabel: 'WITNESS',
    title: 'Dr. Sam Reyes, medic',
    places: 'priya',
    lines: [{ text: 'Priya played Go with me in the lounge from 21:30 to 21:50. Neither of us got up.' }],
  },
  detective: {
    pieceId: 'scene',
    role: 'detective',
    label: 'Scene Notes',
    docLabel: 'SCENE NOTES',
    title: 'Station security',
    places: 'ines',
    lines: [{ text: 'Ines was locked inside the clean room from 21:30 to 21:50. Its only door never opened.' }],
  },
};

export const SUSPECT_NAMES: Record<SuspectId, string> = { theo: 'Theo', priya: 'Priya', ines: 'Ines', jun: 'Jun' };

export function pieceFor(suspect: Exclude<SuspectId, 'jun'>): Piece {
  return Object.values(PIECES).find((p) => p.places === suspect)!;
}

export function nudgeText(suspect: Exclude<SuspectId, 'jun'>, holderName: string) {
  return `Not ${SUSPECT_NAMES[suspect]}. Ask ${holderName} to read the ${pieceFor(suspect).label}.`;
}

export const AURORA_REVEAL = {
  headline: 'Jun took the seed.',
  why: 'She left the galley oven on a timer and slipped into the greenhouse while it baked.',
  credits: [
    { role: 'hacker' as Role, cleared: 'theo' as SuspectId, line: (name: string) => `${name}'s Camera Log placed Theo at the docking ring.` },
    { role: 'witness' as Role, cleared: 'priya' as SuspectId, line: (name: string) => `${name}'s Witness put Priya at the Go board.` },
    {
      role: 'detective' as Role,
      cleared: 'ines' as SuspectId,
      line: (name: string) => `${name}'s Scene Notes locked Ines in the clean room.`,
    },
  ],
  closer: 'Nobody could place Jun.',
};
