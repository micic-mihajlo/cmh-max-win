// Mock-only fixtures. These hold server-side content (dossiers, nudges, the answer and the reveal).
// Only src/mocks/gallery.tsx imports this file, and the gallery is bundled only with EXPO_PUBLIC_MOCKS=1.

import type { DossierView, NudgeView, RevealView, Role, SuspectId } from './contract';

export const Dossiers: Record<Role, DossierView> = {
  hacker: {
    role: 'hacker',
    docLabel: 'SYSTEMS LOG',
    title: 'Station systems · 21:30–21:50',
    lines: [
      { time: '21:33', text: 'GALLEY oven started. Manual, 40-min timer.' },
      { time: '21:38', text: 'DOCK RING seal test started. Badge T. MARSH.' },
      { time: '21:42', text: 'GREENHOUSE door OPEN. Maintenance override, no badge.' },
      { time: '21:44', text: 'GREENHOUSE door CLOSED.' },
      { time: '21:47', text: 'DOCK RING seal test complete. Badge T. MARSH removed.' },
    ],
    notes:
      'The seal test needs the badge held in the reader for the whole run. Override codes went to all crew for last month’s evacuation drill and were never revoked.',
  },
  witness: {
    role: 'witness',
    docLabel: 'STATEMENT',
    title: 'Dr. Sam Reyes, medic',
    lines: [
      {
        text: 'I started my break in the lounge at 21:30. Priya was already there, so we began a game of Go at the window table. Neither of us got up until the alarm.',
      },
      {
        text: 'I know the time because my 20-minute break timer went off with it. Someone passed the doorway around 21:40, but with the window glare I couldn’t see who.',
      },
    ],
  },
  detective: {
    role: 'detective',
    docLabel: 'SCENE NOTES',
    title: 'Station security',
    lines: [
      { text: 'Seed case opened cleanly, no forced lock. Misting system ran 21:35–21:45, so the floor was still wet.' },
      {
        time: '21:52',
        text: 'Went room to room. Clean room: the single-use tamper strip on the door was signed by Ines at 21:15 and still intact when I knocked at 21:53.',
      },
      { text: 'She was inside and had to tear it to come out. The clean room has only one door.' },
    ],
  },
};

export const Nudges: Record<Exclude<SuspectId, 'jun'>, Omit<NudgeView, 'revision'>> = {
  theo: { wrongPick: 'theo', forRole: 'hacker', text: 'The systems log disagrees. Hacker, walk everyone through the timing.' },
  priya: { wrongPick: 'priya', forRole: 'witness', text: 'Someone here can vouch for her. Witness, what did you see?' },
  ines: { wrongPick: 'ines', forRole: 'detective', text: 'The scene notes rule this out. Detective, check that door.' },
};

export const Reveal: RevealView = {
  culprit: 'jun',
  timeline: [
    { time: '21:33', text: 'Jun sets the oven on a 40-minute timer, an alibi that runs itself.' },
    { time: '21:40', text: 'She walks aft past the lounge: the figure lost in the glare.' },
    { time: '21:42', text: 'She opens the greenhouse with her never-revoked drill override.' },
    { time: '21:43', text: 'The misting cycle (21:35–21:45) soaks her apron.' },
    { time: '21:44', text: 'She’s out, back in the galley by 21:46.' },
    { time: '21:52', text: 'At muster she blames the damp apron on dishwater.' },
  ],
  why: 'An anonymous message promised the seed would be “kept safe on Earth” if she left it in the galley cold store before the shuttle docked.',
  credits: [
    { role: 'hacker', memberName: 'Ravi', cleared: 'theo', line: 'Badge held at the docking ring 21:38–21:47. The door opened at 21:42, and the walk takes 6 minutes.' },
    { role: 'witness', memberName: 'Lena', cleared: 'priya', line: 'At the Go board 21:30–21:50. Neither of them got up until the alarm.' },
    { role: 'detective', memberName: 'Maya', cleared: 'ines', line: 'Inside a one-door room. The tamper strip stayed intact from 21:15 to 21:53.' },
  ],
  teaser: {
    title: 'Episode 02 · The Second Seed',
    text: 'The lab scans the recovered seed. It’s a replica. The real Aurora Seed was swapped before the 21:30 inventory, and the anonymous message came from inside the crew.',
  },
};

