// The gallery holds answer-bearing fixtures (dossiers, nudges, the reveal). EXPO_PUBLIC_MOCKS is inlined at
// build time, so without EXPO_PUBLIC_MOCKS=1 Metro folds this ternary to null and never bundles ./gallery.
// eslint-disable-next-line @typescript-eslint/no-require-imports
export const gallery: typeof import('./gallery') | null = process.env.EXPO_PUBLIC_MOCKS === '1' ? require('./gallery') : null;
