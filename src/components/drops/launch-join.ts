import * as Linking from 'expo-linking';

import { parseJoinCode } from '@/lib/join-code';

let settled = false;

// JoinFlow calls this when a linked code reached it through the router, so the cover never replays the launch link.
export function markJoinLinkHandled() {
  settled = true;
}

// A cold Expo Go launch from exp://…/--/join/CODE can open the cover instead of the join. Read the launch URL once
// and recover the code ourselves: the deep-link path is whatever follows /--/ (or the path of a scheme/https link).
export async function launchJoinCode(): Promise<string | null> {
  if (settled) return null;
  settled = true;
  const url = await Linking.getInitialURL();
  if (!url) return null;
  const rest = url.includes('/--/') ? url.split('/--/')[1] : url.replace(/^https?:\/\/[^/?#]*\/?|^[a-z][a-z0-9+.-]*:\/\//i, '');
  const [path, query = ''] = rest.split('#')[0].split('?');
  const linked = /^join\/([^/]+)/.exec(path)?.[1] ?? (path.replace(/\/$/, '') === 'join' ? new URLSearchParams(query).get('code') : null);
  return linked ? parseJoinCode(linked) : null;
}
