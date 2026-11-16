import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import type { WhopSignInResult } from '@/lib/contract';

export function whopReturnUrl(path = 'whop-auth'): string {
  return Linking.createURL(path);
}

// complete redeems the one-time code the callback hands back (whopAuth:completeSignIn) for the device that started.
export async function openWhopSignIn(
  authorizeUrl: string,
  returnUrl: string,
  complete: (linkCode: string) => Promise<boolean>,
): Promise<WhopSignInResult> {
  const result = await WebBrowser.openAuthSessionAsync(authorizeUrl, returnUrl);
  if (result.type !== 'success') return 'cancelled';
  const { whop: status, code } = Linking.parse(result.url).queryParams ?? {};
  if (status === 'cancelled') return 'cancelled';
  if (status !== 'link' || typeof code !== 'string') return 'error';
  return (await complete(code)) ? 'linked' : 'error';
}
