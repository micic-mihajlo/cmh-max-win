import { describe, expect, it } from 'vitest';

import { challengeLinkPath } from './join-code';

describe('challengeLinkPath', () => {
  it("opens the clip's code entry from its default App Store URL", () => {
    expect(challengeLinkPath('https://appclip.apple.com/id?p=r4z33n4l1.cmhmaxwin.Clip')).toBe('/clip');
  });

  it('leaves challenge links and every other link alone', () => {
    expect(challengeLinkPath('https://signal-app-wine.vercel.app/c/K7QX')).toBe('https://signal-app-wine.vercel.app/c/K7QX');
    expect(challengeLinkPath('cmhmaxwin://c/K7QX')).toBe('cmhmaxwin://c/K7QX');
    expect(challengeLinkPath('/room/ABCD')).toBe('/room/ABCD');
  });
});
