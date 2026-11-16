// A challenge's join link and the parser the scanner uses to read one back. A SIGNAL QR holds the https share URL
// (what the iPhone Camera and the App Clip open), the app's own scheme link, or the bare four-character code.
export const SHARE_ORIGIN = 'https://signal-app-wine.vercel.app';
export const APP_SCHEME = 'cmhmaxwin';

const CODE = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/;
const SHARE_HOSTS = new Set(['signal-app-wine.vercel.app']);

export const shareUrlFor = (code: string) => `${SHARE_ORIGIN}/c/${code.toUpperCase()}`;

export function normalizeCode(text: string): string | null {
  const code = text.trim().toUpperCase();
  return CODE.test(code) ? code : null;
}

// Returns the challenge code a scanned or pasted string points at, or null when it isn't a SIGNAL challenge.
export function parseChallengeCode(text: string): string | null {
  const raw = text.trim();
  const bare = normalizeCode(raw);
  if (bare) return bare;

  const scheme = /^([a-z][a-z0-9+.-]*):\/\/(.*)$/i.exec(raw);
  if (!scheme) return null;
  const [, protocol, rest] = scheme;
  const [location] = rest.split(/[?#]/);
  const slash = location.indexOf('/');
  const host = (slash < 0 ? location : location.slice(0, slash)).toLowerCase();
  const path = slash < 0 ? '' : location.slice(slash);

  if (protocol.toLowerCase() === APP_SCHEME) return codeFromPath(host ? `/${host}${path}` : path);
  if (protocol.toLowerCase() === 'https' && SHARE_HOSTS.has(host)) return codeFromPath(path);
  return null;
}

function codeFromPath(path: string): string | null {
  const parts = path.split('/').filter(Boolean);
  if (parts.length !== 2 || parts[0] !== 'c') return null;
  return normalizeCode(decodeURIComponent(parts[1]));
}
