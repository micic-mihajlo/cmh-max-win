import * as Clipboard from 'expo-clipboard';
import { useCallback, useEffect, useState } from 'react';
import { Share } from 'react-native';

import { shareUrlFor } from '@/lib/share-link';

const COPIED_MS = 1600;

// Shares a challenge's join link: the native share sheet on iOS and Android, copy to clipboard on web.
// Pass HostConsoleView.shareUrl / ChallengeSummaryView.shareUrl when you have it; without it the link is built from the code.
// `copied` stays true for a moment after a web copy so the button can read "Copied".
export function useShareChallenge(code: string, shareUrl?: string | null) {
  const url = shareUrl ?? shareUrlFor(code);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), COPIED_MS);
    return () => clearTimeout(t);
  }, [copied]);

  const share = useCallback(async () => {
    if (process.env.EXPO_OS === 'web') {
      await Clipboard.setStringAsync(url);
      setCopied(true);
      return;
    }
    const message = `Join my SIGNAL challenge with code ${code.toUpperCase()}`;
    await Share.share(process.env.EXPO_OS === 'ios' ? { message, url } : { message: `${message}: ${url}` }).catch(() => {});
  }, [code, url]);

  return { url, share, copied, label: process.env.EXPO_OS === 'web' ? (copied ? 'Copied' : 'Copy link') : 'Share' };
}
