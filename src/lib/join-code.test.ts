import { describe, expect, it } from 'vitest';

import { challengeLinkPath } from './join-code';

describe('challengeLinkPath', () => {
  it('sends challenge links to the clip player with the code', () => {
    expect(challengeLinkPath('https://signal-app-wine.vercel.app/c/k7qx')).toBe('/clip?code=K7QX');
    expect(challengeLinkPath('https://signal-app-wine.vercel.app/c/K7QX/')).toBe('/clip?code=K7QX');
    expect(challengeLinkPath('cmhmaxwin://c/K7QX')).toBe('/clip?code=K7QX');
  });

  it("opens the clip's code entry from its default App Store URL", () => {
    expect(challengeLinkPath('https://appclip.apple.com/id?p=r4z33n4l1.cmhmaxwin.Clip')).toBe('/clip');
  });

  it('leaves every other link alone', () => {
    expect(challengeLinkPath('cmhmaxwin://join/K7QX')).toBe('cmhmaxwin://join/K7QX');
    expect(challengeLinkPath('https://signal-app-wine.vercel.app/c/K7QX/play')).toBe('https://signal-app-wine.vercel.app/c/K7QX/play');
    expect(challengeLinkPath('/room/ABCD')).toBe('/room/ABCD');
  });
});
