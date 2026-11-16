import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { finishWhopRedirect, openWhopSignIn, whopReturnUrl } from './whop-auth';

const browser = vi.hoisted(() => ({ openAuthSessionAsync: vi.fn() }));
const platform = vi.hoisted(() => ({ OS: 'ios' }));
vi.mock('expo-web-browser', () => browser);
vi.mock('react-native', () => ({ Platform: platform }));
vi.mock('expo-linking', () => ({
  createURL: (path: string) => 'exp://192.168.1.5:8081/--/' + path,
  parse: (url: string) => ({ queryParams: Object.fromEntries(new URL(url).searchParams) }),
}));

const RETURN = 'exp://192.168.1.5:8081/--/host';
const AUTHORIZE = 'https://sandbox-api.whop.com/oauth/authorize?state=s';
const returning = (url: string) => browser.openAuthSessionAsync.mockResolvedValueOnce({ type: 'success', url });

let complete: ReturnType<typeof vi.fn<(linkCode: string) => Promise<boolean>>>;
beforeEach(() => {
  platform.OS = 'ios';
  browser.openAuthSessionAsync.mockReset();
  complete = vi.fn(async () => true);
});
afterEach(() => vi.unstubAllGlobals());

describe('openWhopSignIn (native and desktop popup)', () => {
  test('new backend: redeems the link code and reports what completeSignIn decided', async () => {
    returning(RETURN + '?whop=link&code=abc123');
    expect(await openWhopSignIn(AUTHORIZE, RETURN, complete, 'host')).toBe('linked');
    expect(complete).toHaveBeenCalledWith('abc123');
    complete.mockResolvedValueOnce(false);
    returning(RETURN + '?whop=link&code=stale');
    expect(await openWhopSignIn(AUTHORIZE, RETURN, complete, 'host')).toBe('error');
  });

  test('old backend: whop=linked with no code is success and redeems nothing', async () => {
    returning(RETURN + '?whop=linked');
    expect(await openWhopSignIn(AUTHORIZE, RETURN, complete, 'host')).toBe('linked');
    expect(complete).not.toHaveBeenCalled();
  });

  test('cancel, error and a link without a code', async () => {
    returning(RETURN + '?whop=cancelled');
    expect(await openWhopSignIn(AUTHORIZE, RETURN, complete, 'host')).toBe('cancelled');
    returning(RETURN + '?whop=error');
    expect(await openWhopSignIn(AUTHORIZE, RETURN, complete, 'host')).toBe('error');
    returning(RETURN + '?whop=link');
    expect(await openWhopSignIn(AUTHORIZE, RETURN, complete, 'host')).toBe('error');
    browser.openAuthSessionAsync.mockResolvedValueOnce({ type: 'dismiss' });
    expect(await openWhopSignIn(AUTHORIZE, RETURN, complete, 'host')).toBe('cancelled');
    expect(complete).not.toHaveBeenCalled();
  });
});

