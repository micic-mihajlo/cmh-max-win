// ---------- Host accounts (CAP-73) ----------
// A host signs in with Whop to run their drops from any device: their phone, a laptop, a projected web build.
// Players never sign in. Sign-in is optional for hosts too: a drop hosted without it keeps working only on the
// device that made it, exactly as before.
//
// - Sign in: useSignInToHost(returnPath)() opens Whop's sign-in and resolves 'linked' once this device is signed in.
//   The signed-in account is useWhopAccount() (whopAuth:account); sign out is useSignOutWhop() (whopAuth:signOut).
// - Host: useHostDrop() as today. On a signed-in device the drop records the Whop account as its host.
// - Run: any device signed in to that account gets useHostView(dropId) and useDealSquads() for the drop, the same as
//   the device that made it. Every other device gets null from hostView and NOT_HOST from host actions.
// - List: useMyHostedDrops() is the signed-in account's drops from the last 24 hours, newest first; [] when this
//   device isn't signed in.
import type { WhopSignInResult } from './contract';

export type HostedDropTemplate = 'case01' | 'split-passphrase';
// lobby: open for entries, not dealt yet. live: dealt, squads racing. finished: ended.
export type HostedDropStatus = 'lobby' | 'live' | 'finished';

export type HostedDropRow = {
  dropId: string; // for useHostView / useDealSquads and the host route
  code: string; // the 4-char join code players type or scan
  title: string;
  template: HostedDropTemplate;
  status: HostedDropStatus;
  players: number; // entrants so far
  createdAt: number; // ms epoch
  scheduledFor: number | null; // a scheduled drop's start (hostDrop startsAt); null when it opened at once
};

// returnPath is the app route the sign-in sheet returns to (e.g. 'host'). On web the return URL is the app's own
// origin (https://signal-app-wine.vercel.app/...).
export type UseSignInToHost = (returnPath: string) => () => Promise<WhopSignInResult>;
export type UseMyHostedDrops = () => HostedDropRow[] | undefined; // undefined while loading
