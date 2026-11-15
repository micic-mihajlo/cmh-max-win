import { Redirect } from 'expo-router';

import { CoverScreen } from '@/components/screens/cover';
import { gallery } from '@/mocks/load';

export default function Index() {
  if (gallery) return <Redirect href="/mocks" />;
  return <CoverScreen active={null} />;
}
