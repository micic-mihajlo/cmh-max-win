import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const store = vi.hoisted(() => ({ getItemAsync: vi.fn(), setItemAsync: vi.fn() }));
vi.mock('expo-secure-store', () => store);
vi.mock('expo-crypto', () => ({ randomUUID: () => 'generated' }));
vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }));

const hang = () => new Promise<never>(() => {});

async function load() {
  vi.resetModules();
  return import('./device');
}

beforeEach(() => {
  vi.useFakeTimers();
  store.getItemAsync.mockReset();
  store.setItemAsync.mockReset().mockResolvedValue(undefined);
});
afterEach(() => vi.useRealTimers());

describe('getDeviceToken', () => {
  test('returns the stored token without writing', async () => {
    store.getItemAsync.mockResolvedValue('real');
    const { getDeviceToken } = await load();
    expect(await getDeviceToken()).toBe('real');
    expect(store.setItemAsync).not.toHaveBeenCalled();
  });

  test('generates and stores a token on a real miss', async () => {
    store.getItemAsync.mockResolvedValue(null);
    const { getDeviceToken } = await load();
    expect(await getDeviceToken()).toBe('generated');
    expect(store.setItemAsync).toHaveBeenCalledWith('signal.deviceToken', 'generated');
  });

  test('a hanging write does not block the token', async () => {
    store.getItemAsync.mockResolvedValue(null);
    store.setItemAsync.mockImplementation(hang);
    const { getDeviceToken } = await load();
    const token = getDeviceToken();
    await vi.advanceTimersByTimeAsync(1500);
    expect(await token).toBe('generated');
  });

  test('after a timed-out read, the retry switches to the stored token and nothing is written', async () => {
    store.getItemAsync.mockImplementationOnce(hang).mockResolvedValueOnce('real');
    const { getDeviceToken } = await load();
    const token = getDeviceToken();
    await vi.advanceTimersByTimeAsync(1500);
    expect(await token).toBe('real');
    expect(await getDeviceToken()).toBe('real');
    expect(store.setItemAsync).not.toHaveBeenCalled();
  });

  test('if the retry also times out, the generated token stays in memory and is never written', async () => {
    store.getItemAsync.mockImplementation(hang);
    const { getDeviceToken } = await load();
    const token = getDeviceToken();
    await vi.advanceTimersByTimeAsync(3000);
    expect(await token).toBe('generated');
    expect(await getDeviceToken()).toBe('generated');
    expect(store.setItemAsync).not.toHaveBeenCalled();
  });

  test('a rejected read is a miss, not a hang', async () => {
    store.getItemAsync.mockRejectedValue(new Error('keychain'));
    const { readStored } = await load();
    expect(await readStored('signal.playerName')).toEqual({ value: null, timedOut: false });
  });
});
