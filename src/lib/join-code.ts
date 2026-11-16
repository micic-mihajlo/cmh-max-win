// The host screen's QR encodes either the bare 4-char join code ("K7QX") or an https URL whose last path
// segment is the code ("https://…/join/K7QX"). Both work when scanned with the iOS Camera or Expo Go,
// where custom-scheme links don't open. Returns the normalized code, or null if the text holds none.
const JOIN_CODE = /(?:^|\/)([ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4})\/?$/;

export function parseJoinCode(text: string): string | null {
  const cleaned = text.trim().split(/[?#]/)[0].toUpperCase();
  return JOIN_CODE.exec(cleaned)?.[1] ?? null;
}

// https://signal-app-wine.vercel.app/c/<CODE> opens the App Clip and the full app at the same route, /c/[code].
// appclip.apple.com is the clip's default App Store URL, which carries no code, so it opens the clip's code entry.
export function challengeLinkPath(path: string): string {
  try {
    return new URL(path, 'cmhmaxwin://').hostname === 'appclip.apple.com' ? '/clip' : path;
  } catch {
    return path;
  }
}
