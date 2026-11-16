import { readStored, writeStored } from '@/lib/device';

const KEY = 'signal.hostedDropIds';
const KEEP = 20;

// Drops this device opened as host, newest last, so "Reset my rooms" can find them without a sign-in.
export async function readMyRooms(): Promise<string[]> {
  const { value } = await readStored(KEY);
  try {
    const ids = JSON.parse(value ?? '[]');
    return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export async function rememberMyRoom(dropId: string) {
  const ids = (await readMyRooms()).filter((id) => id !== dropId);
  await writeStored(KEY, JSON.stringify([...ids, dropId].slice(-KEEP)));
}
