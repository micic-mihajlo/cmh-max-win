import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import type { WhopSignInResult } from '@/lib/contract';

export function whopReturnUrl(path = 'whop-auth'): string {
  return Linking.createURL(path);
}

// complete redeems the one-time code the callback hands back (whopAuth:completeSignIn) for the device that started.
// A backend from before link codes links in the callback and returns whop=linked with no code, so that is success too.
export async function openWhopSignIn(
  authorizeUrl: string,
  returnUrl: string,
  complete: (linkCode: string) => Promise<boolean>,
): Promise<WhopSignInResult> {
  const result = await WebBrowser.openAuthSessionAsync(authorizeUrl, returnUrl);
  if (result.type !== 'success') return 'cancelled';
  const { whop: status, code } = Linking.parse(result.url).queryParams ?? {};
  if (status === 'cancelled') return 'cancelled';
  if (status === 'linked') return 'linked';
  if (status !== 'link' || typeof code !== 'string') return 'error';
  return (await complete(code)) ? 'linked' : 'error';
}
