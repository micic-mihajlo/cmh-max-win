import type { ComponentType } from 'react';

// Behind an inlined EXPO_PUBLIC_ constant: without the flag the lab and its fixtures never bundle.
const Screen: ComponentType =
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  process.env.EXPO_PUBLIC_MOCKS === '1' ? require('@/motion/lab/reveal').default : () => null;

export default Screen;
