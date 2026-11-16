import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import type { WhopSignInResult } from '@/lib/contract';

const PENDING_KEY = 'whop-sign-in-pending';
const PENDING_TTL_MS = 10 * 60 * 1000;

type Complete = (linkCode: string) => Promise<boolean>;
type Pending = { purpose: string; returnPath: string; startedAt: number };

// Web signs in by redirecting the tab to Whop and back to this page: phone browsers block the popup, and on desktop
// the popup never completes because nothing calls maybeCompleteAuthSession.
function redirectsInTab(): boolean {
  return Platform.OS === 'web' && typeof window !== 'undefined';
}

function currentPage(): string {
  const url = new URL(window.location.href);
  url.searchParams.delete('whop');
  url.searchParams.delete('code');
  return url.toString();
}

export function whopReturnUrl(path = 'whop-auth'): string {
  return redirectsInTab() ? currentPage() : Linking.createURL(path);
}

// complete redeems the one-time code the callback hands back (whopAuth:completeSignIn) for the device that started.
// A backend from before link codes links in the callback and returns whop=linked with no code, so that is success too.
async function resultOf(status: unknown, code: unknown, complete: Complete): Promise<WhopSignInResult> {
  if (status === 'cancelled') return 'cancelled';
  if (status === 'linked') return 'linked';
  if (status !== 'link' || typeof code !== 'string') return 'error';
  return (await complete(code)) ? 'linked' : 'error';
}

// In-tab redirect: the page unloads, so the promise never settles; finishWhopRedirect completes on the way back.
export async function openWhopSignIn(authorizeUrl: string, returnUrl: string, complete: Complete, purpose: string): Promise<WhopSignInResult> {
  if (redirectsInTab()) {
    const url = new URL(currentPage());
    const pending: Pending = { purpose, returnPath: url.pathname + url.search, startedAt: Date.now() };
    window.sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending));
    window.location.assign(authorizeUrl);
    return new Promise<WhopSignInResult>(() => {});
  }
  const result = await WebBrowser.openAuthSessionAsync(authorizeUrl, returnUrl);
  if (result.type !== 'success') return 'cancelled';
  const { whop: status, code } = Linking.parse(result.url).queryParams ?? {};
  return resultOf(status, code, complete);
}

// Back from an in-tab sign-in: takes the pending record (so it completes once, however many hooks are mounted),
// puts the page's own URL back without whop and code, and redeems the code. null when nothing is pending here.
export async function finishWhopRedirect(complete: Complete): Promise<WhopSignInResult | null> {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const status = params.get('whop');
  const raw = window.sessionStorage.getItem(PENDING_KEY);
  if (!status || !raw) return null;
  window.sessionStorage.removeItem(PENDING_KEY);
  const pending = JSON.parse(raw) as Pending;
  window.history.replaceState(window.history.state, '', currentPage().replace(window.location.origin, ''));
  if (Date.now() - pending.startedAt > PENDING_TTL_MS) return 'error';
  return resultOf(status, params.get('code'), complete);
}
