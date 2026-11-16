import { Platform } from 'react-native';

// Mobile web signs in to Whop by redirecting the tab, so the join or claim that asked for it never gets its answer.
// Before leaving we note what to finish; the page that comes back with ?whop= takes the note once and resumes it.
export type Resume = 'join' | 'claim';

const KEY = 'challenge-whop-resume';
const TTL_MS = 10 * 60 * 1000;

const web = () => Platform.OS === 'web' && typeof window !== 'undefined';

export function markResume(code: string, action: Resume) {
  if (web()) window.sessionStorage.setItem(KEY, JSON.stringify({ code, action, at: Date.now() }));
}

// Call during the first render: the sign-in hooks strip ?whop= from the URL in their mount effect.
export function takeResume(code: string): Resume | null {
  if (!web()) return null;
  const raw = window.sessionStorage.getItem(KEY);
  if (!raw) return null;
  const note = JSON.parse(raw) as { code: string; action: Resume; at: number };
  if (note.code !== code) return null;
  window.sessionStorage.removeItem(KEY);
  const back = new URLSearchParams(window.location.search).has('whop');
  return back && Date.now() - note.at < TTL_MS ? note.action : null;
}
