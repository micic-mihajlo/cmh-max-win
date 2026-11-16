import { beforeEach, describe, expect, test, vi } from 'vitest';

import { openWhopSignIn } from './whop-auth';

const browser = vi.hoisted(() => ({ openAuthSessionAsync: vi.fn() }));
vi.mock('expo-web-browser', () => browser);
vi.mock('expo-linking', () => ({
  createURL: (path: string) => 'exp://192.168.1.5:8081/--/' + path,
  parse: (url: string) => ({ queryParams: Object.fromEntries(new URL(url).searchParams) }),
}));

const RETURN = 'exp://192.168.1.5:8081/--/host';
const returning = (url: string) => browser.openAuthSessionAsync.mockResolvedValueOnce({ type: 'success', url });

let complete: ReturnType<typeof vi.fn<(linkCode: string) => Promise<boolean>>>;
beforeEach(() => {
  browser.openAuthSessionAsync.mockReset();
  complete = vi.fn(async () => true);
});

describe('openWhopSignIn', () => {
  test('new backend: redeems the link code and reports what completeSignIn decided', async () => {
    returning(RETURN + '?whop=link&code=abc123');
    expect(await openWhopSignIn('https://whop/authorize', RETURN, complete)).toBe('linked');
    expect(complete).toHaveBeenCalledWith('abc123');
    complete.mockResolvedValueOnce(false);
    returning(RETURN + '?whop=link&code=stale');
    expect(await openWhopSignIn('https://whop/authorize', RETURN, complete)).toBe('error');
  });

  test('old backend: whop=linked with no code is success and redeems nothing', async () => {
    returning(RETURN + '?whop=linked');
    expect(await openWhopSignIn('https://whop/authorize', RETURN, complete)).toBe('linked');
    expect(complete).not.toHaveBeenCalled();
  });

  test('cancel, error and a link without a code', async () => {
    returning(RETURN + '?whop=cancelled');
    expect(await openWhopSignIn('https://whop/authorize', RETURN, complete)).toBe('cancelled');
    returning(RETURN + '?whop=error');
    expect(await openWhopSignIn('https://whop/authorize', RETURN, complete)).toBe('error');
    returning(RETURN + '?whop=link');
    expect(await openWhopSignIn('https://whop/authorize', RETURN, complete)).toBe('error');
    browser.openAuthSessionAsync.mockResolvedValueOnce({ type: 'dismiss' });
    expect(await openWhopSignIn('https://whop/authorize', RETURN, complete)).toBe('cancelled');
    expect(complete).not.toHaveBeenCalled();
  });
});
