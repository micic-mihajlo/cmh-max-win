import { challengeLinkPath } from '@/lib/join-code';

export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  return challengeLinkPath(path);
}
