import { Redirect, Stack } from 'expo-router';

import { useReduced } from '@/motion';

// Gated playground: only exists when the bundle is built with EXPO_PUBLIC_MOCKS=1.
export default function LabLayout() {
  const reduced = useReduced();
  if (process.env.EXPO_PUBLIC_MOCKS !== '1') return <Redirect href="/" />;
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#0E0F13' },
        animation: reduced ? 'fade' : 'default',
      }}
    />
  );
}
