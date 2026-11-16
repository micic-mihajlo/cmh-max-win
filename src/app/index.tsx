import { Redirect } from 'expo-router';

import { HomeScreen } from '@/components/home/home';
import { gallery } from '@/mocks/load';

export default function Index() {
  if (gallery) return <Redirect href="/mocks" />;
  return <HomeScreen />;
}
