// Feed fixtures exist only in EXPO_PUBLIC_MOCKS=1 bundles; otherwise Metro folds this to null and the
// showcase feed screens render their empty states until the real feed hooks land.
// eslint-disable-next-line @typescript-eslint/no-require-imports
export const feedFixtures: typeof import('./feed') | null = process.env.EXPO_PUBLIC_MOCKS === '1' ? require('./feed') : null;
