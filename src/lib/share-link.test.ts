import { describe, expect, it } from 'vitest';

import { normalizeCode, parseChallengeCode, shareUrlFor } from './share-link';

describe('parseChallengeCode', () => {
  it.each([
    ['https://signal-app-wine.vercel.app/c/K7QM', 'K7QM'],
    ['https://signal-app-wine.vercel.app/c/K7QM/', 'K7QM'],
    ['https://signal-app-wine.vercel.app/c/k7qm', 'K7QM'],
    ['https://SIGNAL-APP-WINE.vercel.app/c/K7QM?utm_source=twitch#top', 'K7QM'],
    ['  https://signal-app-wine.vercel.app/c/K7QM \n', 'K7QM'],
    ['cmhmaxwin://c/K7QM', 'K7QM'],
    ['cmhmaxwin:///c/K7QM', 'K7QM'],
    ['CMHMAXWIN://c/k7qm?ref=qr', 'K7QM'],
    ['K7QM', 'K7QM'],
    [' k7qm ', 'K7QM'],
  ])('reads %s', (text, code) => {
    expect(parseChallengeCode(text)).toBe(code);
  });

  it.each([
    '',
    'K7Q',
    'K7QMX',
    'K7Q0',
    'IO10',
    'https://evil.example/c/K7QM',
    'https://signal-app-wine.vercel.app.evil.example/c/K7QM',
    'http://signal-app-wine.vercel.app/c/K7QM',
    'https://signal-app-wine.vercel.app/join/K7QM',
    'https://signal-app-wine.vercel.app/c/K7QM/results',
    'https://signal-app-wine.vercel.app/K7QM',
    'otherapp://c/K7QM',
    'cmhmaxwin://drop/K7QM',
    'WIFI:S:stream;T:WPA;P:K7QM;;',
    'join K7QM now',
  ])('rejects %s', (text) => {
    expect(parseChallengeCode(text)).toBeNull();
  });
});

describe('share links', () => {
  it('builds the share URL from a code and parses it back', () => {
    expect(shareUrlFor('k7qm')).toBe('https://signal-app-wine.vercel.app/c/K7QM');
    expect(parseChallengeCode(shareUrlFor('K7QM'))).toBe('K7QM');
  });

  it('normalizes only full codes', () => {
    expect(normalizeCode('k7qm')).toBe('K7QM');
    expect(normalizeCode('k7q')).toBeNull();
  });
});