describe('web', () => {
  function web(href: string, { touch = 0, width = 390 } = {}) {
    platform.OS = 'web';
    const store = new Map<string, string>();
    const win = {
      location: {
        get href() {
          return href;
        },
        get origin() {
          return new URL(href).origin;
        },
        get search() {
          return new URL(href).search;
        },
        assign: vi.fn(),
      },
      innerWidth: width,
      sessionStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
        removeItem: (k: string) => void store.delete(k),
      },
      history: {
        state: null,
        replaceState: vi.fn((_s: unknown, _t: string, url: string) => {
          href = new URL(url, href).toString();
        }),
      },
    };
    vi.stubGlobal('window', win);
    vi.stubGlobal('navigator', { maxTouchPoints: touch });
    return { win, store, href: () => href, land: (url: string) => (href = url) };
  }

  test('a phone browser redirects the tab to Whop, returning to this page, and keeps the popup out of it', async () => {
    const { win, store } = web('https://signal-app-wine.vercel.app/c/K7QM?ref=qr', { touch: 5 });
    const returnUrl = whopReturnUrl('c/K7QM');
    expect(returnUrl).toBe('https://signal-app-wine.vercel.app/c/K7QM?ref=qr');
    void openWhopSignIn(AUTHORIZE, returnUrl, complete, 'join');
    await Promise.resolve();
    expect(win.location.assign).toHaveBeenCalledWith(AUTHORIZE);
    expect(browser.openAuthSessionAsync).not.toHaveBeenCalled();
    expect(JSON.parse(store.get('whop-sign-in-pending')!)).toMatchObject({ purpose: 'join', returnPath: '/c/K7QM?ref=qr' });
  });

  test('a narrow window redirects too; a wide desktop window without touch keeps the popup', async () => {
    const narrow = web('https://signal-app-wine.vercel.app/host', { width: 500 });
    void openWhopSignIn(AUTHORIZE, whopReturnUrl('host'), complete, 'host');
    await Promise.resolve();
    expect(narrow.win.location.assign).toHaveBeenCalled();
    const desktop = web('https://signal-app-wine.vercel.app/host', { width: 1440 });
    expect(whopReturnUrl('host')).toBe('exp://192.168.1.5:8081/--/host');
    returning('https://signal-app-wine.vercel.app/host?whop=link&code=pop');
    expect(await openWhopSignIn(AUTHORIZE, 'https://signal-app-wine.vercel.app/host', complete, 'host')).toBe('linked');
    expect(desktop.win.location.assign).not.toHaveBeenCalled();
    expect(complete).toHaveBeenCalledWith('pop');
  });

  test('back from the redirect: redeems the code once, cleans the URL and clears the pending record', async () => {
    const page = web('https://signal-app-wine.vercel.app/c/K7QM?ref=qr', { touch: 5 });
    void openWhopSignIn(AUTHORIZE, whopReturnUrl('c/K7QM'), complete, 'join');
    page.land('https://signal-app-wine.vercel.app/c/K7QM?ref=qr&whop=link&code=abc123');
    expect(await finishWhopRedirect(complete)).toBe('linked');
    expect(complete).toHaveBeenCalledWith('abc123');
    expect(page.href()).toBe('https://signal-app-wine.vercel.app/c/K7QM?ref=qr');
    expect(page.store.has('whop-sign-in-pending')).toBe(false);
    page.land('https://signal-app-wine.vercel.app/c/K7QM?whop=link&code=abc123');
    expect(await finishWhopRedirect(complete)).toBeNull();
    expect(complete).toHaveBeenCalledTimes(1);
  });

  test('back from the redirect: cancelled, the old backend, a failed redeem and an expired record', async () => {
    const page = web('https://signal-app-wine.vercel.app/host', { touch: 5 });
    const start = () => void openWhopSignIn(AUTHORIZE, whopReturnUrl('host'), complete, 'host');
    start();
    page.land('https://signal-app-wine.vercel.app/host?whop=cancelled');
    expect(await finishWhopRedirect(complete)).toBe('cancelled');
    start();
    page.land('https://signal-app-wine.vercel.app/host?whop=linked');
    expect(await finishWhopRedirect(complete)).toBe('linked');
    expect(complete).not.toHaveBeenCalled();
    start();
    complete.mockResolvedValueOnce(false);
    page.land('https://signal-app-wine.vercel.app/host?whop=link&code=stale');
    expect(await finishWhopRedirect(complete)).toBe('error');
    vi.useFakeTimers();
    try {
      start();
      vi.advanceTimersByTime(10 * 60 * 1000 + 1);
      page.land('https://signal-app-wine.vercel.app/host?whop=link&code=late');
      expect(await finishWhopRedirect(complete)).toBe('error');
      expect(complete).not.toHaveBeenCalledWith('late');
      expect(page.href()).toBe('https://signal-app-wine.vercel.app/host');
    } finally {
      vi.useRealTimers();
    }
  });

  test('a page with whop params but nothing pending (a pasted link) is left alone', async () => {
    const page = web('https://signal-app-wine.vercel.app/host?whop=link&code=abc', { touch: 5 });
    expect(await finishWhopRedirect(complete)).toBeNull();
    expect(page.href()).toBe('https://signal-app-wine.vercel.app/host?whop=link&code=abc');
    expect(complete).not.toHaveBeenCalled();
  });
});
