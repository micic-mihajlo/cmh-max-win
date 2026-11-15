// The host screen's QR encodes either the bare 4-char join code ("K7QX") or an https URL whose last path
// segment is the code ("https://…/join/K7QX"). Both work when scanned with the iOS Camera or Expo Go,
// where custom-scheme links don't open. Returns the normalized code, or null if the text holds none.
const JOIN_CODE = /(?:^|\/)([ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4})\/?$/;

export function parseJoinCode(text: string): string | null {
  const cleaned = text.trim().split(/[?#]/)[0].toUpperCase();
  return JOIN_CODE.exec(cleaned)?.[1] ?? null;
}
