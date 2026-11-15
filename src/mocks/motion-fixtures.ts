// Lab fixtures for src/app/lab (EXPO_PUBLIC_MOCKS=1 only). Deliberately NOT the case answer:
// the culprit, credits and nudge text here are invented, so even a leaked bundle reveals nothing.
import type { MemberView, NudgeView, RevealView, SuspectId } from '@/lib/contract';

export const LAB_ROOM_CODE = 'K7QX';

export const labCrew: MemberView[] = [
  { memberId: 'm-maya', name: 'Maya', role: 'detective', presence: 'reviewing', isHost: true, isMe: true },
  { memberId: 'm-ravi', name: 'Ravi', role: 'hacker', presence: 'reviewing', isHost: false, isMe: false },
  { memberId: 'm-lena', name: 'Lena', role: 'witness', presence: 'reviewing', isHost: false, isMe: false },
];

export const labSuspects: { id: SuspectId; name: string; job: string }[] = [
  { id: 'theo', name: 'Theo', job: 'Botanist' },
  { id: 'priya', name: 'Priya', job: 'Engineer' },
  { id: 'ines', name: 'Ines', job: 'Navigator' },
  { id: 'jun', name: 'Jun', job: 'Galley chef' },
];

// The lab's mock server accepts this pick. It is a fixture value, not the real solution.
export const LAB_MOCK_ANSWER: SuspectId = 'priya';

export const labNudge = (wrongPick: SuspectId, revision: number): NudgeView => ({
  wrongPick,
  forRole: 'witness',
  text: 'Lab fixture: Lena, read the doorway line again. Who could have walked past at that time?',
  revision,
});

export const labReveal: RevealView = {
  culprit: LAB_MOCK_ANSWER,
  timeline: [
    { time: '21:30', text: 'Lab fixture timeline, line one.' },
    { time: '21:40', text: 'Lab fixture timeline, line two.' },
  ],
  why: 'Lab fixture. The real reveal only ever comes from the server.',
  credits: [
    { role: 'hacker', memberName: 'Ravi', cleared: 'theo', line: "Ravi's systems log ruled out Theo." },
    { role: 'witness', memberName: 'Lena', cleared: 'jun', line: "Lena's statement ruled out Jun." },
    { role: 'detective', memberName: 'Maya', cleared: 'ines', line: "Maya's scene notes ruled out Ines." },
  ],
  teaser: { title: 'Episode 02 — The Second Seed', text: 'Your crew picks up where you left off.' },
};
