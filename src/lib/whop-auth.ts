import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import type { WhopSignInResult } from '@/lib/contract';

export function whopReturnUrl(path = 'whop-auth'): string {
  return Linking.createURL(path);
}

export async function openWhopSignIn(authorizeUrl: string, returnUrl: string): Promise<WhopSignInResult> {
  const result = await WebBrowser.openAuthSessionAsync(authorizeUrl, returnUrl);
  if (result.type !== 'success') return 'cancelled';
  const status = Linking.parse(result.url).queryParams?.whop;
  return status === 'linked' ? 'linked' : status === 'cancelled' ? 'cancelled' : 'error';
}
