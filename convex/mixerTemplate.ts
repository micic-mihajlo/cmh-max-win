import type { ChallengeTemplateId, MixerColor } from '../src/lib/contract';

// Mixer verifier for a challenge template, with the signature agreed for CAP-32's ChallengeTemplate.mixer.
// This is a stand-in until convex/templates ships it; challenges.ts reaches it only through mixerTemplate().
export type MixerFragment = { title: string; text: string; secret: string };
export type MixerTemplate = {
  fragment(seed: string, color: MixerColor, index: number): MixerFragment;
  verify(answer: string, members: { color: MixerColor; secret: string }[]): { correct: boolean; nudge?: string };
};

const WORDS = [
  'ORBIT', 'COMET', 'NEBULA', 'QUASAR', 'PULSAR', 'ZENITH', 'AURORA', 'EQUINOX', 'SOLSTICE', 'METEOR', 'GALAXY', 'NOVA',
  'ECLIPSE', 'PLASMA', 'VECTOR', 'HELIX', 'PRISM', 'ION', 'PHOTON', 'MAGNET', 'CRATER', 'LUNAR', 'SOLAR', 'COSMOS',
];
const COLOR_ORDER: MixerColor[] = ['red', 'blue', 'green', 'yellow'];

function hash(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619) >>> 0;
  return h;
}

const normalize = (s: string) => s.trim().toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();

const aurora: MixerTemplate = {
  fragment(seed, color, index) {
    const h = hash(seed + ':' + color + ':' + index);
    const secret = WORDS[h % WORDS.length] + '-' + String(10 + (Math.floor(h / WORDS.length) % 90));
    return {
      title: 'VAULT KEY · ' + color.toUpperCase(),
      text: 'Your key is ' + secret + '. The vault opens to every teammate’s key, read in color order: red, blue, green, yellow.',
      secret,
    };
  },
  verify(answer, members) {
    const expected = [...members]
      .sort((a, b) => COLOR_ORDER.indexOf(a.color) - COLOR_ORDER.indexOf(b.color))
      .map((m) => normalize(m.secret))
      .join(' ');
    return normalize(answer) === expected
      ? { correct: true }
      : { correct: false, nudge: 'That isn’t your team’s vault code. Read your keys out again, in color order.' };
  },
};

export function mixerTemplate(templateId: ChallengeTemplateId): MixerTemplate {
  return { 'mystery-aurora': aurora }[templateId];
}
