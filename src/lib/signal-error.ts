import { ConvexError } from 'convex/values';

import type { SignalError } from '@/lib/contract';

// Reads the { code, message } a SIGNAL mutation threw, or null for any other error.
export function toSignalError(error: unknown): SignalError | null {
  if (error instanceof ConvexError && error.data && typeof error.data === 'object' && 'code' in error.data) {
    return error.data as SignalError;
  }
  return null;
}
