// The host screen's QR encodes either the bare 4-char join code ("K7QX") or an https URL whose last path
// segment is the code ("https://…/join/K7QX"). Both work when scanned with the iOS Camera or Expo Go,
// where custom-scheme links don't open. Returns the normalized code, or null if the text holds none.
const JOIN_CODE = /(?:^|\/)([ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4})\/?$/;

export function parseJoinCode(text: string): string | null {
  const cleaned = text.trim().split(/[?#]/)[0].toUpperCase();
  return JOIN_CODE.exec(cleaned)?.[1] ?? null;
}

// https://signal-app-wine.vercel.app/c/<CODE> opens the App Clip and the full app at the same path. Until the player
// route /c/[code] lands, the clip player at /clip plays it. appclip.apple.com is the clip's default App Store URL.
// Every other link passes through unchanged.
export function challengeLinkPath(path: string): string {
  try {
    const url = new URL(path, 'cmhmaxwin://');
    if (url.hostname === 'appclip.apple.com') return '/clip';
    const route = url.protocol === 'https:' ? url.pathname : `/${url.hostname}${url.pathname}`;
    const code = /^\/c\/([A-Za-z0-9]{4})\/?$/.exec(route)?.[1];
    return code ? `/clip?code=${code.toUpperCase()}` : path;
  } catch {
    return path;
  }
}
